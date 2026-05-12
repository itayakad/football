import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ScreenContainer } from '../components/ScreenContainer';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Pill, pillColor, pillLabel } from '../components/Pill';
import { SectionLabel } from '../components/SectionLabel';
import { FormDots } from '../components/FormDots';
import { api } from '../api/client';
import { useUserTeamId } from '../state/userTeam';
import { lastSim } from '../state/lastSim';
import { colors, spacing, typography, radius } from '../theme';
import { SchemeUnit, TeamScheme } from '../api/types';
import { RootStackParamList } from '../navigation/types';

export const MatchPreviewScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route      = useRoute<RouteProp<RootStackParamList, 'MatchPreview'>>();
  const { matchId } = route.params;
  const userTeamId = useUserTeamId();

  const { data, isLoading, error } = useQuery({
    queryKey: ['matchPreview', matchId, userTeamId],
    queryFn: () => api.matchPreview(matchId, userTeamId!),
    enabled:  !!userTeamId,
  });

  const [offenseSchemeId, setOffenseSchemeId] = useState<string | null>(null);
  const [defenseSchemeId, setDefenseSchemeId] = useState<string | null>(null);
  useEffect(() => {
    if (!data) return;
    if (!offenseSchemeId) setOffenseSchemeId(data.schemes.find((scheme) => scheme.unit === 'offense' && scheme.isDefault)?.id ?? data.schemes.find((scheme) => scheme.unit === 'offense')?.id ?? null);
    if (!defenseSchemeId) setDefenseSchemeId(data.schemes.find((scheme) => scheme.unit === 'defense' && scheme.isDefault)?.id ?? data.schemes.find((scheme) => scheme.unit === 'defense')?.id ?? null);
  }, [data, offenseSchemeId, defenseSchemeId]);

  const simulateMutation = useMutation({
    mutationFn: () => api.simulateWithSchemes(matchId, userTeamId!, offenseSchemeId!, defenseSchemeId!),
    onSuccess:  (result) => {
      lastSim.set(result);
      navigation.replace('MatchSim', { matchId, userTeamId: userTeamId! });
    },
  });

  if (!userTeamId || isLoading) {
    return <ScreenContainer><ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing.xxxl }} /></ScreenContainer>;
  }
  if (error || !data || !offenseSchemeId || !defenseSchemeId) {
    return <ScreenContainer><Text style={typography.body}>Failed to load match preview.</Text></ScreenContainer>;
  }

  const { opponent, week, isHome } = data;
  const myTeam = data.myTeam;
  const offenseSchemes = data.schemes.filter((scheme) => scheme.unit === 'offense');
  const defenseSchemes = data.schemes.filter((scheme) => scheme.unit === 'defense');

  return (
    <ScreenContainer>
      {/* ── Header: Matchup ─────────────────────────────── */}
      <View>
        <Text style={typography.label}>Week {week} · {isHome ? 'Home' : 'Away'}</Text>
        <View style={styles.matchupRow}>
          <View style={styles.teamSlot}>
            <Text style={typography.heading}>{myTeam.name}</Text>
            <Text style={typography.caption}>OFF {myTeam.offenseRating} · DEF {myTeam.defenseRating}</Text>
            {data.myForm.lastResults.length > 0 && (
              <View style={{ marginTop: spacing.xs }}>
                <FormDots results={data.myForm.lastResults} streak={data.myForm.streak} />
              </View>
            )}
          </View>
          <Text style={[typography.title, { color: colors.text.muted }]}>vs</Text>
          <View style={styles.teamSlot}>
            <Text style={typography.heading}>{opponent.name}</Text>
            <Text style={typography.caption}>OFF {opponent.offenseRating} · DEF {opponent.defenseRating}</Text>
            {data.oppForm.lastResults.length > 0 && (
              <View style={{ marginTop: spacing.xs }}>
                <FormDots results={data.oppForm.lastResults} streak={data.oppForm.streak} />
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── Opponent Breakdown ──────────────────────────── */}
      <Card>
        <SectionLabel>Opponent Breakdown</SectionLabel>
        <View style={styles.identityRow}>
          <Pill label={pillLabel(opponent.offenseStyle)} color={pillColor(opponent.offenseStyle)} />
          <Pill label={pillLabel(opponent.offensivePhilosophy)} color={pillColor(opponent.offensivePhilosophy)} />
          <Pill label={pillLabel(opponent.defenseStyle)} color={pillColor(opponent.defenseStyle)} />
          <Pill label={pillLabel(opponent.tempo)}        color={pillColor(opponent.tempo)} />
        </View>

        <View style={styles.groupGrid}>
          <GroupStat label="QB"        value={opponent.groups.qb} />
          <GroupStat label="Skill"     value={opponent.groups.skillPositions} />
          <GroupStat label="O-Line"    value={opponent.groups.oLine} />
          <GroupStat label="Front 7"   value={opponent.groups.frontSeven} />
          <GroupStat label="Secondary" value={opponent.groups.secondary} />
        </View>
      </Card>

      {data.lineupReadiness.warnings.length > 0 && (
        <Card>
          <SectionLabel>Injury Risk</SectionLabel>
          {data.lineupReadiness.warnings.map((warning) => (
            <Text key={warning.playerId} style={[typography.caption, { color: colors.warn, marginTop: spacing.xs }]}>{warning.message}</Text>
          ))}
        </Card>
      )}

      <Card>
        <SectionLabel>Weekly Schemes</SectionLabel>
        <SchemePicker
          label="Offense"
          unit="offense"
          schemes={offenseSchemes}
          value={offenseSchemeId}
          onChange={setOffenseSchemeId}
          onEdit={() => navigation.navigate('ChooseScheme', { unit: 'offense', mode: 'pregame', matchId })}
        />
        <SchemePicker
          label="Defense"
          unit="defense"
          schemes={defenseSchemes}
          value={defenseSchemeId}
          onChange={setDefenseSchemeId}
          onEdit={() => navigation.navigate('ChooseScheme', { unit: 'defense', mode: 'pregame', matchId })}
        />
      </Card>

      <Button
        label={simulateMutation.isPending ? 'Simulating…' : 'Simulate Game →'}
        onPress={() => simulateMutation.mutate()}
        loading={simulateMutation.isPending}
      />
    </ScreenContainer>
  );
};

