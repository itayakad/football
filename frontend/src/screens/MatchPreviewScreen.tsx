import React, { useState, useEffect } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { ScreenContainer } from '../components/ScreenContainer';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { api } from '../api/client';
import { useUserTeamId } from '../state/userTeam';
import { colors, radius, spacing, typography } from '../theme';
import { DefensiveIdentity, MatchPreviewResponse, OffensiveIdentity, SchemeUnit, TeamScheme } from '../api/types';
import { RootStackParamList } from '../navigation/types';
import { teamArchetypeLabel } from '../utils/teamArchetype';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type Opponent = MatchPreviewResponse['opponent'];
type OpponentPlayer = Opponent['topOffense'][number];
type OpponentCoach = Opponent['coaches'][number];

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

  const liveMutation = useMutation({
    mutationFn: () => api.liveStart(matchId, userTeamId!, offenseSchemeId!, defenseSchemeId!),
    onSuccess:  () => {
      navigation.replace('MatchSim', { matchId, userTeamId: userTeamId! });
    },
  });

  if (!userTeamId || isLoading) {
    return (
      <ScreenContainer scroll={false} contentStyle={styles.fixedContent}>
        <ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing.xxxl }} />
      </ScreenContainer>
    );
  }
  if (error || !data || !offenseSchemeId || !defenseSchemeId) {
    return (
      <ScreenContainer scroll={false} contentStyle={styles.fixedContent}>
        <Text style={typography.body}>Failed to load match preview.</Text>
      </ScreenContainer>
    );
  }

  const { opponent, week, isHome } = data;
  const offenseSchemes = data.schemes.filter((scheme) => scheme.unit === 'offense');
  const defenseSchemes = data.schemes.filter((scheme) => scheme.unit === 'defense');
  const offenseScheme = offenseSchemes.find((scheme) => scheme.id === offenseSchemeId) ?? null;
  const defenseScheme = defenseSchemes.find((scheme) => scheme.id === defenseSchemeId) ?? null;

  return (
    <ScreenContainer scroll={false} contentStyle={styles.fixedContent}>
      <ScreenHeader
        label={`Week ${week} · ${isHome ? 'Home' : 'Away'}`}
        title={`${isHome ? 'vs' : '@'} ${opponent.name}`}
      />

      <View style={styles.opponentCard}>
        <View style={styles.opponentTopRow}>
          <View style={styles.opponentIdentityIcons}>
            <View style={styles.identityIconCircle}>
              <Ionicons
                name={offensiveIdentityIcon(opponent.identity.offense)}
                size={14}
                color={offensiveIdentityColor(opponent.identity.offense)}
              />
            </View>
            <View style={styles.identityIconCircle}>
              <Ionicons
                name={defensiveIdentityIcon(opponent.identity.defense)}
                size={14}
                color={defensiveIdentityColor(opponent.identity.defense)}
              />
            </View>
          </View>
          <Text style={styles.opponentArchetype} numberOfLines={1}>
            {teamArchetypeLabel(opponent.identity)}
          </Text>
          <View style={styles.opponentRatings}>
            <RatingBlock label="OFF" value={opponent.offenseRating} />
            <RatingBlock label="DEF" value={opponent.defenseRating} />
          </View>
        </View>

        <View style={styles.unitBlock}>
          <Text style={styles.unitHeader}>Top Offense</Text>
          <View style={styles.playerRow}>
            {opponent.topOffense.map((player) => (
              <PlayerChip key={player.id} player={player} />
            ))}
            {opponent.topOffense.length === 0 && <EmptySlot />}
          </View>
        </View>

        <View style={styles.unitBlock}>
          <Text style={styles.unitHeader}>Top Defense</Text>
          <View style={styles.playerRow}>
            {opponent.topDefense.map((player) => (
              <PlayerChip key={player.id} player={player} />
            ))}
            {opponent.topDefense.length === 0 && <EmptySlot />}
          </View>
        </View>

        <View style={styles.unitBlock}>
          <Text style={styles.unitHeader}>Coaching Staff</Text>
          <View style={styles.coachRow}>
            {opponent.coaches.map((coach) => (
              <CoachChip key={coach.id} coach={coach} />
            ))}
            {opponent.coaches.length === 0 && <EmptySlot />}
          </View>
        </View>
      </View>

      <View style={styles.schemeBlock}>
        <SchemeDropdown
          label="Offense Scheme"
          unit="offense"
          schemes={offenseSchemes}
          selected={offenseScheme}
          onChange={setOffenseSchemeId}
        />
        <SchemeDropdown
          label="Defense Scheme"
          unit="defense"
          schemes={defenseSchemes}
          selected={defenseScheme}
          onChange={setDefenseSchemeId}
        />
      </View>

      <Button
        label={liveMutation.isPending ? 'Opening Match…' : 'Enter Match →'}
        onPress={() => liveMutation.mutate()}
        loading={liveMutation.isPending}
      />
    </ScreenContainer>
  );
};

