import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../api/client';
import { PlayTemplate, TeamScheme } from '../api/types';
import { Card } from '../components/Card';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionLabel } from '../components/SectionLabel';
import { useUserTeamId } from '../state/userTeam';
import { colors, radius, spacing, typography } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { templatesForUnit } from '../data/playTemplates';

export const ChooseSchemeScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'ChooseScheme'>>();
  const { unit } = route.params;
  const userTeamId = useUserTeamId();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [draftName, setDraftName] = React.useState('');
  const [draftPlays, setDraftPlays] = React.useState<string[]>([]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['schemes', userTeamId, unit],
    queryFn: () => api.schemes(userTeamId!, unit),
    enabled: !!userTeamId,
  });

  const schemes = data?.schemes ?? [];
  const templates = templatesForUnit(unit);
  const active = schemes.find((scheme) => scheme.id === activeId) ?? schemes[0] ?? null;

  React.useEffect(() => {
    if (!active) return;
    setActiveId(active.id);
    setDraftName(active.name);
    setDraftPlays(active.plays);
  }, [active?.id]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['schemes', userTeamId, unit] });
    queryClient.invalidateQueries({ queryKey: ['roster', userTeamId] });
    queryClient.invalidateQueries({ queryKey: ['matchPreview'] });
  };

  const update = useMutation({
    mutationFn: () => api.updateScheme(userTeamId!, activeId!, { name: draftName.trim() || active?.name, plays: draftPlays }),
    onSuccess: refresh,
  });

  const create = useMutation({
    mutationFn: () => api.createScheme(
      userTeamId!,
      unit,
      `${unit === 'offense' ? 'Offense' : 'Defense'} Set ${schemes.length + 1}`,
      draftPlays.length === 9 ? draftPlays : templates.slice(0, 9).map((play) => play.id),
    ),
    onSuccess: (scheme) => {
      setActiveId(scheme.id);
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (scheme: TeamScheme) => api.deleteScheme(userTeamId!, scheme.id),
    onSuccess: () => {
      setActiveId(null);
      refresh();
    },
  });

  if (!userTeamId || isLoading) {
    return <ScreenContainer><ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing.xxxl }} /></ScreenContainer>;
  }
  if (error || !active) {
    return <ScreenContainer><Text style={typography.body}>Failed to load schemes.</Text></ScreenContainer>;
  }

  const togglePlay = (playId: string) => {
    if (draftPlays.includes(playId)) {
      if (draftPlays.length <= 9) return;
      setDraftPlays(draftPlays.filter((id) => id !== playId).slice(0, 9));
      return;
    }
    setDraftPlays([playId, ...draftPlays].slice(0, 9));
  };

  return (
    <ScreenContainer>
      <View>
        <Text style={typography.label}>{unit === 'offense' ? 'Offensive' : 'Defensive'} Scheme</Text>
        <Text style={[typography.display, styles.title]}>Choose Scheme</Text>
      </View>

      <View style={styles.schemeTabs}>
        {schemes.map((scheme) => (
          <Pressable
            key={scheme.id}
            onPress={() => setActiveId(scheme.id)}
            style={[styles.schemeTab, scheme.id === active.id && styles.schemeTabActive]}
          >
            <Text style={[styles.schemeTabText, scheme.id === active.id && styles.schemeTabTextActive]}>{scheme.name}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => create.mutate()} style={styles.schemeTab}>
          <Text style={styles.schemeTabText}>New</Text>
        </Pressable>
      </View>

      <Card>
        <SectionLabel>Saved Set</SectionLabel>
        <TextInput
          value={draftName}
          onChangeText={setDraftName}
          placeholder="Scheme name"
          placeholderTextColor={colors.text.muted}
          style={styles.input}
        />
        <View style={styles.actionRow}>
          <Pressable disabled={update.isPending || draftPlays.length !== 9} onPress={() => update.mutate()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{update.isPending ? 'Saving...' : 'Save 9 Plays'}</Text>
          </Pressable>
          {!active.isDefault && (
            <Pressable disabled={remove.isPending} onPress={() => remove.mutate(active)} style={styles.deleteButton}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </Pressable>
          )}
        </View>
      </Card>

      <View>
        <SectionLabel>Play Library</SectionLabel>
        <View style={styles.playGrid}>
          {templates.map((template) => {
            const rank = draftPlays.indexOf(template.id);
            return (
              <PlayCard
                key={template.id}
                template={template}
                selected={rank >= 0}
                rank={rank + 1}
                onPress={() => togglePlay(template.id)}
              />
            );
          })}
        </View>
      </View>
    </ScreenContainer>
  );
};

export function PlayCard({
  template,
  selected,
  rank,
  onPress,
}: {
  template: PlayTemplate;
  selected?: boolean;
  rank?: number;
  onPress?: () => void;
}) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={[styles.playCard, { borderColor: familyColor(template.family) }, selected && styles.playCardSelected]}>
      <View style={styles.playHeader}>
        <Text style={styles.playName} numberOfLines={1}>{rank && rank > 0 ? `${rank}. ` : ''}{template.name}</Text>
        <Text style={[styles.familyText, { color: familyColor(template.family) }]}>{familyLabel(template.family)}</Text>
      </View>
      <Diagram template={template} />
    </Pressable>
  );
}

