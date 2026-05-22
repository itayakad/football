import React from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NavigationProp, RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/client';
import { PlayCategory, PlayTemplate, RosterPlayer, RosterResponse, TeamScheme } from '../api/types';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionLabel } from '../components/SectionLabel';
import { useUserTeamId } from '../state/userTeam';
import { usePlayCatalog } from '../state/playCatalog';
import { colors, radius, spacing, typography } from '../theme';
import { RootStackParamList } from '../navigation/types';

export const ChooseSchemeScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'ChooseScheme'>>();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { unit } = route.params;
  const userTeamId = useUserTeamId();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [draftPlays, setDraftPlays] = React.useState<string[]>([]);
  const [expandedPlayId, setExpandedPlayId] = React.useState<string | null>(null);
  const [subFromPlayId, setSubFromPlayId] = React.useState<string | null>(null);
  const [categoryFilters, setCategoryFilters] = React.useState<Set<PlayCategory>>(new Set());
  const [nameQuery, setNameQuery] = React.useState('');
  const [sortDir, setSortDir] = React.useState<'desc' | 'asc'>('desc');
  // Local-first edits live in localPlaysRef; flush() PATCHes any scheme whose local order
  // diverges from its server snapshot. Refs (not state) because edits shouldn't re-render
  // every other scheme — only the active scheme's draftPlays drives the UI.
  const localPlaysRef = React.useRef<Map<string, string[]>>(new Map());
  const serverPlaysRef = React.useRef<Map<string, string[]>>(new Map());

  const toggleCategory = (cat: PlayCategory) => {
    setCategoryFilters((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const { data: rosterData, isLoading, error } = useQuery({
    queryKey: ['roster', userTeamId],
    queryFn: () => api.roster(userTeamId!),
    enabled: !!userTeamId,
  });

  const { templatesForUnit, isLoading: catalogLoading } = usePlayCatalog();

  const schemes = React.useMemo(
    () => (rosterData?.schemes ?? []).filter((scheme) => scheme.unit === unit),
    [rosterData, unit],
  );
  const templates = templatesForUnit(unit);
  const unitCategories = React.useMemo(
    () => Array.from(new Set(templates.map((t) => t.category))),
    [templates],
  );
  const orderedCategories = React.useMemo(
    () => [...unitCategories].sort((a, b) => {
      const aSelected = categoryFilters.has(a) ? 0 : 1;
      const bSelected = categoryFilters.has(b) ? 0 : 1;
      return aSelected - bSelected;
    }),
    [unitCategories, categoryFilters],
  );

  const active = schemes.find((scheme) => scheme.id === activeId) ?? schemes[0] ?? null;

  // Capture server snapshot every time roster data refreshes. Update local from server
  // when the user hasn't edited (local still matches the previous server snapshot); preserve
  // local when the user has diverged so unsaved edits survive a background refetch.
  React.useEffect(() => {
    for (const scheme of schemes) {
      const prevServer = serverPlaysRef.current.get(scheme.id);
      const localValue = localPlaysRef.current.get(scheme.id);
      serverPlaysRef.current.set(scheme.id, scheme.plays);
      if (!localValue || (prevServer && sameOrder(prevServer, localValue))) {
        localPlaysRef.current.set(scheme.id, scheme.plays);
      }
    }
  }, [schemes]);

  // Load draft from local map when switching to a different scheme. Local takes priority
  // so prior unsaved edits survive a tab switch.
  React.useEffect(() => {
    if (!active) return;
    const local = localPlaysRef.current.get(active.id) ?? active.plays;
    setActiveId(active.id);
    setDraftPlays((prev) => (sameOrder(prev, local) ? prev : local));
    setExpandedPlayId(null);
    setSubFromPlayId(null);
  }, [active?.id]);

  // Reset transient UI state when switching between offense/defense.
  React.useEffect(() => {
    setActiveId(null);
    setExpandedPlayId(null);
    setSubFromPlayId(null);
    setCategoryFilters(new Set());
    setNameQuery('');
  }, [unit]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['roster', userTeamId] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', userTeamId] });
    queryClient.invalidateQueries({ queryKey: ['matchPreview'] });
  };

  // Diff every locally-tracked scheme against its server snapshot and PATCH only the
  // ones that changed. Called on screen blur, app background, and before setActiveScheme.
  const flush = React.useCallback(async () => {
    if (!userTeamId) return;
    const dirty: Array<{ schemeId: string; plays: string[] }> = [];
    for (const [schemeId, localPlays] of localPlaysRef.current) {
      const server = serverPlaysRef.current.get(schemeId);
      if (!server || sameOrder(server, localPlays)) continue;
      dirty.push({ schemeId, plays: localPlays });
    }
    if (dirty.length === 0) return;
    try {
      const results = await Promise.all(
        dirty.map(({ schemeId, plays }) => api.updateScheme(userTeamId, schemeId, { plays })),
      );
      const updates = new Map(results.map((u) => [u.id, u]));
      for (const updated of results) {
        serverPlaysRef.current.set(updated.id, updated.plays);
      }
      queryClient.setQueryData<RosterResponse | undefined>(
        ['roster', userTeamId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            schemes: old.schemes.map((s) => updates.get(s.id) ?? s),
          };
        },
      );
      // Refetch roster so derived fields (team.identity, etc.) catch up with the new
      // active-scheme plays; the setQueryData above only patches the schemes array.
      queryClient.invalidateQueries({ queryKey: ['roster', userTeamId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', userTeamId] });
      queryClient.invalidateQueries({ queryKey: ['matchPreview'] });
    } catch (err) {
      console.error('[flush] failed', err);
    }
  }, [userTeamId, queryClient]);

  const create = useMutation({
    mutationFn: () => {
      const maxN = schemes.reduce((max, s) => {
        const match = s.name.match(/^Playbook (\d+)$/);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      }, 0);
      return api.createScheme(userTeamId!, unit, `Playbook ${maxN + 1}`, []);
    },
    onSuccess: (scheme) => {
      queryClient.setQueryData<RosterResponse | undefined>(
        ['roster', userTeamId],
        (old) => {
          if (!old) return old;
          if (old.schemes.some((s) => s.id === scheme.id)) return old;
          return { ...old, schemes: [...old.schemes, scheme] };
        },
      );
      serverPlaysRef.current.set(scheme.id, scheme.plays);
      localPlaysRef.current.set(scheme.id, scheme.plays);
      setActiveId(scheme.id);
      setDraftPlays(scheme.plays);
      setExpandedPlayId(null);
      setSubFromPlayId(null);
    },
    onError: (err) => {
      console.error('[createScheme] failed', err);
      Alert.alert('Could not create playbook', err instanceof Error ? err.message : 'Unknown error');
    },
  });

  const remove = useMutation({
    mutationFn: (scheme: TeamScheme) => api.deleteScheme(userTeamId!, scheme.id),
    onSuccess: (_, scheme) => {
      localPlaysRef.current.delete(scheme.id);
      serverPlaysRef.current.delete(scheme.id);
      setActiveId(null);
      refresh();
    },
  });

  const setActiveScheme = useMutation({
    mutationFn: (scheme: TeamScheme) => api.updateScheme(userTeamId!, scheme.id, { isDefault: true }),
    onSuccess: (scheme) => {
      queryClient.setQueryData<RosterResponse | undefined>(
        ['roster', userTeamId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            schemes: old.schemes.map((s) => {
              if (s.unit !== scheme.unit) return s;
              return s.id === scheme.id ? { ...s, isDefault: true } : { ...s, isDefault: false };
            }),
          };
        },
      );
      setActiveId(scheme.id);
      // Refetch roster so team.identity reflects the new default scheme's plays.
      queryClient.invalidateQueries({ queryKey: ['roster', userTeamId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', userTeamId] });
      queryClient.invalidateQueries({ queryKey: ['matchPreview'] });
    },
  });

  // Flush on screen blur (back nav, parent navigator switch, etc.).
  useFocusEffect(
    React.useCallback(() => {
      return () => { void flush(); };
    }, [flush]),
  );

  // Flush on app background so swipe-to-home doesn't lose edits.
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        void flush();
      }
    });
    return () => sub.remove();
  }, [flush]);

  // ── Add new playbook: create immediately on the backend (relaxed: empty is fine) ──
  const addNewScheme = () => {
    if (create.isPending) return;
    create.mutate();
  };

  // Completion derives from local edits (not server state) so the navigation guard reflects
  // what we're about to save on flush, not what was last persisted. Reads from localPlaysRef
  // for correctness (the play-edit handlers mirror into the ref inside the setDraftPlays
  // updater, so it's always in sync); draftPlays is in the deps purely to trigger re-eval.
  const hasCompletePlaybook = React.useMemo(() => {
    void draftPlays;
    for (const scheme of schemes) {
      const local = localPlaysRef.current.get(scheme.id) ?? scheme.plays;
      if (local.length === 9) return true;
    }
    return false;
  }, [schemes, draftPlays]);
  const activeIsComplete = !!active && (localPlaysRef.current.get(active.id) ?? active.plays).length === 9;

  // ── Guard navigation away when no playbook is complete ──
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (hasCompletePlaybook && activeIsComplete) return;
      event.preventDefault();
      Alert.alert(
        'Finish your playbook',
        hasCompletePlaybook
          ? 'The playbook you\'re editing has fewer than 9 plays. Fill the last slots before leaving.'
          : 'No playbook for this unit has 9 plays yet. Fill all 9 slots in at least one playbook before leaving.',
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Leave anyway', style: 'destructive', onPress: () => {
            unsubscribe();
            navigation.dispatch(event.data.action);
          } },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, hasCompletePlaybook, activeIsComplete]);

  const slotMap = React.useMemo(() => buildSlotMap(rosterData?.groups.flatMap((group) => group.players) ?? []), [rosterData]);

  if (!userTeamId || isLoading || catalogLoading) {
    return <ScreenContainer><ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing.xxxl }} /></ScreenContainer>;
  }
  if (error) {
    return <ScreenContainer><Text style={typography.body}>Failed to load playbooks.</Text></ScreenContainer>;
  }

  const selectedTemplates = draftPlays
    .map((id) => templates.find((template) => template.id === id))
    .filter((template): template is PlayTemplate => !!template);
  const selectedIds = new Set(draftPlays);
  const trimmedQuery = nameQuery.trim().toLowerCase();
  let availableTemplates = templates.filter((template) => !selectedIds.has(template.id));
  if (categoryFilters.size > 0) {
    availableTemplates = availableTemplates.filter((t) => categoryFilters.has(t.category));
  }
  if (trimmedQuery) {
    availableTemplates = availableTemplates.filter((t) => t.name.toLowerCase().includes(trimmedQuery));
  }
  availableTemplates = [...availableTemplates].sort((a, b) => {
    const aOvr = playOverall(a, slotMap) ?? 0;
    const bOvr = playOverall(b, slotMap) ?? 0;
    return sortDir === 'desc' ? bOvr - aOvr : aOvr - bOvr;
  });
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
  const filtersActive = categoryFilters.size > 0 || trimmedQuery.length > 0;

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
    let next: string[];
    if (sourceInScheme) {
      if (selectedIds.has(candidateId)) return;
      next = draftPlays.map((id) => (id === subFromPlayId ? candidateId : id));
    } else {
      if (!selectedIds.has(candidateId)) return;
      next = draftPlays.map((id) => (id === candidateId ? subFromPlayId : id));
    }
    setDraftPlays(next);
    if (activeId) localPlaysRef.current.set(activeId, next);
    setSubFromPlayId(null);
    setExpandedPlayId(null);
  };

  const subPropsFor = (playId: string) => {
    if (!subMode) return { label: 'Sub', onPress: () => enterSubMode(playId) };
    if (playId === subFromPlayId) return { label: 'Cancel', onPress: exitSubMode };
    return { label: 'Sub', onPress: () => confirmSwap(playId) };
  };

  const removePlay = (playId: string) => {
    setDraftPlays((prev) => {
      const next = prev.filter((id) => id !== playId);
      if (activeId) localPlaysRef.current.set(activeId, next);
      return next;
    });
    setExpandedPlayId(null);
    setSubFromPlayId(null);
  };

  const insertPlay = (playId: string) => {
    setDraftPlays((prev) => {
      if (prev.includes(playId) || prev.length >= 9) return prev;
      const next = [...prev, playId];
      if (activeId) localPlaysRef.current.set(activeId, next);
      return next;
    });
    setExpandedPlayId(null);
    setSubFromPlayId(null);
  };

  const canSetActive = !!active && !active.isDefault && activeIsComplete;

  return (
    <ScreenContainer scroll={false}>
      {/* ── Sticky Header ── */}
      <View style={styles.stickyHeader}>
        <View style={styles.identityBlock}>
          <View style={styles.identityTopRow}>
            <View style={styles.identityLabelGroup}>
              <Text style={styles.identityHeaderLabel}>{unit === 'offense' ? 'Offensive Playbook' : 'Defensive Playbook'}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Switch to ${unit === 'offense' ? 'defensive' : 'offensive'} playbook`}
                onPress={() => {
                  void flush();
                  navigation.setParams({ unit: unit === 'offense' ? 'defense' : 'offense' } as any);
                }}
                style={({ pressed }) => [styles.switchUnitButton, pressed && styles.switchUnitButtonPressed]}
                hitSlop={6}
              >
                <Ionicons name="swap-horizontal" size={14} color={colors.text.secondary} />
              </Pressable>
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
            <Text style={styles.identityArchetype} numberOfLines={1}>Choose Playbook</Text>
          </View>
        </View>
      </View>

      {/* ── Scrollable Content ── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Chalkboard: Selected Plays ── */}
        <View style={styles.chalkboard}>
          <View style={styles.chalkLine} />
          <View style={[styles.chalkLine, { top: '50%' }]} />
          <View style={[styles.chalkLine, { top: '75%' }]} />
          <View style={styles.tabBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabScrollContent}
              style={styles.tabScroll}
            >
              {schemes.map((scheme, index) => {
                const isSelected = scheme.id === (active?.id ?? null);
                return (
                  <Pressable
                    key={scheme.id}
                    onPress={() => setActiveId(scheme.id)}
                    style={[styles.tabButton, isSelected && styles.tabButtonActive]}
                  >
                    <Text style={[styles.tabButtonText, isSelected && styles.tabButtonTextActive]}>{index + 1}</Text>
                    {scheme.isDefault && <View style={styles.tabActiveDot} />}
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.tabFixedActions}>
              <View style={styles.tabDivider} />
              <Pressable
                onPress={addNewScheme}
                disabled={create.isPending}
                style={[styles.tabButton, create.isPending && styles.tabButtonDisabled]}
              >
                <Ionicons name="add" size={18} color={colors.text.secondary} />
              </Pressable>
              <Pressable
                disabled={!canSetActive}
                onPress={async () => {
                  if (!active) return;
                  // Make sure the backend has the latest 9 plays before isDefault validation runs.
                  await flush();
                  setActiveScheme.mutate(active);
                }}
                style={[styles.tabButton, !canSetActive && styles.tabButtonDisabled]}
              >
                <Ionicons
                  name={active?.isDefault ? 'star' : 'star-outline'}
                  size={16}
                  color={active?.isDefault ? colors.success : canSetActive ? colors.success : colors.text.muted}
                />
              </Pressable>
              <Pressable
                disabled={!active || active.isDefault}
                onPress={() => active && remove.mutate(active)}
                style={[styles.tabButton, (!active || active.isDefault) && styles.tabButtonDisabled]}
              >
                <Ionicons name="trash-outline" size={16} color={active && !active.isDefault ? colors.danger : colors.text.muted} />
              </Pressable>
            </View>
          </View>
          <View style={styles.playList}>
            {Array.from({ length: 3 }).map((_, rowIdx) => {
              const rowSlots = Array.from({ length: 3 }).map((__, colIdx) => {
                const idx = rowIdx * 3 + colIdx;
                return visibleSelected[idx] ?? null;
              });
              const activeInRow = rowSlots.filter((t): t is PlayTemplate => t != null && (t.id === expandedPlayId || t.id === subFromPlayId));
              return (
                <View key={`sel-row-${rowIdx}`} style={styles.playRowGroup}>
                  <View style={styles.playGridRow}>
                    {rowSlots.map((template, colIdx) => {
                      if (!template) {
                        return <VacantCard key={`vacant-${rowIdx}-${colIdx}`} />;
                      }
                      const expanded = expandedPlayId === template.id;
                      const isSource = subFromPlayId === template.id;
                      return (
                        <PlayCard
                          key={template.id}
                          template={template}
                          slotMap={slotMap}
                          isHighlighted={expanded || isSource}
                          onToggle={() => togglePlay(template.id)}
                        />
                      );
                    })}
                  </View>
                  {activeInRow.map((template) => {
                    const expanded = expandedPlayId === template.id;
                    const isSource = subFromPlayId === template.id;
                    const sub = subPropsFor(template.id);
                    return (
                      <PlayExpand
                        key={`sel-exp-${template.id}`}
                        template={template}
                        slotMap={slotMap}
                        isExpanded={expanded}
                        showAction={isSource || expanded}
                        subLabel={sub.label}
                        onPressSub={sub.onPress}
                        extra={!subMode && expanded ? { label: 'Remove', onPress: () => removePlay(template.id), tone: 'danger' } : undefined}
                      />
                    );
                  })}
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Available Plays ── */}
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
                  onPress={() => setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  style={[styles.sortToggle, styles.sortToggleActive]}
                >
                  <Ionicons
                    name={sortDir === 'desc' ? 'arrow-down' : 'arrow-up'}
                    size={12}
                    color={colors.bg.base}
                  />
                  <Text style={[styles.sortToggleText, styles.sortToggleTextActive]}>
                    OVR
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setCategoryFilters(new Set())}
                  style={[styles.categoryChip, categoryFilters.size === 0 && styles.categoryChipActive]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      categoryFilters.size === 0 && styles.categoryChipTextActive,
                    ]}
                  >
                    All
                  </Text>
                </Pressable>
                {orderedCategories.map((category) => {
                  const sample = templates.find((t) => t.category === category);
                  if (!sample) return null;
                  const isActive = categoryFilters.has(category);
                  return (
                    <Pressable
                      key={category}
                      onPress={() => toggleCategory(category)}
                      style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                    >
                      <View style={[styles.categoryChipStripe, { backgroundColor: sample.categoryColor }]} />
                      <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                        {sample.categoryLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
          <View style={styles.playList}>
            {visibleAvailable.length === 0 && filtersActive ? (
              <Text style={styles.emptyText}>No plays match your filters.</Text>
            ) : (
              chunk(visibleAvailable, 3).map((row, rowIdx) => {
                const activeInRow = row.filter((t) => t.id === expandedPlayId || t.id === subFromPlayId);
                return (
                  <View key={`av-row-${rowIdx}`} style={styles.playRowGroup}>
                    <View style={styles.playGridRow}>
                      {row.map((template) => {
                        const expanded = expandedPlayId === template.id;
                        const isSource = subFromPlayId === template.id;
                        return (
                          <PlayCard
                            key={template.id}
                            template={template}
                            slotMap={slotMap}
                            isHighlighted={expanded || isSource}
                            onToggle={() => togglePlay(template.id)}
                          />
                        );
                      })}
                      {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, i) => (
                        <View key={`av-sp-${rowIdx}-${i}`} style={styles.playGridSpacer} />
                      ))}
                    </View>
                    {activeInRow.map((template) => {
                      const expanded = expandedPlayId === template.id;
                      const isSource = subFromPlayId === template.id;
                      const sub = subPropsFor(template.id);
                      return (
                        <PlayExpand
                          key={`av-exp-${template.id}`}
                          template={template}
                          slotMap={slotMap}
                          isExpanded={expanded}
                          showAction={isSource || expanded}
                          subLabel={sub.label}
                          onPressSub={sub.onPress}
                          extra={!subMode && expanded && draftPlays.length < 9 ? { label: 'Insert', onPress: () => insertPlay(template.id), tone: 'success' } : undefined}
                        />
                      );
                    })}
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
};

function PlayCard({
  template,
  slotMap,
  isHighlighted,
  onToggle,
}: {
  template: PlayTemplate;
  slotMap: Record<string, RosterPlayer | undefined>;
  isHighlighted: boolean;
  onToggle: () => void;
}) {
  const overall = playOverall(template, slotMap);
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.playCard, isHighlighted && styles.playCardExpanded]}
    >
      <View style={[styles.categoryStripe, { backgroundColor: template.categoryColor }]} />
      <View style={styles.playCardMain}>
        <Text style={styles.playName} numberOfLines={2}>{template.name}</Text>
        <Text
          style={[styles.familyText, { color: template.categoryColor }]}
          numberOfLines={1}
        >
          {template.categoryLabel}
        </Text>
      </View>
      <View style={styles.rowOvrBlock}>
        <Text style={styles.rowOvrText}>{overall ?? '--'}</Text>
        <Text style={styles.rowOvrLabel}>OVR</Text>
      </View>
    </Pressable>
  );
}

function VacantCard() {
  return (
    <View style={[styles.playCard, styles.vacantCard]} pointerEvents="none">
      <View style={[styles.categoryStripe, styles.vacantStripe]} />
      <View style={styles.playCardMain}>
        <Text style={[styles.playName, styles.vacantName]} numberOfLines={2}>Vacant</Text>
        <Text style={[styles.familyText, styles.vacantFamily]} numberOfLines={1}>EMPTY SLOT</Text>
      </View>
      <View style={[styles.rowOvrBlock, styles.vacantOvr]}>
        <Text style={[styles.rowOvrText, styles.vacantOvrText]}>--</Text>
        <Text style={styles.rowOvrLabel}>OVR</Text>
      </View>
    </View>
  );
}

function PlayExpand({
  template,
  slotMap,
  isExpanded,
  showAction,
  onPressSub,
  subLabel,
  extra,
}: {
  template: PlayTemplate;
  slotMap: Record<string, RosterPlayer | undefined>;
  isExpanded: boolean;
  showAction: boolean;
  onPressSub: () => void;
  subLabel: string;
  extra?: { label: string; onPress: () => void; tone: 'danger' | 'success' };
}) {
  const isCancel = subLabel === 'Cancel';
  const extraStyle =
    extra?.tone === 'danger' ? styles.removeButton : extra?.tone === 'success' ? styles.insertButton : null;
  const extraTextStyle =
    extra?.tone === 'danger' ? styles.removeButtonText : extra?.tone === 'success' ? styles.insertButtonText : null;
  return (
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
        <View style={styles.actionRow}>
          <Pressable onPress={onPressSub} style={[styles.subButton, isCancel && styles.subButtonCancel]}>
            <Text style={[styles.subButtonText, isCancel && styles.subButtonCancelText]}>{subLabel}</Text>
          </Pressable>
          {extra && (
            <Pressable onPress={extra.onPress} style={[styles.subButton, extraStyle]}>
              <Text style={[styles.subButtonText, extraTextStyle]}>{extra.label}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function sameOrder(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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
  switchUnitButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchUnitButtonPressed: {
    backgroundColor: colors.bg.elevated,
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
  stickyHeader: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabScroll: {
    flex: 1,
    minWidth: 0,
  },
  tabScrollContent: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  tabFixedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  tabDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
    alignSelf: 'center',
  },
  tabButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  tabButtonDisabled: {
    opacity: 0.35,
  },
  tabButtonText: {
    ...typography.heading,
    color: colors.text.secondary,
    fontSize: 16,
  },
  tabButtonTextActive: {
    color: colors.bg.base,
  },
  tabActiveDot: {
    position: 'absolute',
    bottom: 3,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  scrollContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  chalkboard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    overflow: 'hidden',
    backgroundColor: '#151D1B',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chalkLine: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    top: '25%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderStyle: 'dashed' as any,
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
  playRowGroup: {
    gap: spacing.xs,
  },
  playGridRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  playGridSpacer: {
    flex: 1,
  },
  playCard: {
    flex: 1,
    minHeight: 76,
    flexDirection: 'row',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  playCardExpanded: {
    borderColor: colors.accent.primary,
  },
  vacantCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.06)',
    borderStyle: 'dashed' as any,
  },
  vacantStripe: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  vacantName: {
    color: colors.text.muted,
  },
  vacantFamily: {
    color: colors.text.muted,
    opacity: 0.7,
  },
  vacantOvr: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  vacantOvrText: {
    color: colors.text.muted,
  },
  categoryStripe: {
    width: 4,
    alignSelf: 'stretch',
  },
  playCardMain: {
    flex: 1,
    padding: spacing.sm,
    paddingRight: 40,
    gap: 4,
    justifyContent: 'space-between',
  },
  playExpand: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent.primary,
    padding: spacing.md,
    gap: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  subButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.accent.primary,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  removeButton: {
    backgroundColor: colors.danger,
  },
  removeButtonText: {
    color: colors.bg.elevated,
  },
  insertButton: {
    backgroundColor: colors.success,
  },
  insertButtonText: {
    color: colors.bg.elevated,
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
    fontSize: 13,
    lineHeight: 16,
  },
  familyText: {
    fontSize: 9,
    fontWeight: '800',
  },
  rowOvrBlock: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 34,
    minHeight: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowOvrText: {
    ...typography.heading,
    color: colors.accent.primary,
    fontSize: 14,
    lineHeight: 16,
  },
  rowOvrLabel: {
    ...typography.caption,
    color: colors.text.muted,
    fontSize: 8,
    fontWeight: '800',
    lineHeight: 9,
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
