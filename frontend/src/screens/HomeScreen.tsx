import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import { ScreenContainer } from '../components/ScreenContainer';
import { Card } from '../components/Card';
import { Pill, pillColor, pillLabel } from '../components/Pill';
import { SectionLabel } from '../components/SectionLabel';
import { FormDots } from '../components/FormDots';
import { api } from '../api/client';
import { useUserTeamId } from '../state/userTeam';
import { colors, spacing, typography, radius } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { RosterPlayer, StaffActionEntry, TrainMode } from '../api/types';

export const HomeScreen: React.FC = () => {
  const userTeamId = useUserTeamId();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const [trainOpen, setTrainOpen] = React.useState(false);
  const [trainMode, setTrainMode] = React.useState<TrainMode>('STRENGTH');
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', userTeamId],
    queryFn: () => api.dashboard(userTeamId!),
    enabled: !!userTeamId,
  });

  const refreshAfterAction = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', userTeamId] });
    queryClient.invalidateQueries({ queryKey: ['roster', userTeamId] });
    queryClient.invalidateQueries({ queryKey: ['market', userTeamId] });
  };

  const train = useMutation({
    mutationFn: ({ playerId, mode }: { playerId: string; mode: TrainMode }) => api.trainPlayer(userTeamId!, playerId, mode),
    onSuccess: (res) => {
      setTrainOpen(false);
      if (res.mode === 'STRENGTH') {
        setActionMessage(
          res.player.delta > 0
            ? `${res.player.name}: ${res.player.position} +${res.player.delta} OVR → ${res.player.overall}${res.specialtyMatch ? ' (specialty match)' : ''}`
            : `${res.player.name} is already at potential.`
        );
      } else {
        setActionMessage(
          `${res.player.name}: +${res.player.weeksAdded}w conditioning (now ${res.player.conditioning})${res.specialtyMatch ? ' (specialty match)' : ''}`
        );
      }
      refreshAfterAction();
    },
    onError: (err) => setActionMessage(err instanceof Error ? err.message : 'Train failed'),
  });

  const recruit = useMutation({
    mutationFn: () => api.recruit(userTeamId!),
    onSuccess: (res) => {
      const names = res.listings.map((p) => `${p.position} ${p.name}`).join(', ');
      setActionMessage(`Scouted (${res.specialty}): ${names}`);
      refreshAfterAction();
    },
    onError: (err) => setActionMessage(err instanceof Error ? err.message : 'Recruit failed'),
  });

  // Auto-refetch on focus so morale/next-match update after a sim
  React.useEffect(() => {
    const unsub = navigation.addListener('focus', () => refetch());
    return unsub;
  }, [navigation, refetch]);

  if (!userTeamId || isLoading) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing.xxxl }} />
      </ScreenContainer>
    );
  }

  if (error || !data) {
    return (
      <ScreenContainer>
        <Text style={typography.body}>Failed to load dashboard. Is the backend running?</Text>
      </ScreenContainer>
    );
  }

  const { team, nextMatch, recentResult, standingsPosition, recentForm, news } = data;
  const lineupBlocked = data.lineupReadiness?.blocked ?? false;
  const minorWarning = data.lineupReadiness?.warnings?.[0]?.message ?? null;

  return (
    <ScreenContainer>
      {/* ── Team Header ──────────────────────────────────── */}
      <View>
        <View style={styles.headerRow}>
          <Text style={typography.label}>{team.leagueName}</Text>
          {recentForm.lastResults.length > 0 && (
            <FormDots results={recentForm.lastResults} streak={recentForm.streak} />
          )}
        </View>
        <Text style={[typography.display, { marginTop: spacing.xs }]}>{team.name}</Text>
        <View style={styles.identityRow}>
          <Pill label={pillLabel(team.offenseStyle)} color={pillColor(team.offenseStyle)} />
          <Pill label={pillLabel(team.defenseStyle)} color={pillColor(team.defenseStyle)} />
          <Pill label={pillLabel(team.tempo)}        color={pillColor(team.tempo)} />
        </View>
      </View>

      {/* ── Primary Action: Next Match ───────────────────── */}
      {nextMatch ? (
        <Pressable
          onPress={() => lineupBlocked ? navigation.navigate('Team' as never) : navigation.navigate('MatchPreview', { matchId: nextMatch.id })}
          style={({ pressed }) => [styles.matchButton, lineupBlocked && styles.matchButtonBlocked, pressed && (lineupBlocked ? styles.matchButtonBlockedPressed : styles.actionButtonPressed)]}
        >
          <View style={styles.matchButtonTopRow}>
            <Text style={[styles.matchButtonLabel, lineupBlocked && styles.matchButtonBlockedText]}>
              {lineupBlocked ? 'Deal with injured player' : `Week ${nextMatch.week} · ${nextMatch.isHome ? 'Home' : 'Away'}`}
            </Text>
            {!lineupBlocked && <Text style={styles.actionArrowLight}>→</Text>}
          </View>
          <Text style={styles.matchButtonOpponent}>
            {nextMatch.isHome ? 'vs' : '@'} {nextMatch.opponent.name}
          </Text>
          {lineupBlocked && (
            <Text style={styles.blockedDetail} numberOfLines={2}>
              {data.lineupReadiness.blockers[0]?.message}
            </Text>
          )}
          {!lineupBlocked && minorWarning && (
            <Text style={styles.warningDetail} numberOfLines={2}>{minorWarning}</Text>
          )}
          <View style={styles.identityRow}>
            <Pill label={pillLabel(nextMatch.opponent.offenseStyle)} color={pillColor(nextMatch.opponent.offenseStyle)} />
            <Pill label={pillLabel(nextMatch.opponent.defenseStyle)} color={pillColor(nextMatch.opponent.defenseStyle)} />
          </View>
        </Pressable>
      ) : (
        <Card>
          <Text style={typography.body}>Season complete. No upcoming matches.</Text>
        </Card>
      )}

      {/* ── Staff Action Buttons ─────────────────────────── */}
      {data.staffActions && (
        <View>
          <View style={styles.actionRow}>
            <ActionButton
              label="Train"
              entry={data.staffActions.train}
              busy={train.isPending}
              onPress={() => setTrainOpen(true)}
            />
            <ActionButton
              label="Recruit"
              entry={data.staffActions.recruit}
              busy={recruit.isPending}
              onPress={() => recruit.mutate()}
            />
          </View>
          {actionMessage && (
            <Text style={[typography.caption, styles.actionMessage]} numberOfLines={3}>
              {actionMessage}
            </Text>
          )}
        </View>
      )}

      <TrainModal
        visible={trainOpen}
        mode={trainMode}
        onModeChange={setTrainMode}
        onClose={() => setTrainOpen(false)}
        onPick={(playerId) => train.mutate({ playerId, mode: trainMode })}
      />

      {/* ── Two-up: Standings + Last Result ──────────────── */}
      <View style={styles.twoUp}>
        <Card style={styles.halfCard}>
          <SectionLabel>Standings</SectionLabel>
          <Text style={typography.title}>
            {standingsPosition.rank != null ? String(standingsPosition.rank) : '—'}
            <Text style={typography.caption}>{` / ${standingsPosition.total}`}</Text>
          </Text>
          <Text style={typography.caption}>
            {standingsPosition.wins}-{standingsPosition.losses}
            {standingsPosition.ties > 0 ? `-${standingsPosition.ties}` : ''}
          </Text>
        </Card>

        <Card style={styles.halfCard}>
          <SectionLabel>Last Week</SectionLabel>
          {recentResult ? (
            <>
              <Text style={[typography.title, {
                color: recentResult.result === 'W' ? colors.success
                     : recentResult.result === 'L' ? colors.danger
                     : colors.text.secondary
              }]}>
                {recentResult.result} {recentResult.myScore}–{recentResult.theirScore}
              </Text>
              <Text style={typography.caption} numberOfLines={1}>
                vs {recentResult.opponentName}
              </Text>
            </>
          ) : (
            <Text style={typography.caption}>No matches played yet.</Text>
          )}
        </Card>
      </View>

      {/* ── Morale Gauge ─────────────────────────────────── */}
      <Card>
        <SectionLabel>Team Morale</SectionLabel>
        <View style={styles.moraleRow}>
          <View style={styles.moraleBarBg}>
            <View style={[
              styles.moraleBarFill,
              {
                width: `${team.morale}%`,
                backgroundColor: team.morale >= 70 ? colors.success
                               : team.morale >= 40 ? colors.warn
                               : colors.danger,
              },
            ]} />
          </View>
          <Text style={[typography.heading, { width: 36, textAlign: 'right' }]}>
            {team.morale}
          </Text>
        </View>
      </Card>

      {/* ── League News ─────────────────────────────────── */}
      {news && news.length > 0 && (
        <View>
          <SectionLabel>Around the League</SectionLabel>
          {news.map((item, idx) => (
            <Card key={idx} style={styles.newsCard}>
              <View style={styles.newsRow}>
                <View style={[styles.newsCategoryDot, { backgroundColor: newsCategoryColor(item.category) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { fontWeight: '600' }]} numberOfLines={2}>
                    {item.headline}
                  </Text>
                  <Text style={[typography.caption, { marginTop: spacing.xs }]} numberOfLines={2}>
                    {item.summary}
                  </Text>
                  {item.leagueName && (
                    <Text style={[typography.label, { marginTop: spacing.xs, fontSize: 10 }]}>
                      {item.sourceName}
                    </Text>
                  )}
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
};

function ActionButton({
  label,
  entry,
  busy,
  onPress,
}: {
  label: string;
  entry: StaffActionEntry;
  busy: boolean;
  onPress: () => void;
}) {
  const disabled = !entry.available || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        disabled ? styles.actionButtonDisabled : styles.actionButtonActive,
        pressed && !disabled && styles.actionButtonPressed,
      ]}
    >
      <View style={styles.actionTopRow}>
        <Text style={[styles.actionLabel, disabled ? styles.actionLabelDisabled : styles.actionLabelActive]}>
          {label}
        </Text>
        {!disabled && (
          <Text style={styles.actionArrow}>→</Text>
        )}
      </View>
      <Text style={[styles.actionMeta, disabled ? styles.actionMetaDisabled : styles.actionMetaActive]} numberOfLines={1}>
        {entry.available ? formatMoney(entry.cost) : entry.reason ?? 'Unavailable'}
      </Text>
      {entry.specialty && entry.available && (
        <Text style={styles.actionSpecialty} numberOfLines={1}>
          {entry.specialty}
        </Text>
      )}
    </Pressable>
  );
}

function TrainModal({
  visible,
  mode,
  onModeChange,
  onClose,
  onPick,
}: {
  visible: boolean;
  mode: TrainMode;
  onModeChange: (mode: TrainMode) => void;
  onClose: () => void;
  onPick: (playerId: string) => void;
}) {
  const userTeamId = useUserTeamId();
  const { data: roster, isLoading } = useQuery({
    queryKey: ['roster', userTeamId],
    queryFn: () => api.roster(userTeamId!),
    enabled: !!userTeamId && visible,
  });

  if (!visible) return null;

  const allPlayers: RosterPlayer[] = roster?.groups.flatMap((g) => g.players) ?? [];
  const sorted = mode === 'STRENGTH'
    ? [...allPlayers].sort((a, b) => (b.potential - b.overall) - (a.potential - a.overall) || b.overall - a.overall)
    : [...allPlayers].sort((a, b) => b.fatigue - a.fatigue || a.conditioning - b.conditioning);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={typography.label}>Train a player</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={[typography.heading, { color: colors.text.secondary }]}>x</Text>
            </Pressable>
          </View>

          <View style={styles.modeToggle}>
            <ModePill label="Strength" active={mode === 'STRENGTH'} onPress={() => onModeChange('STRENGTH')} />
            <ModePill label="Conditioning" active={mode === 'CONDITIONING'} onPress={() => onModeChange('CONDITIONING')} />
          </View>
          <Text style={[typography.caption, { marginTop: spacing.xs }]}>
            {mode === 'STRENGTH'
              ? 'Lift the player\'s overall (+1, or +2 with specialty match). Capped at potential.'
              : 'Add weeks of injury resistance (+3, or +4 with specialty match).'}
          </Text>

          {isLoading ? (
            <ActivityIndicator color={colors.accent.primary} style={{ marginVertical: spacing.xl }} />
          ) : sorted.length === 0 ? (
            <Text style={[typography.body, { color: colors.text.muted, paddingVertical: spacing.lg }]}>
              Roster is empty.
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 440 }}>
              {sorted.map((player) => (
                <Pressable
                  key={player.id}
                  onPress={() => onPick(player.id)}
                  style={({ pressed }) => [styles.pickerRow, pressed && { backgroundColor: colors.bg.surface }]}
                >
                  <View style={styles.pickerBadge}>
                    <Text style={styles.pickerBadgeText}>{player.position}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[typography.body, { fontWeight: '700' }]} numberOfLines={1}>{player.name}</Text>
                    <Text style={typography.caption} numberOfLines={1}>
                      {mode === 'STRENGTH'
                        ? `OVR ${player.overall} / POT ${player.potential} / age ${player.age}`
                        : `Fatigue ${player.fatigue} / conditioning ${player.conditioning}w`}
                    </Text>
                  </View>
                  <Text style={[typography.heading, { color: colors.accent.primary }]}>{player.overall}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ModePill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.modePill, active && styles.modePillActive]}>
      <Text style={[styles.modePillText, active && styles.modePillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function formatMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(value / 1_000)}K`;
}

function newsCategoryColor(category: string): string {
  switch (category) {
    case 'BLOWOUT':  return colors.identity.run;
    case 'UPSET':    return colors.warn;
    case 'THRILLER': return colors.identity.pass;
    case 'STREAK':   return colors.success;
    case 'COACH':    return colors.danger;
    case 'PLAYER':   return colors.accent.primary;
    case 'STANDINGS':return colors.text.secondary;
    default:         return colors.text.muted;
  }
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems:    'center',
  },
  newsCard: {
    marginBottom: spacing.sm,
  },
  newsRow: {
    flexDirection: 'row',
    gap:           spacing.md,
    alignItems:    'flex-start',
  },
  newsCategoryDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    marginTop:    7,
  },
  identityRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginTop:     spacing.md,
    flexWrap:      'wrap',
  },
  twoUp: {
    flexDirection: 'row',
    gap:           spacing.md,
  },
  halfCard: {
    flex: 1,
  },
  moraleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
  },
  moraleBarBg: {
    flex:            1,
    height:          10,
    backgroundColor: colors.bg.surface,
    borderRadius:    radius.pill,
    overflow:        'hidden',
  },
  moraleBarFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  actionRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  actionButton: {
    flex:            1,
    minHeight:       86,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap:             spacing.xs,
    justifyContent:  'center',
  },
  fullWidthAction: {
    flex:      0,
    minHeight: 76,
  },
  actionButtonActive: {
    backgroundColor: colors.accent.primary,
    borderWidth:     0,
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionButtonDisabled: {
    backgroundColor: colors.bg.elevated,
    borderWidth:     1,
    borderColor:     colors.border,
    opacity:         0.85,
  },
  actionTopRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  actionLabel: {
    fontSize:      18,
    fontWeight:    '800',
    letterSpacing: 0.4,
  },
  actionLabelActive: {
    color: colors.text.primary,
  },
  actionLabelDisabled: {
    color: colors.text.muted,
  },
  actionArrow: {
    fontSize:   18,
    fontWeight: '800',
    color:      colors.text.primary,
  },
  actionArrowLight: {
    fontSize:   22,
    fontWeight: '800',
    color:      colors.text.primary,
  },
  actionMeta: {
    fontSize:   12,
    fontWeight: '700',
  },
  actionMetaActive: {
    color: 'rgba(255,255,255,0.78)',
  },
  actionMetaDisabled: {
    color: colors.text.muted,
  },
  actionSpecialty: {
    fontSize:      10,
    fontWeight:    '700',
    color:         'rgba(255,255,255,0.7)',
    letterSpacing: 0.4,
  },
  actionMessage: {
    marginTop: spacing.sm,
    color:     colors.accent.primary,
  },
  matchButton: {
    backgroundColor:   colors.accent.primary,
    borderRadius:      radius.lg,
    padding:           spacing.lg,
    gap:               spacing.sm,
  },
  matchButtonBlocked: {
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  matchButtonBlockedPressed: {
    backgroundColor: colors.bg.elevated,
  },
  matchButtonTopRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  matchButtonLabel: {
    ...typography.label,
    color: 'rgba(255,255,255,0.78)',
  },
  matchButtonBlockedText: {
    color: colors.danger,
  },
  matchButtonOpponent: {
    ...typography.title,
    color: colors.text.primary,
  },
  blockedDetail: {
    ...typography.caption,
    color: colors.danger,
  },
  warningDetail: {
    ...typography.caption,
    color: colors.warn,
  },
  modalBackdrop: {
    flex:            1,
    backgroundColor: colors.bg.overlay,
    justifyContent:  'flex-end',
  },
  modalSheet: {
    backgroundColor:      colors.bg.elevated,
    borderTopLeftRadius:  radius.xl,
    borderTopRightRadius: radius.xl,
    padding:              spacing.lg,
    gap:                  spacing.md,
    maxHeight:            '80%',
  },
  modalHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: colors.bg.surface,
    alignItems:      'center',
    justifyContent:  'center',
  },
  pickerRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  pickerBadge: {
    minWidth:        38,
    height:          38,
    borderRadius:    radius.sm,
    backgroundColor: colors.bg.surface,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: spacing.xs,
  },
  pickerBadgeText: {
    ...typography.label,
    color: colors.text.secondary,
  },
  modeToggle: {
    flexDirection:   'row',
    backgroundColor: colors.bg.surface,
    borderRadius:    radius.md,
    padding:         spacing.xs,
    gap:             spacing.xs,
  },
  modePill: {
    flex:           1,
    minHeight:      36,
    borderRadius:   radius.sm,
    alignItems:     'center',
    justifyContent: 'center',
  },
  modePillActive: {
    backgroundColor: colors.bg.elevated,
  },
  modePillText: {
    ...typography.label,
    color: colors.text.muted,
  },
  modePillTextActive: {
    color: colors.text.primary,
  },
});