function Diagram({ template }: { template: PlayTemplate }) {
  return (
    <View style={styles.diagram}>
      <View style={styles.los} />
      {template.diagram.map((path, pathIndex) => (
        <React.Fragment key={`${path.label}-${pathIndex}`}>
          {path.points.slice(1).map((point, index) => (
            <Segment key={index} from={path.points[index]} to={point} color={path.color} />
          ))}
        </React.Fragment>
      ))}
    </View>
  );
}

function Segment({ from, to, color }: { from: [number, number]; to: [number, number]; color: string }) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  return (
    <View
      style={[
        styles.segment,
        {
          left: `${from[0]}%`,
          top: `${from[1]}%`,
          width: `${length}%`,
          backgroundColor: color,
          transform: [{ rotate: `${angle}deg` }],
        },
      ]}
    />
  );
}

function familyLabel(family: string): string {
  return family.replace(/_/g, ' ');
}

function familyColor(family: string): string {
  if (family.includes('RUN')) return colors.identity.run;
  if (family.includes('PASS') || family === 'PLAY_ACTION') return colors.identity.pass;
  if (family.includes('BLITZ')) return colors.identity.agg;
  if (family.includes('ZONE') || family.includes('MAN')) return colors.identity.prv;
  return colors.identity.bal;
}

const styles = StyleSheet.create({
  title: { marginTop: spacing.xs },
  schemeTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  schemeTab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  schemeTabActive: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  schemeTabText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '700',
  },
  schemeTabTextActive: { color: colors.bg.base },
  input: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.md,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...typography.label,
    color: colors.bg.base,
    fontWeight: '800',
  },
  deleteButton: {
    minHeight: 42,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    ...typography.label,
    color: colors.danger,
  },
  playGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  playCard: {
    width: '31.5%',
    minWidth: 108,
    borderRadius: radius.md,
    borderWidth: 2,
    padding: spacing.sm,
    backgroundColor: colors.bg.elevated,
  },
  playCardSelected: {
    backgroundColor: colors.bg.surface,
  },
  playHeader: {
    minHeight: 42,
    gap: spacing.xs,
  },
  playName: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '800',
  },
  familyText: {
    fontSize: 9,
    fontWeight: '800',
  },
  diagram: {
    height: 92,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  los: {
    position: 'absolute',
    left: '0%',
    right: '0%',
    top: '74%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  segment: {
    position: 'absolute',
    height: 3,
    borderRadius: 2,
    transformOrigin: 'left center' as any,
  },
});
