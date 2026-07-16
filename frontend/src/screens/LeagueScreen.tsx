import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { ScreenContainer } from '../components/ScreenContainer';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card } from '../components/Card';
import { typography, spacing, colors, radius } from '../theme';
import { api } from '../api/client';
import { useUserTeamId } from '../state/userTeam';
import { DefensiveIdentity, LeagueStandingsResponse, LeaguesResponse, OffensiveIdentity } from '../api/types';
import { teamArchetypeLabel } from '../utils/teamArchetype';

type StandingRow = LeagueStandingsResponse['standings'][number];
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export const LeagueScreen: React.FC = () => {
  const userTeamId = useUserTeamId();
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn:  () => api.me(),
  });

  const { data: allLeagues } = useQuery({
    queryKey: ['leagues'],
    queryFn:  () => api.leagues(),
  });

  const viewedLeagueId = activeLeagueId ?? me?.leagueId ?? null;

  const { data: standings, isLoading } = useQuery({
    queryKey: ['standings', viewedLeagueId],
    queryFn: () => api.leagueStandings(viewedLeagueId!),
    enabled:  !!viewedLeagueId,
  });

  if (!userTeamId || isLoading || !standings) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing.xxxl }} />
      </ScreenContainer>
    );
  }

  const leagueOptions = allLeagues?.leagues ?? [];
  const canPick = leagueOptions.length > 1;

  return (
    <ScreenContainer>
      <ScreenHeader
        label="Standings"
        title={standings.league?.name ?? 'League'}
        onTitlePress={canPick ? () => setPickerOpen(true) : undefined}
      />

      <Card padded={false}>
        <View style={styles.header}>
          <Text style={[typography.label, styles.colRank]}>#</Text>
          <Text style={[typography.label, styles.colTeam]}>TEAM</Text>
          <Text style={[typography.label, styles.colNum]}>W</Text>
          <Text style={[typography.label, styles.colNum]}>L</Text>
          <Text style={[typography.label, styles.colDiff]}>DIFF</Text>
        </View>

        {standings.standings.map((row, i) => {
          const isUser = row.teamId === userTeamId;
          const rank   = i + 1;
          const total  = standings.standings.length;
          const zone   = zoneForRank(rank, total);
          const isPlayoffCutoff = rank === 6;
          const isLast = i === standings.standings.length - 1;
          const isExpanded = row.teamId === expandedTeamId;
          return (
            <View key={row.teamId}>
              <Pressable
                onPress={() => setExpandedTeamId(isExpanded ? null : row.teamId)}
                style={[
                  styles.row,
                  zone === 'PROMOTION'  && styles.rowPromotion,
                  zone === 'RELEGATION' && styles.rowRelegation,
                  isExpanded && styles.rowExpanded,
                  !isExpanded && isPlayoffCutoff && styles.rowPlayoffCutoff,
                  !isExpanded && !isPlayoffCutoff && !isLast && styles.rowDivider,
                ]}
              >
                <View style={styles.colRank}>
                  <Text style={[
                    typography.heading,
                    { fontSize: 16 },
                    isUser && { color: colors.accent.primary },
                  ]}>
                    {rank}
                  </Text>
                </View>
                <View style={styles.colTeam}>
                  <Text style={[
                    typography.body,
                    isUser && { color: colors.accent.primary, fontWeight: '700' },
                  ]} numberOfLines={1}>
                    {row.teamName}
                  </Text>
                </View>
                <Text style={[typography.body, styles.colNum]}>{row.wins}</Text>
                <Text style={[typography.body, styles.colNum]}>{row.losses}</Text>
                <Text style={[
                  typography.body,
                  styles.colDiff,
                  { color: row.diff > 0 ? colors.success : row.diff < 0 ? colors.danger : colors.text.secondary },
                ]}>
                  {row.diff >= 0 ? '+' : ''}{row.diff}
                </Text>
              </Pressable>

              {isExpanded && (
                <TeamExpandPanel
                  team={row}
                  isPlayoffCutoff={isPlayoffCutoff}
                  isLast={isLast}
                  canTrade={viewedLeagueId === me?.leagueId && row.teamId !== userTeamId}
                />
              )}
            </View>
          );
        })}

        <View style={styles.legend}>
          <LegendDot color={colors.success}        label="Promotion" />
          <LegendDot color={colors.danger}         label="Relegation" />
        </View>
      </Card>

      <PlayoffPictureCard standings={standings.standings} userTeamId={userTeamId} />

      <LeaguePicker
        visible={pickerOpen}
        leagues={leagueOptions}
        activeLeagueId={viewedLeagueId}
        homeLeagueId={me?.leagueId ?? null}
        onSelect={(id) => {
          setActiveLeagueId(id);
          setExpandedTeamId(null);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </ScreenContainer>
  );
};

const LeaguePicker: React.FC<{
  visible:        boolean;
  leagues:        LeaguesResponse['leagues'];
  activeLeagueId: string | null;
  homeLeagueId:   string | null;
  onSelect:       (id: string) => void;
  onClose:        () => void;
}> = ({ visible, leagues, activeLeagueId, homeLeagueId, onSelect, onClose }) => {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.pickerHeader}>
            <Text style={typography.label}>Switch League</Text>
            <Pressable onPress={onClose} style={styles.pickerClose}>
              <Ionicons name="close" size={18} color={colors.text.secondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ gap: spacing.sm }} showsVerticalScrollIndicator={false}>
            {leagues.map((league) => {
              const isActive = league.id === activeLeagueId;
              const isHome   = league.id === homeLeagueId;
              return (
                <Pressable
                  key={league.id}
                  onPress={() => onSelect(league.id)}
                  style={[
                    styles.pickerRow,
                    isActive && styles.pickerRowActive,
                  ]}
                >
                  <Text style={styles.pickerTier}>T{league.tier}</Text>
                  <View style={styles.pickerNameCol}>
                    <Text style={[
                      typography.body,
                      { fontWeight: '800' },
                      isActive && { color: colors.accent.primary },
                    ]} numberOfLines={1}>
                      {league.name}
                    </Text>
                    {isHome && (
                      <Text style={styles.pickerHomeTag}>YOUR LEAGUE</Text>
                    )}
                  </View>
                  {isActive && (
                    <Ionicons name="checkmark" size={18} color={colors.accent.primary} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

type SeededTeam = { row: StandingRow; seed: number };

const PlayoffPictureCard: React.FC<{ standings: StandingRow[]; userTeamId: string }> = ({ standings, userTeamId }) => {
  if (standings.length < 6) return null;
  const top6: SeededTeam[] = standings.slice(0, 6).map((row, i) => ({ row, seed: i + 1 }));
  const seed = (n: number) => top6[n - 1];

  return (
    <Card>
      <Text style={typography.label}>Playoff Picture</Text>

      <View style={styles.bracket}>
        {/* Column 1: Wild Card */}
        <View style={styles.bracketCol1}>
          <View style={styles.bracketPair}>
            <View style={styles.bracketMatchupGroup}>
              <View style={styles.bracketNode}>
                <BracketCell label="Wild Card" teams={[seed(4)]} userTeamId={userTeamId} />
                <View style={styles.nodeConnectorRight} />
              </View>
              <View style={styles.bracketNode}>
                <BracketCell label="Wild Card" teams={[seed(5)]} userTeamId={userTeamId} />
                <View style={styles.nodeConnectorRight} />
              </View>
              <View style={styles.matchupVerticalLine} />
            </View>
            <View style={styles.pairConnector} />
          </View>

          <View style={styles.bracketPair}>
            <View style={styles.bracketMatchupGroup}>
              <View style={styles.bracketNode}>
                <BracketCell label="Wild Card" teams={[seed(3)]} userTeamId={userTeamId} />
                <View style={styles.nodeConnectorRight} />
              </View>
              <View style={styles.bracketNode}>
                <BracketCell label="Wild Card" teams={[seed(6)]} userTeamId={userTeamId} />
                <View style={styles.nodeConnectorRight} />
              </View>
              <View style={styles.matchupVerticalLine} />
            </View>
            <View style={styles.pairConnector} />
          </View>
        </View>

        {/* Column 2: Semifinals */}
        <View style={styles.bracketCol2}>
          <View style={styles.bracketNode}>
            <BracketCell label="Semifinal" teams={[seed(1)]} subtitle="vs 4/5 Winner" userTeamId={userTeamId} />
          </View>
          <View style={styles.bracketNode}>
            <BracketCell label="Semifinal" teams={[seed(2)]} subtitle="vs 3/6 Winner" userTeamId={userTeamId} />
          </View>
        </View>
      </View>
    </Card>
  );
};

const BracketCell: React.FC<{
  label:    string;
  teams?:   SeededTeam[];
  subtitle?: string;
  userTeamId: string;
}> = ({ label, teams = [], subtitle, userTeamId }) => (
  <View style={styles.bracketCell}>
    <Text style={styles.bracketCellLabel}>{label}</Text>
    {teams.map(({ row, seed }) => {
      const isUser = row.teamId === userTeamId;
      return (
        <Text
          key={row.teamId}
          style={[
            styles.bracketCellTeam,
            isUser && { color: colors.accent.primary, fontWeight: '800' },
          ]}
          numberOfLines={1}
        >
          ({seed}) {row.teamName}
        </Text>
      );
    })}
    {subtitle && (
      <Text style={styles.bracketCellSubtitle} numberOfLines={1}>{subtitle}</Text>
    )}
  </View>
);

type Zone = 'PROMOTION' | 'PLAYOFF' | 'RELEGATION' | 'MID';
function zoneForRank(rank: number, total: number): Zone {
  if (rank <= 3) return 'PROMOTION';
  if (rank > total - 3) return 'RELEGATION';
  if (rank <= 6) return 'PLAYOFF';
  return 'MID';
}

const LegendDot: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendSwatch, { backgroundColor: color }]} />
    <Text style={typography.caption} numberOfLines={1}>{label}</Text>
  </View>
);

const TeamExpandPanel: React.FC<{
  team: StandingRow;
  isPlayoffCutoff: boolean;
  isLast: boolean;
  canTrade: boolean;
}> = ({ team, isPlayoffCutoff, isLast, canTrade }) => {
  const offColor = offensiveIdentityColor(team.identity.offense);
  const defColor = defensiveIdentityColor(team.identity.defense);
  return (
    <View style={[
      styles.expandPanel,
      isPlayoffCutoff && styles.expandPanelPlayoffCutoff,
      !isPlayoffCutoff && !isLast && styles.expandPanelDivider,
    ]}>
      <View style={styles.identityRow}>
        <View style={[styles.identityChip, { backgroundColor: withAlpha(offColor, 0.18) }]}>
          <Ionicons name={offensiveIdentityIcon(team.identity.offense)} size={14} color={offColor} />
          <Text style={[styles.identityChipLabel, { color: offColor }]}>
            {offensiveIdentityLabel(team.identity.offense)}
          </Text>
        </View>
        <View style={[styles.identityChip, { backgroundColor: withAlpha(defColor, 0.18) }]}>
          <Ionicons name={defensiveIdentityIcon(team.identity.defense)} size={14} color={defColor} />
          <Text style={[styles.identityChipLabel, { color: defColor }]}>
            {defensiveIdentityLabel(team.identity.defense)}
          </Text>
        </View>
        <View style={styles.identitySpacer} />
        <Text style={styles.archetypeLabel} numberOfLines={1}>
          {teamArchetypeLabel(team.identity)}
        </Text>
      </View>

      <View style={styles.playersList}>
        <Text style={styles.playersHeader}>Top Players</Text>
        {team.topPlayers.slice(0, 3).map((player) => (
          <View key={player.id} style={styles.playerRow}>
            <Text style={styles.playerPos}>{player.position}</Text>
            <Text style={[typography.body, styles.playerName]} numberOfLines={1}>{player.name}</Text>
            <Text style={[typography.heading, styles.playerOvr]}>{player.overall}</Text>
          </View>
        ))}
      </View>

      {canTrade && (
        <Pressable style={styles.tradeButton} onPress={() => {}}>
          <Text style={styles.tradeButtonText}>Trade</Text>
        </Pressable>
      )}
    </View>
  );
};

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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
  if (identity === 'PRESSURE')   return colors.identity.agg;
  if (identity === 'MAN_HEAVY')  return colors.identity.man;
  if (identity === 'ZONE_HEAVY') return colors.identity.zone;
  return colors.identity.bal;
}

function offensiveIdentityLabel(identity: OffensiveIdentity): string {
  const labels: Record<OffensiveIdentity, string> = {
    VERTICAL:   'Vertical',
    RUN_HEAVY:  'Run-Heavy',
    PASS_HEAVY: 'Pass-Heavy',
    BALANCED:   'Balanced',
  };
  return labels[identity];
}

function defensiveIdentityLabel(identity: DefensiveIdentity): string {
  const labels: Record<DefensiveIdentity, string> = {
    PRESSURE:   'Pressure',
    MAN_HEAVY:  'Man',
    ZONE_HEAVY: 'Zone',
    BALANCED:   'Balanced',
  };
  return labels[identity];
}


const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.sm,
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
  },
  rowPromotion: {
    backgroundColor: 'rgba(63, 185, 110, 0.13)',
  },
  rowRelegation: {
    backgroundColor: 'rgba(220, 70, 78, 0.13)',
  },
  rowPlayoffCutoff: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent.primary,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowExpanded: {
    backgroundColor: colors.bg.surface,
  },
  colRank: { width: 32 },
  colTeam: { flex:  1, paddingRight: spacing.sm },
  colNum:  { width: 32, textAlign: 'center' },
  colDiff: { width: 56, textAlign: 'right' },
  legend: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    gap:               spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderTopWidth:    1,
    borderTopColor:    colors.divider,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  legendSwatch: {
    width:        12,
    height:       12,
    borderRadius: 3,
  },
  expandPanel: {
    backgroundColor:   colors.bg.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    gap:               spacing.md,
    borderTopWidth:    1,
    borderTopColor:    colors.divider,
  },
  expandPanelDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  expandPanelPlayoffCutoff: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent.primary,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  identityChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
    borderRadius:      radius.pill,
  },
  identityChipLabel: {
    ...typography.caption,
    fontWeight: '800',
    fontSize:   11,
  },
  identitySpacer: { flex: 1 },
  archetypeLabel: {
    ...typography.label,
    color:        colors.text.primary,
    fontWeight:   '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  playersList: {
    gap: spacing.xs,
  },
  playersHeader: {
    ...typography.label,
    color:         colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom:  spacing.xs,
  },
  playerRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    paddingVertical:   spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor:   colors.bg.elevated,
    borderRadius:      radius.sm,
  },
  playerPos: {
    ...typography.label,
    width:      36,
    color:      colors.accent.primary,
    fontWeight: '800',
  },
  playerName: {
    flex: 1,
  },
  playerOvr: {
    width:      32,
    textAlign:  'right',
    color:      colors.accent.primary,
  },
  tradeButton: {
    paddingVertical: spacing.md,
    backgroundColor: colors.accent.primary,
    borderRadius:    radius.md,
    alignItems:      'center',
  },
  tradeButtonText: {
    ...typography.label,
    color:      colors.bg.elevated,
    fontWeight: '800',
  },
  bracket: {
    flexDirection: 'row',
    marginTop:     spacing.md,
    minHeight:     240,
    gap:           spacing.lg,
  },
  bracketCol1: {
    flex:           1.1,
  },
  bracketCol2: {
    flex:           1,
    justifyContent: 'space-around',
  },
  bracketPair: {
    flex:             1,
    justifyContent:   'center',
    paddingRight:     spacing.sm,
    position:         'relative',
  },
  bracketMatchupGroup: {
    justifyContent: 'center',
    gap: spacing.xs,
    position: 'relative',
  },
  bracketNode: {
    position: 'relative',
    justifyContent: 'center',
  },
  nodeConnectorRight: {
    position: 'absolute',
    right: -spacing.sm,
    top: '50%',
    width: spacing.sm,
    height: 1,
    backgroundColor: colors.divider,
  },
  matchupVerticalLine: {
    position: 'absolute',
    right: -spacing.sm,
    top: '25%',
    bottom: '25%',
    width: 1,
    backgroundColor: colors.divider,
  },
  pairConnector: {
    position:        'absolute',
    right:           -spacing.lg,
    top:             '50%',
    width:           spacing.lg,
    height:          1,
    backgroundColor: colors.divider,
  },
  bracketCell: {
    backgroundColor:   colors.bg.surface,
    borderRadius:      radius.sm,
    paddingVertical:   spacing.xs,
    paddingHorizontal: spacing.sm,
    gap:               2,
  },
  bracketCellLabel: {
    ...typography.label,
    color:    colors.text.muted,
    fontSize: 9,
  },
  bracketCellTeam: {
    ...typography.body,
    fontSize:   13,
    fontWeight: '600',
    color:      colors.text.primary,
  },
  bracketCellSubtitle: {
    ...typography.caption,
    color:     colors.text.muted,
    fontStyle: 'italic',
    fontSize:  10,
  },
  pickerBackdrop: {
    flex:            1,
    backgroundColor: colors.bg.overlay,
    justifyContent:  'flex-end',
  },
  pickerSheet: {
    backgroundColor:      colors.bg.elevated,
    borderTopLeftRadius:  radius.xl,
    borderTopRightRadius: radius.xl,
    padding:              spacing.lg,
    gap:                  spacing.md,
    maxHeight:            '70%',
  },
  pickerHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  pickerClose: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: colors.bg.surface,
    alignItems:      'center',
    justifyContent:  'center',
  },
  pickerRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor:   colors.bg.surface,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  pickerRowActive: {
    borderColor: colors.accent.primary,
  },
  pickerTier: {
    ...typography.label,
    width:      32,
    color:      colors.text.secondary,
    fontWeight: '800',
  },
  pickerNameCol: {
    flex: 1,
    gap:  2,
  },
  pickerHomeTag: {
    ...typography.caption,
    color:         colors.accent.primary,
    fontWeight:    '800',
    letterSpacing: 0.8,
    fontSize:      10,
  },
});
