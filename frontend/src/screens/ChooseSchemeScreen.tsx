import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NavigationProp, RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/client';
import { PlayCategory, PlayTemplate, RosterPlayer, TeamScheme } from '../api/types';
import { Card } from '../components/Card';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionLabel } from '../components/SectionLabel';
import { useUserTeamId } from '../state/userTeam';
import { colors, radius, spacing, typography } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { templatesForUnit } from '../data/playTemplates';

export const ChooseSchemeScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'ChooseScheme'>>();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { unit } = route.params;
  const userTeamId = useUserTeamId();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [draftName, setDraftName] = React.useState('');
  const [draftPlays, setDraftPlays] = React.useState<string[]>([]);
  const [expandedPlayId, setExpandedPlayId] = React.useState<string | null>(null);
  const [subFromPlayId, setSubFromPlayId] = React.useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = React.useState<PlayCategory | 'ALL'>('ALL');
  const [nameQuery, setNameQuery] = React.useState('');
  const [sortByOvr, setSortByOvr] = React.useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['schemes', userTeamId, unit],
    queryFn: () => api.schemes(userTeamId!, unit),
    enabled: !!userTeamId,
  });

  const { data: rosterData } = useQuery({
    queryKey: ['roster', userTeamId],
    queryFn: () => api.roster(userTeamId!),
    enabled: !!userTeamId,
  });

  const schemes = data?.schemes ?? [];
  const templates = templatesForUnit(unit);
  const unitCategories = React.useMemo(
    () => Array.from(new Set(templates.map((t) => t.category))),
    [templates],
  );
  const active = schemes.find((scheme) => scheme.id === activeId) ?? schemes[0] ?? null;

  React.useEffect(() => {
    if (!active) return;
    setActiveId(active.id);
    setDraftName(active.name);
    setDraftPlays(active.plays);
    setExpandedPlayId(null);
    setSubFromPlayId(null);
  }, [active?.id]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['schemes', userTeamId, unit] });
    queryClient.invalidateQueries({ queryKey: ['roster', userTeamId] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', userTeamId] });
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

  const setActiveScheme = useMutation({
    mutationFn: (scheme: TeamScheme) => api.updateScheme(userTeamId!, scheme.id, { isDefault: true }),
    onSuccess: (scheme) => {
      setActiveId(scheme.id);
      refresh();
    },
  });

  const slotMap = React.useMemo(() => buildSlotMap(rosterData?.groups.flatMap((group) => group.players) ?? []), [rosterData]);

  if (!userTeamId || isLoading) {
    return <ScreenContainer><ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing.xxxl }} /></ScreenContainer>;
  }
  if (error || !active) {
    return <ScreenContainer><Text style={typography.body}>Failed to load schemes.</Text></ScreenContainer>;
  }

  const selectedTemplates = draftPlays
    .map((id) => templates.find((template) => template.id === id))
    .filter((template): template is PlayTemplate => !!template);
  const selectedIds = new Set(draftPlays);
  const trimmedQuery = nameQuery.trim().toLowerCase();
  let availableTemplates = templates.filter((template) => !selectedIds.has(template.id));
  if (categoryFilter !== 'ALL') {
    availableTemplates = availableTemplates.filter((t) => t.category === categoryFilter);
  }
  if (trimmedQuery) {
    availableTemplates = availableTemplates.filter((t) => t.name.toLowerCase().includes(trimmedQuery));
  }
  if (sortByOvr) {
    availableTemplates = [...availableTemplates].sort(
      (a, b) => (playOverall(b, slotMap) ?? 0) - (playOverall(a, slotMap) ?? 0),
    );
  }
  const subMode = subFromPlayId != null;
  const sourceInScheme = subFromPlayId ? selectedIds.has(subFromPlayId) : false;
  const visibleSelected = subMode
    ? (sourceInScheme ? selectedTemplates.filter((t) => t.id === subFromPlayId) : selectedTemplates)
    : selectedTemplates;
  const visibleAvailable = subMode
    ? (sourceInScheme
        ? availableTemplates
        : (templates.filter((t) => t.id === subFromPlayId)))
    : availableTemplates;
  const filtersActive = categoryFilter !== 'ALL' || trimmedQuery.length > 0;

  const togglePlay = (playId: string) => {
    setExpandedPlayId((prev) => (prev === playId ? null : playId));
  };

  const enterSubMode = (sourcePlayId: string) => {
    setSubFromPlayId(sourcePlayId);
    setExpandedPlayId(null);
  };

  const exitSubMode = () => {
    setSubFromPlayId(null);
    setExpandedPlayId(null);
  };

  const confirmSwap = (candidateId: string) => {
    if (!subFromPlayId) return;
    if (sourceInScheme) {
      if (selectedIds.has(candidateId)) return;
      setDraftPlays(draftPlays.map((id) => (id === subFromPlayId ? candidateId : id)));
    } else {
      if (!selectedIds.has(candidateId)) return;
      setDraftPlays(draftPlays.map((id) => (id === candidateId ? subFromPlayId : id)));
    }
    setSubFromPlayId(null);
    setExpandedPlayId(null);
  };

  const subPropsFor = (playId: string) => {
    if (!subMode) return { label: 'Sub', onPress: () => enterSubMode(playId) };
    if (playId === subFromPlayId) return { label: 'Cancel', onPress: exitSubMode };
    return { label: 'Sub', onPress: () => confirmSwap(playId) };
  };

  return (
    <ScreenContainer>
      <View style={styles.identityBlock}>
        <View style={styles.identityTopRow}>
          <View style={styles.identityLabelGroup}>
            <Text style={styles.identityHeaderLabel}>{unit === 'offense' ? 'Offensive Scheme' : 'Defensive Scheme'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.homeButton, pressed && styles.homeButtonPressed]}
          >
            <Ionicons name="home-outline" size={16} color={colors.text.primary} />
            <Text style={styles.homeButtonText}>Home</Text>
          </Pressable>
        </View>
        <View style={styles.identityValue}>
          <Text style={styles.identityArchetype} numberOfLines={1}>Choose Scheme</Text>
        </View>
      </View>

      <View style={styles.schemeTabs}>
        {schemes.map((scheme) => (
          <Pressable
            key={scheme.id}
            onPress={() => setActiveId(scheme.id)}
            style={[styles.schemeTab, scheme.id === active.id && styles.schemeTabActive]}
          >
            <Text style={[styles.schemeTabText, scheme.id === active.id && styles.schemeTabTextActive]}>{scheme.name}</Text>
            {scheme.isDefault && <Text style={styles.activeSchemeText}>Active</Text>}
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
            <Pressable disabled={setActiveScheme.isPending} onPress={() => setActiveScheme.mutate(active)} style={styles.activeButton}>
              <Text style={styles.activeButtonText}>{setActiveScheme.isPending ? 'Setting...' : 'Set Active'}</Text>
            </Pressable>
          )}
          {!active.isDefault && (
            <Pressable disabled={remove.isPending} onPress={() => remove.mutate(active)} style={styles.deleteButton}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </Pressable>
          )}
        </View>
      </Card>

      <View>
        <View style={styles.sectionHeader}>
          <SectionLabel>Selected Plays</SectionLabel>
          <Text style={[typography.caption, draftPlays.length === 9 ? styles.countReady : styles.countWarning]}>
            {draftPlays.length}/9
          </Text>
        </View>
        <View style={styles.playList}>
          {visibleSelected.map((template) => {
            const sub = subPropsFor(template.id);
            const expanded = expandedPlayId === template.id;
            const isSource = subFromPlayId === template.id;
            return (
              <PlayCard
                key={template.id}
                template={template}
                slotMap={slotMap}
                isExpanded={expanded}
                showAction={isSource || expanded}
                onToggle={() => togglePlay(template.id)}
                onPressSub={sub.onPress}
                subLabel={sub.label}
              />
            );
          })}
        </View>
      </View>

      <View>
        <SectionLabel>Available Plays</SectionLabel>
        {!subMode && (
          <View style={styles.filterBlock}>
            <View style={styles.searchRow}>
              <TextInput
                value={nameQuery}
                onChangeText={setNameQuery}
                placeholder="Search plays by name"
                placeholderTextColor={colors.text.muted}
                style={[styles.input, styles.searchInput]}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {nameQuery.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => setNameQuery('')}
                  style={styles.searchClear}
                >
                  <Ionicons name="close" size={16} color={colors.text.secondary} />
                </Pressable>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRowContent}
            >
              <Pressable
                onPress={() => setCategoryFilter('ALL')}
                style={[styles.categoryChip, categoryFilter === 'ALL' && styles.categoryChipActive]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    categoryFilter === 'ALL' && styles.categoryChipTextActive,
                  ]}
                >
                  All
                </Text>
              </Pressable>
              {unitCategories.map((category) => {
                const sample = templates.find((t) => t.category === category);
                if (!sample) return null;
                const isActive = categoryFilter === category;
                return (
                  <Pressable
                    key={category}
                    onPress={() => setCategoryFilter(category)}
                    style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                  >
                    <View style={[styles.categoryChipStripe, { backgroundColor: sample.categoryColor }]} />
                    <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                      {sample.categoryLabel}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setSortByOvr((prev) => !prev)}
                style={[styles.sortToggle, sortByOvr && styles.sortToggleActive]}
              >
                <Ionicons
                  name="swap-vertical"
                  size={12}
                  color={sortByOvr ? colors.bg.base : colors.text.secondary}
                />
                <Text style={[styles.sortToggleText, sortByOvr && styles.sortToggleTextActive]}>
                  Sort: OVR
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        )}
        <View style={styles.playList}>
          {visibleAvailable.length === 0 && filtersActive ? (
            <Text style={styles.emptyText}>No plays match your filters.</Text>
          ) : (
            visibleAvailable.map((template) => {
              const sub = subPropsFor(template.id);
              const expanded = expandedPlayId === template.id;
              const isSource = subFromPlayId === template.id;
              return (
                <PlayCard
                  key={template.id}
                  template={template}
                  slotMap={slotMap}
                  isExpanded={expanded}
                  showAction={isSource || expanded}
                  onToggle={() => togglePlay(template.id)}
                  onPressSub={sub.onPress}
                  subLabel={sub.label}
                />
              );
            })
          )}
        </View>
      </View>
    </ScreenContainer>
  );
};