// ─── Sub-components ─────────────────────────────────────

const RatingBlock: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <View style={styles.ratingBlock}>
    <Text style={styles.ratingLabel}>{label}</Text>
    <Text style={styles.ratingValue}>{value}</Text>
  </View>
);

const PlayerChip: React.FC<{ player: OpponentPlayer }> = ({ player }) => {
  const lastName = player.name.split(' ').slice(1).join(' ') || player.name;
  return (
    <View style={styles.chip}>
      <View style={styles.chipTopRow}>
        <Text style={styles.chipPosition}>{player.position}</Text>
        <Text style={styles.chipOverall}>{player.overall}</Text>
      </View>
      <View style={styles.chipAvatar}>
        <Text style={styles.chipAvatarText}>{initials(player.name)}</Text>
      </View>
      <Text style={styles.chipName} numberOfLines={1}>{lastName}</Text>
    </View>
  );
};

const CoachChip: React.FC<{ coach: OpponentCoach }> = ({ coach }) => {
  const lastName = coach.name.split(' ').slice(1).join(' ') || coach.name;
  return (
    <View style={styles.chip}>
      <View style={styles.chipTopRow}>
        <Text style={styles.chipPosition}>{coach.position}</Text>
        <Text style={styles.chipOverall}>{coach.overall}</Text>
      </View>
      <View style={styles.chipAvatar}>
        <Text style={styles.chipAvatarText}>{initials(coach.name)}</Text>
      </View>
      <Text style={styles.chipName} numberOfLines={1}>{lastName}</Text>
    </View>
  );
};

const EmptySlot: React.FC = () => (
  <Text style={styles.emptyText}>—</Text>
);

