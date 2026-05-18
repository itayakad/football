import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Modal, Pressable, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { ScreenContainer } from '../components/ScreenContainer';
import { Card } from '../components/Card';
import { typography, spacing, colors, radius } from '../theme';
import { api } from '../api/client';
import { useUserTeamId } from '../state/userTeam';
import { LeagueStandingsResponse } from '../api/types';

type StandingRow = LeagueStandingsResponse['standings'][number];

export const LeagueScreen: React.FC = () => {
  const userTeamId = useUserTeamId();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn:  () => api.me(),
  });

  const { data: standings, isLoading } = useQuery({
    queryKey: ['standings', me?.leagueId],
    queryFn: () => api.leagueStandings(me!.leagueId),
    enabled:  !!me?.leagueId,
  });

  if (!userTeamId || isLoading || !standings) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing.xxxl }} />
      </ScreenContainer>
    );
  }

  const selectedTeam = standings.standings.find((row) => row.teamId === selectedTeamId) ?? null;
  const selectedRank = selectedTeam
    ? standings.standings.findIndex((row) => row.teamId === selectedTeam.teamId) + 1
    : 0;

  return (
    <ScreenContainer>
      <View>
        <Text style={typography.label}>{standings.league?.name}</Text>
        <Text style={typography.title}>Standings</Text>
      </View>

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
          return (
            <Pressable
              key={row.teamId}
              onPress={() => setSelectedTeamId(row.teamId)}
              style={[
                styles.row,
                zone === 'PROMOTION'  && styles.rowPromotion,
                zone === 'RELEGATION' && styles.rowRelegation,
                isPlayoffCutoff && styles.rowPlayoffCutoff,
                !isPlayoffCutoff && i < standings.standings.length - 1 && styles.rowDivider,
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
          );
        })}

        <View style={styles.legend}>
          <LegendDot color={colors.success}        label="Promotion" />
          <LegendDot color={colors.danger}         label="Relegation" />
        </View>
      </Card>

      <PlayoffPictureCard standings={standings.standings} userTeamId={userTeamId} />

      <TeamProfileModal
        team={selectedTeam}
        rank={selectedRank}
        onClose={() => setSelectedTeamId(null)}
      />
    </ScreenContainer>
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

const TeamProfileModal: React.FC<{
  team: StandingRow | null;
  rank: number;
  onClose: () => void;
}> = ({ team, rank, onClose }) => {
  const coaches = useMemo(() => {
    if (!team) return [];
    const byPosition = new Map(team.coaches.map((coach) => [coach.position, coach]));
    return [
      { label: 'HC', coach: byPosition.get('HC') },
      { label: 'OC', coach: byPosition.get('OC') },
      { label: 'DC', coach: byPosition.get('DC') },
    ];
  }, [team]);

  if (!team) return null;

  const rankColor =
    rank <= 3 ? colors.success :
    rank > 0 && rank > (team ? 5 : 0) ? colors.danger :
    colors.text.primary;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.profileSheet}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{teamInitials(team.teamName)}</Text>
            </View>
            <View style={styles.profileTitle}>
              <Text style={typography.label}>League Standing</Text>
              <Text style={styles.profileName}>{team.teamName}</Text>
              <Text style={[typography.caption, { color: rankColor }]}>Rank #{rank}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>x</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ gap: spacing.lg }} showsVerticalScrollIndicator={false}>
            <View style={styles.statusGrid}>
              <StatusTile label="Record" value={`${team.wins}-${team.losses}${team.ties ? `-${team.ties}` : ''}`} />
              <StatusTile label="PF"     value={`${team.pointsFor}`} />
              <StatusTile label="PA"     value={`${team.pointsAgainst}`} />
              <StatusTile
                label="Diff"
                value={`${team.diff >= 0 ? '+' : ''}${team.diff}`}
                tone={team.diff > 0 ? colors.success : team.diff < 0 ? colors.danger : colors.text.primary}
              />
            </View>

            <View style={styles.profileSection}>
              <Text style={typography.label}>Staff</Text>
              {coaches.map(({ label, coach }) => (
                <View key={label} style={styles.staffRow}>
                  <Text style={styles.staffRole}>{label}</Text>
                  <View style={styles.staffMain}>
                    <Text style={typography.body}>{coach?.name ?? 'Vacant'}</Text>
                    {coach && (
                      <Text style={typography.caption} numberOfLines={1}>
                        {coach.archetype} / {coach.overall} OVR
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.profileSection}>
              <Text style={typography.label}>Top Players</Text>
              {team.topPlayers.map((player) => (
                <View key={player.id} style={styles.playerRow}>
                  <Text style={typography.body} numberOfLines={1}>{player.name}</Text>
                  <Text style={typography.caption}>{player.position} / {player.overall} OVR / Age {player.age}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

function teamInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const StatusTile: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone }) => (
  <View style={styles.statusTile}>
    <Text style={typography.label}>{label}</Text>
    <Text style={[typography.heading, tone ? { color: tone } : null]}>{value}</Text>
  </View>
);


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
  modalBackdrop: {
    flex:            1,
    backgroundColor: colors.bg.overlay,
    justifyContent:  'flex-end',
  },
  profileSheet: {
    backgroundColor:      colors.bg.elevated,
    borderTopLeftRadius:  radius.xl,
    borderTopRightRadius: radius.xl,
    padding:              spacing.lg,
    gap:                  spacing.lg,
    maxHeight:            '88%',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
  },
  avatar: {
    width:           64,
    height:          64,
    borderRadius:    32,
    backgroundColor: colors.bg.surface,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     colors.border,
  },
  avatarText: {
    ...typography.heading,
    color: colors.text.secondary,
  },
  profileTitle: {
    flex: 1,
    gap:  spacing.xs,
  },
  profileName: {
    ...typography.title,
    fontSize: 22,
  },
  closeButton: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: colors.bg.surface,
    alignItems:      'center',
    justifyContent:  'center',
  },
  closeText: {
    ...typography.heading,
    color: colors.text.secondary,
  },
  profileSection: {
    gap: spacing.sm,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.sm,
  },
  statusTile: {
    width:           '48%',
    backgroundColor: colors.bg.surface,
    borderRadius:    radius.sm,
    padding:         spacing.md,
    gap:             spacing.xs,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  staffRole: {
    ...typography.label,
    width: 28,
    color: colors.accent.primary,
  },
  staffMain: {
    flex: 1,
  },
  playerRow: {
    backgroundColor: colors.bg.surface,
    borderRadius: 8,
    padding: spacing.sm,
  },
  historyLabel: {
    ...typography.body,
    fontWeight: '800',
  },
});