function PlayCard({
  template,
  slotMap,
  isExpanded,
  showAction,
  onToggle,
  onPressSub,
  subLabel,
}: {
  template: PlayTemplate;
  slotMap: Record<string, RosterPlayer | undefined>;
  isExpanded: boolean;
  showAction: boolean;
  onToggle: () => void;
  onPressSub: () => void;
  subLabel: string;
}) {
  const overall = playOverall(template, slotMap);
  const isCancel = subLabel === 'Cancel';
  return (
    <View style={[styles.playCard, isExpanded && styles.playCardExpanded]}>
      <Pressable onPress={onToggle} style={styles.playCardRow}>
        <View style={[styles.categoryStripe, { backgroundColor: template.categoryColor }]} />
        <View style={styles.playCardMain}>
          <View style={{ flex: 1 }}>
            <Text style={styles.playName} numberOfLines={1}>{template.name}</Text>
            <Text style={[styles.familyText, { color: template.categoryColor }]}>{template.categoryLabel}</Text>
          </View>
          <View style={styles.rowOvrBlock}>
            <Text style={styles.rowOvrText}>{overall ?? '--'}</Text>
            <Text style={styles.rowOvrLabel}>OVR</Text>
          </View>
        </View>
      </Pressable>
      {(isExpanded || showAction) && (
        <View style={styles.playExpand}>
          {isExpanded && (
            <>
              <PlaySketch play={template} />
              <View style={styles.playerChipRow}>
                {template.keySlots.map((slot, index) => {
                  const player = slotMap[slot];
                  return (
                    <View key={`${slot}-${index}`} style={styles.playerChip}>
                      <View style={styles.playerIcon}>
                        <Text style={styles.playerIconText}>{player ? initials(player.name) : slot.slice(0, 2)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.playerName} numberOfLines={1}>{player ? shortName(player.name) : slot}</Text>
                        <Text style={styles.slotText}>{slot}{player ? ` / ${player.overall}` : ''}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}
          {showAction && (
            <Pressable onPress={onPressSub} style={[styles.subButton, isCancel && styles.subButtonCancel]}>
              <Text style={[styles.subButtonText, isCancel && styles.subButtonCancelText]}>{subLabel}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function PlaySketch({ play }: { play: PlayTemplate }) {
  const isOffense = play.unit === 'offense';
  const laneColor = play.categoryColor;
  const lanes = isOffense
    ? [
        { left: '16%', top: '64%', width: '26%', rotate: '-24deg' },
        { left: '42%', top: '62%', width: '30%', rotate: play.category === 'RUNNING' ? '4deg' : '-42deg' },
        { left: '58%', top: '64%', width: '24%', rotate: '28deg' },
      ]
    : [
        { left: '18%', top: '36%', width: '24%', rotate: '18deg' },
        { left: '40%', top: '34%', width: '28%', rotate: '90deg' },
        { left: '62%', top: '36%', width: '24%', rotate: '-18deg' },
      ];
  return (
    <View style={styles.sketch}>
      <View style={styles.sketchLine} />
      <View style={[styles.sketchBall, { top: isOffense ? '70%' : '28%' }]} />
      {lanes.map((lane, index) => (
        <View
          key={index}
          style={[
            styles.sketchLane,
            {
              left: lane.left as any,
              top: lane.top as any,
              width: lane.width as any,
              backgroundColor: laneColor,
              transform: [{ rotate: lane.rotate }],
            },
          ]}
        />
      ))}
    </View>
  );
}

function buildSlotMap(players: RosterPlayer[]): Record<string, RosterPlayer | undefined> {
  const byPosition = (position: string) => players
    .filter((player) => player.position === position)
    .sort((a, b) => b.overall - a.overall);
  const qb = byPosition('QB');
  const rb = byPosition('RB');
  const wr = byPosition('WR');
  const te = byPosition('TE');
  const ol = byPosition('OL');
  const de = byPosition('DE');
  const dt = byPosition('DT');
  const lb = byPosition('LB');
  const cb = byPosition('CB');
  const s = byPosition('S');
  return {
    QB: qb[0],
    RB: rb[0],
    WR: wr[0],
    TE: te[0],
    T: ol[0],
    G: ol[1],
    C: ol[2],
    EDGE1: de[0],
    EDGE2: de[1],
    DT1: dt[0],
    DT2: dt[1],
    MLB: lb[0],
    WLB: lb[1],
    SLB: lb[2],
    CB1: cb[0],
    CB2: cb[1],
    NCB: cb[2],
    FS: s[0],
    SS: s[1],
  };
}

function playOverall(play: PlayTemplate, slotMap: Record<string, RosterPlayer | undefined>): number | null {
  const players = play.keySlots.map((slot) => slotMap[slot]).filter((player): player is RosterPlayer => !!player);
  if (players.length === 0) return null;
  return Math.round(players.reduce((sum, player) => sum + player.overall, 0) / players.length);
}

function initials(name: string): string {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function shortName(name: string): string {
  const [first, ...rest] = name.split(' ');
  return `${first.charAt(0)}. ${rest.join(' ') || first}`.trim();
}

const styles = StyleSheet.create({
  identityBlock: {
    gap: spacing.xs,
  },
  identityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  identityLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: spacing.xs,
  },
  identityHeaderLabel: {
    ...typography.heading,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  homeButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  homeButtonPressed: {
    backgroundColor: colors.bg.elevated,
  },
  homeButtonText: {
    ...typography.label,
    color: colors.text.primary,
  },
  identityValue: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  identityArchetype: {
    ...typography.display,
    color: colors.text.primary,
    flexShrink: 1,
    minWidth: 0,
  },
  schemeTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  schemeTab: {
    minWidth: 92,
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
  activeSchemeText: {
    ...typography.caption,
    color: colors.success,
    fontSize: 9,
    fontWeight: '900',
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
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
    flexWrap: 'wrap',
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
  activeButton: {
    minHeight: 42,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeButtonText: {
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countReady: {
    color: colors.success,
    fontWeight: '800',
  },
  countWarning: {
    color: colors.warn,
    fontWeight: '800',
  },
  playList: {
    gap: spacing.sm,
  },
  playCard: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  playCardExpanded: {
    borderColor: colors.accent.primary,
  },
  playCardRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryStripe: {
    width: 4,
    alignSelf: 'stretch',
  },
  playCardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
  },
  playExpand: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  subButton: {
    paddingVertical: spacing.md,
    backgroundColor: colors.accent.primary,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  subButtonText: {
    ...typography.label,
    color: colors.bg.elevated,
    fontWeight: '800',
  },
  subButtonCancel: {
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subButtonCancelText: {
    color: colors.text.primary,
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
  rowOvrBlock: {
    width: 48,
    minHeight: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowOvrText: {
    ...typography.heading,
    color: colors.accent.primary,
    fontSize: 18,
  },
  rowOvrLabel: {
    ...typography.caption,
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '800',
  },
  slotText: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: spacing.xs,
    fontSize: 10,
  },
  sketch: {
    height: 150,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sketchLine: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    top: '50%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  sketchBall: {
    position: 'absolute',
    left: '48%',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.text.secondary,
  },
  sketchLane: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    transformOrigin: 'left center' as any,
  },
  playerChipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  playerChip: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerIconText: {
    ...typography.caption,
    color: colors.text.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  playerName: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '700',
  },
  filterBlock: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  searchInput: {
    marginTop: 0,
    paddingRight: 36,
  },
  searchClear: {
    position: 'absolute',
    right: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.elevated,
  },
  chipRowContent: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  categoryChipStripe: {
    width: 4,
    height: 14,
    borderRadius: 2,
  },
  categoryChipText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: colors.bg.base,
  },
  sortToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortToggleActive: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  sortToggleText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '700',
  },
  sortToggleTextActive: {
    color: colors.bg.base,
  },
  emptyText: {
    ...typography.caption,
    color: colors.text.muted,
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
});