const SchemeDropdown: React.FC<{
  label:    string;
  unit:     SchemeUnit;
  schemes:  TeamScheme[];
  selected: TeamScheme | null;
  onChange: (id: string) => void;
}> = ({ label, schemes, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <View style={styles.dropdown}>
        <Text style={styles.dropdownLabel}>{label}</Text>
        <Pressable
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.dropdownButton, pressed && styles.dropdownButtonPressed]}
        >
          <Text style={styles.dropdownValue} numberOfLines={1}>
            {selected?.name ?? 'Select a scheme'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.text.secondary} />
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>{label}</Text>
            {schemes.map((scheme) => {
              const isSelected = scheme.id === selected?.id;
              return (
                <Pressable
                  key={scheme.id}
                  onPress={() => {
                    onChange(scheme.id);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.modalOption,
                    isSelected && styles.modalOptionSelected,
                    pressed && styles.modalOptionPressed,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalOptionName, isSelected && styles.modalOptionNameSelected]} numberOfLines={1}>
                      {scheme.name}
                    </Text>
                    <Text style={styles.modalOptionMeta} numberOfLines={1}>
                      {categorySummary(scheme)}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.accent.primary} />
                  )}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

function categorySummary(scheme: TeamScheme): string {
  const counts = new Map<string, number>();
  for (const play of scheme.playTemplates) {
    counts.set(play.categoryLabel, (counts.get(play.categoryLabel) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([label, count]) => `${count} ${label}`).join(' · ');
}

function initials(name: string): string {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function offensiveIdentityIcon(identity: OffensiveIdentity): IoniconName {
  const icons: Record<OffensiveIdentity, IoniconName> = {
    VERTICAL:   'rocket-outline',
    RUN_HEAVY:  'footsteps-outline',
    PASS_HEAVY: 'send-outline',
    BALANCED:   'options-outline',
  };
  return icons[identity];
}

function defensiveIdentityIcon(identity: DefensiveIdentity): IoniconName {
  const icons: Record<DefensiveIdentity, IoniconName> = {
    PRESSURE:   'flash-outline',
    MAN_HEAVY:  'person-outline',
    ZONE_HEAVY: 'grid-outline',
    BALANCED:   'shield-checkmark-outline',
  };
  return icons[identity];
}

function offensiveIdentityColor(identity: OffensiveIdentity): string {
  if (identity === 'VERTICAL' || identity === 'PASS_HEAVY') return colors.identity.pass;
  if (identity === 'RUN_HEAVY') return colors.identity.run;
  return colors.identity.bal;
}

function defensiveIdentityColor(identity: DefensiveIdentity): string {
  if (identity === 'PRESSURE') return colors.identity.agg;
  if (identity === 'MAN_HEAVY') return colors.identity.man;
  if (identity === 'ZONE_HEAVY') return colors.identity.zone;
  return colors.identity.bal;
}

const styles = StyleSheet.create({
  fixedContent: {
    flex:          1,
    paddingTop:    spacing.sm,
    paddingBottom: spacing.sm,
    gap:           spacing.md,
  },
  opponentCard: {
    flex:            1,
    minHeight:       0,
    backgroundColor: colors.bg.elevated,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.sm,
  },
  opponentTopRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  opponentIdentityIcons: {
    flexDirection: 'row',
    gap:           4,
  },
  identityIconCircle: {
    width:           24,
    height:          24,
    borderRadius:    12,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.bg.surface,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  opponentArchetype: {
    ...typography.label,
    color:      colors.text.primary,
    flex:       1,
    flexShrink: 1,
  },
  opponentRatings: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  ratingBlock: {
    minWidth:        48,
    alignItems:      'center',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius:    radius.sm,
    backgroundColor: colors.bg.surface,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  ratingLabel: {
    ...typography.label,
    fontSize: 9,
    color:    colors.text.muted,
  },
  ratingValue: {
    ...typography.heading,
    fontSize: 16,
    color:    colors.accent.primary,
  },
  unitBlock: {
    gap: spacing.xs,
  },
  unitHeader: {
    ...typography.label,
    color:         colors.text.secondary,
    letterSpacing: 0.8,
  },
  playerRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  coachRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  chip: {
    flex:            1,
    minHeight:       96,
    borderRadius:    radius.md,
    padding:         spacing.sm,
    backgroundColor: colors.bg.surface,
    borderWidth:     1,
    borderColor:     colors.border,
    alignItems:      'center',
    gap:             4,
  },
  chipTopRow: {
    width:           '100%',
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
  },
  chipPosition: {
    ...typography.label,
    fontSize: 10,
    color:    colors.text.secondary,
  },
  chipOverall: {
    color:      colors.accent.primary,
    fontSize:   14,
    fontWeight: '800',
  },
  chipAvatar: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: colors.bg.elevated,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     colors.border,
  },
  chipAvatarText: {
    color:      colors.text.secondary,
    fontSize:   11,
    fontWeight: '800',
  },
  chipName: {
    color:      colors.text.primary,
    fontSize:   11,
    fontWeight: '700',
    width:      '100%',
    textAlign:  'center',
  },
  emptyText: {
    ...typography.caption,
    color: colors.text.muted,
  },
  schemeBlock: {
    gap: spacing.sm,
  },
  dropdown: {
    gap: 4,
  },
  dropdownLabel: {
    ...typography.label,
    color: colors.text.secondary,
  },
  dropdownButton: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius:      radius.md,
    backgroundColor:   colors.bg.elevated,
    borderWidth:       1,
    borderColor:       colors.border,
    minHeight:         42,
  },
  dropdownButtonPressed: {
    backgroundColor: colors.bg.surface,
  },
  dropdownValue: {
    ...typography.body,
    flex:       1,
    fontWeight: '700',
    color:      colors.text.primary,
  },
  modalBackdrop: {
    flex:            1,
    backgroundColor: colors.bg.overlay,
    justifyContent:  'center',
    paddingHorizontal: spacing.xl,
  },
  modalSheet: {
    backgroundColor: colors.bg.elevated,
    borderRadius:    radius.lg,
    padding:         spacing.lg,
    gap:             spacing.sm,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  modalTitle: {
    ...typography.label,
    color:        colors.text.secondary,
    marginBottom: spacing.xs,
  },
  modalOption: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    padding:           spacing.md,
    borderRadius:      radius.md,
    backgroundColor:   colors.bg.surface,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  modalOptionSelected: {
    borderColor:     colors.accent.primary,
  },
  modalOptionPressed: {
    backgroundColor: colors.bg.elevated,
  },
  modalOptionName: {
    ...typography.body,
    fontWeight: '700',
    color:      colors.text.primary,
  },
  modalOptionNameSelected: {
    color: colors.accent.primary,
  },
  modalOptionMeta: {
    ...typography.caption,
    color: colors.text.muted,
  },
});