// ─── Sub-components ─────────────────────────────────────

const GroupStat: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const tier = value >= 78 ? 'strong' : value >= 65 ? 'avg' : 'weak';
  const color = tier === 'strong' ? colors.success : tier === 'avg' ? colors.text.secondary : colors.danger;
  return (
    <View style={styles.groupCell}>
      <Text style={[typography.caption, { fontSize: 11 }]}>{label}</Text>
      <Text style={[typography.heading, { color }]}>{Math.round(value)}</Text>
    </View>
  );
};

const ReasonRow: React.FC<{ label: string; pick: string; reason: string }> = ({ label, pick, reason }) => (
  <View style={styles.reasonRow}>
    <View style={styles.reasonLabel}>
      <Text style={typography.label}>{label}</Text>
      <Text style={[typography.heading, { color: colors.accent.primary }]}>{pillLabel(pick)}</Text>
    </View>
    <Text style={[typography.caption, { flex: 1 }]}>{reason}</Text>
  </View>
);

const SchemePicker: React.FC<{
  label: string;
  unit: SchemeUnit;
  schemes: TeamScheme[];
  value: string | null;
  onChange: (id: string) => void;
  onEdit: () => void;
}> = ({ label, schemes, value, onChange, onEdit }) => (
  <View style={styles.selectorRow}>
    <View style={styles.schemePickerHeader}>
      <Text style={[typography.caption, { marginBottom: spacing.sm }]}>{label}</Text>
      <Pressable onPress={onEdit}>
        <Text style={styles.editSchemeText}>Edit</Text>
      </Pressable>
    </View>
    <View style={styles.optionsGrid}>
      {schemes.map((scheme) => {
        const selected = scheme.id === value;
        return (
          <Pressable
            key={scheme.id}
            onPress={() => onChange(scheme.id)}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <Text style={[styles.optionText, selected && { color: colors.text.primary, fontWeight: '700' }]}>
              {scheme.name}
            </Text>
            <Text style={[styles.schemeCount, selected && { color: colors.text.primary }]}>
              {scheme.plays.length} plays
            </Text>
          </Pressable>
        );
      })}
    </View>
  </View>
);

