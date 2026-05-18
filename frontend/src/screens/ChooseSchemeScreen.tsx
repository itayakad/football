import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../api/client';
import { PlayTemplate, RosterPlayer, TeamScheme } from '../api/types';
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
  const [selectedPlayId, setSelectedPlayId] = React.useState<string | null>(null);
  const [showSubOptions, setShowSubOptions] = React.useState(false);

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
  const active = schemes.find((scheme) => scheme.id === activeId) ?? schemes[0] ?? null;

  React.useEffect(() => {
    if (!active) return;
    setActiveId(active.id);
    setDraftName(active.name);
    setDraftPlays(active.plays);
    setSelectedPlayId(null);
    setShowSubOptions(false);
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
  const availableTemplates = templates.filter((template) => !selectedIds.has(template.id));
  const selectedPlay = selectedPlayId ? templates.find((template) => template.id === selectedPlayId) ?? null : null;
  const selectedPlayIsInScheme = selectedPlay ? selectedIds.has(selectedPlay.id) : false;

  const replacePlay = (nextPlayId: string) => {
    if (!selectedPlayId || draftPlays.includes(nextPlayId)) return;
    setDraftPlays(draftPlays.map((id) => (id === selectedPlayId ? nextPlayId : id)));
    setSelectedPlayId(null);
    setShowSubOptions(false);
  };

  const replaceSelectedSlot = (currentSelectedId: string) => {
    if (!selectedPlayId || selectedIds.has(selectedPlayId) || !draftPlays.includes(currentSelectedId)) return;
    setDraftPlays(draftPlays.map((id) => (id === currentSelectedId ? selectedPlayId : id)));
    setSelectedPlayId(null);
    setShowSubOptions(false);
  };

  const openPlay = (playId: string) => {
    setSelectedPlayId(playId);
    setShowSubOptions(false);
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
        <Card padded={false}>
          {selectedTemplates.map((template, index) => (
            <PlayRow
              key={template.id}
              template={template}
              slotMap={slotMap}
              isLast={index === selectedTemplates.length - 1}
              onPress={() => openPlay(template.id)}
            />
          ))}
        </Card>
      </View>

      <View>
        <SectionLabel>Available Plays</SectionLabel>
        <Card padded={false}>
          {availableTemplates.map((template, index) => (
            <PlayRow
              key={template.id}
              template={template}
              slotMap={slotMap}
              isLast={index === availableTemplates.length - 1}
              onPress={() => openPlay(template.id)}
            />
          ))}
        </Card>
      </View>

      <ReplacePlaySheet
        play={selectedPlay}
        isSelected={selectedPlayIsInScheme}
        slotMap={slotMap}
        options={selectedPlayIsInScheme ? availableTemplates : selectedTemplates}
        showSubOptions={showSubOptions}
        onShowSubOptions={() => setShowSubOptions(true)}
        onReplace={replacePlay}
        onReplaceSelectedSlot={replaceSelectedSlot}
        onClose={() => setSelectedPlayId(null)}
      />
    </ScreenContainer>
  );
};

function PlayRow({
  template,
  slotMap,
  disabled,
  isLast,
  onPress,
}: {
  template: PlayTemplate;
  slotMap: Record<string, RosterPlayer | undefined>;
  disabled?: boolean;
  isLast?: boolean;
  onPress?: () => void;
}) {
  const overall = playOverall(template, slotMap);
  return (
    <Pressable disabled={disabled || !onPress} onPress={onPress} style={[styles.playRow, !isLast && styles.playRowBorder, disabled && styles.playRowDisabled]}>
      <View style={[styles.categoryStripe, { backgroundColor: template.categoryColor }]} />
      <View style={styles.playRowMain}>
        <View style={styles.playRowTitle}>
          <View style={{ flex: 1 }}>
            <Text style={styles.playName} numberOfLines={1}>{template.name}</Text>
            <Text style={[styles.familyText, { color: template.categoryColor }]}>{template.categoryLabel}</Text>
          </View>
        </View>
        <View style={styles.rowOvrBlock}>
          <Text style={styles.rowOvrText}>{overall ?? '--'}</Text>
          <Text style={styles.rowOvrLabel}>OVR</Text>
        </View>
      </View>
    </Pressable>
  );
}

function ReplacePlaySheet({
  play,
  isSelected,
  slotMap,
  options,
  showSubOptions,
  onShowSubOptions,
  onReplace,
  onReplaceSelectedSlot,
  onClose,
}: {
  play: PlayTemplate | null;
  isSelected: boolean;
  slotMap: Record<string, RosterPlayer | undefined>;
  options: PlayTemplate[];
  showSubOptions: boolean;
  onShowSubOptions: () => void;
  onReplace: (playId: string) => void;
  onReplaceSelectedSlot: (playId: string) => void;
  onClose: () => void;
}) {
  if (!play) return null;
  const playOvr = playOverall(play, slotMap);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.detailCard}>
            <View style={styles.detailTopRow}>
              <View style={styles.playOvrBlock}>
                <Text style={styles.ovrNumber}>{playOvr ?? '--'}</Text>
                <Text style={styles.ovrLabel}>OVR</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={typography.label}>{play.categoryLabel}</Text>
                <Text style={styles.sheetTitle}>{play.name}</Text>
              </View>
              <View style={styles.detailActionBlock}>
                <Pressable
                  onPress={onShowSubOptions}
                  style={styles.subButton}
                >
                  <Text style={styles.subButtonText}>Sub</Text>
                </Pressable>
                {isSelected && <Text style={styles.selectedText}>Selected</Text>}
              </View>
            </View>

            <PlaySketch play={play} />

            <View style={styles.playerChipRow}>
              {play.keySlots.map((slot, index) => {
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
          </View>

          {showSubOptions && (
            <ScrollView contentContainerStyle={{ gap: spacing.md }} showsVerticalScrollIndicator={false}>
              <SectionLabel>{isSelected ? 'Eligible Plays' : 'Replace Selected Play'}</SectionLabel>
              {options.map((option) => {
                const optionOvr = playOverall(option, slotMap);
                return (
                  <Pressable
                    key={option.id}
                    style={styles.subOptionRow}
                    onPress={() => isSelected ? onReplace(option.id) : onReplaceSelectedSlot(option.id)}
                  >
                    <View style={styles.smallOvrBlock}>
                      <Text style={styles.smallOvrText}>{optionOvr ?? '--'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.playName}>{option.name}</Text>
                      <Text style={styles.slotText}>{option.keySlots.join(' / ')}</Text>
                    </View>
                    <Text style={[styles.familyText, { color: option.categoryColor }]}>{option.categoryLabel}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Pressable onPress={onClose} style={styles.closeSheetButton}>
            <Text style={styles.closeSheetText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
  title: { marginTop: spacing.xs },
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
  playRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    overflow: 'hidden',
  },
  playRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  playRowDisabled: {
    opacity: 0.58,
  },
  categoryStripe: {
    width: 4,
    alignSelf: 'stretch',
  },
  playRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
  },
  playRowTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  sheet: {
    maxHeight: '82%',
    backgroundColor: colors.bg.elevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  detailCard: {
    gap: spacing.md,
  },
  detailTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  playOvrBlock: {
    width: 58,
    minHeight: 58,
    borderRadius: radius.md,
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ovrNumber: {
    ...typography.heading,
    color: colors.accent.primary,
    fontSize: 24,
  },
  ovrLabel: {
    ...typography.caption,
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  detailActionBlock: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  subButton: {
    minWidth: 58,
    minHeight: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  subButtonText: {
    ...typography.label,
    color: colors.bg.base,
    fontWeight: '800',
  },
  selectedText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '800',
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
  smallOvrBlock: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallOvrText: {
    ...typography.heading,
    color: colors.accent.primary,
    fontSize: 16,
  },
  closeSheetButton: {
    minHeight: 42,
    borderRadius: radius.md,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeSheetText: {
    ...typography.label,
    color: colors.text.primary,
    fontWeight: '800',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  sheetTitle: {
    ...typography.title,
    fontSize: 22,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    ...typography.heading,
    color: colors.text.secondary,
  },
  subOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
});