const SelectorRow: React.FC<{
  label:       string;
  options:     string[];
  value:       string;
  recommended: string;
  onChange:    (v: string) => void;
}> = ({ label, options, value, recommended, onChange }) => (
  <View style={styles.selectorRow}>
    <Text style={[typography.caption, { marginBottom: spacing.sm }]}>{label}</Text>
    <View style={styles.optionsGrid}>
      {options.map((opt) => {
        const selected = opt === value;
        const isRec    = opt === recommended;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[
              styles.option,
              selected && styles.optionSelected,
            ]}
          >
            <Text style={[
              styles.optionText,
              selected && { color: colors.text.primary, fontWeight: '700' },
            ]}>
              {pillLabel(opt)}
            </Text>
            {isRec && !selected && (
              <View style={styles.recDot} />
            )}
          </Pressable>
        );
      })}
    </View>
  </View>
);

const MultiSelectorRow: React.FC<{
  label: string;
  options: string[];
  value: [string, string, string];
  recommended: [string, string, string];
  onChange: (v: [string, string, string]) => void;
}> = ({ label, options, value, recommended, onChange }) => {
  const toggle = (option: string) => {
    if (value.includes(option)) {
      if (value.length <= 3) return;
      onChange(value.filter((item) => item !== option).slice(0, 3) as [string, string, string]);
      return;
    }
    onChange([option, value[0], value[1]]);
  };

  return (
    <View style={styles.selectorRow}>
      <Text style={[typography.caption, { marginBottom: spacing.sm }]}>{label} · pick 3</Text>
      <View style={styles.optionsGrid}>
        {options.map((opt) => {
          const rank = value.indexOf(opt);
          const selected = rank >= 0;
          const isRec = recommended.includes(opt);
          return (
            <Pressable
              key={opt}
              onPress={() => toggle(opt)}
              style={[
                styles.option,
                selected && styles.optionSelected,
              ]}
            >
              <Text style={[
                styles.optionText,
                selected && { color: colors.text.primary, fontWeight: '700' },
              ]}>
                {selected ? `${rank + 1}. ` : ''}{pillLabel(opt)}
              </Text>
              {isRec && !selected && (
                <View style={styles.recDot} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  matchupRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing.lg,
    marginTop:      spacing.sm,
  },
  teamSlot:    { flex: 1 },
  identityRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs },
  groupGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.md,
    marginTop:     spacing.md,
  },
  groupCell: {
    width:           '30%',
    paddingVertical: spacing.sm,
  },
  reasonRow: {
    flexDirection: 'row',
    gap:           spacing.md,
    marginTop:     spacing.md,
    alignItems:    'flex-start',
  },
  reasonLabel: {
    width: 110,
  },
  selectorRow: {
    marginTop: spacing.md,
  },
  schemePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editSchemeText: {
    ...typography.label,
    color: colors.accent.primary,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.sm,
  },
  option: {
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor:   colors.bg.surface,
    borderRadius:      radius.md,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,
  },
  optionSelected: {
    backgroundColor: colors.accent.primary,
  },
  schemeCount: {
    ...typography.caption,
    color: colors.text.muted,
    fontSize: 10,
  },
  optionText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  recDot: {
    width:  6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.accent.primary,
    marginLeft: spacing.xs,
  },
});
