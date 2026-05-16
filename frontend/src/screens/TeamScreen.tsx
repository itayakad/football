import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/client';
import { DefensiveIdentity, MarketResponse, OffensiveIdentity, RosterPlayer, RosterResponse } from '../api/types';
import { ProfileSheet } from '../components/ProfileSheet';
import { ScreenContainer } from '../components/ScreenContainer';
import { useUserTeamId } from '../state/userTeam';
import { colors, radius, spacing, typography } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { teamArchetypeLabel } from '../utils/teamArchetype';

type RosterGroup = RosterResponse['groups'][number];
type Coach = RosterResponse['team']['coaches'][number];
type Unit = 'offense' | 'defense';
type Slot = { id: string; label: string; player?: RosterPlayer };

const GROUP_BY_POSITION: Record<string, string> = {
  QB: 'qb',
  RB: 'skill',
  WR: 'skill',
  TE: 'skill',
  OL: 'ol',
  DE: 'dl',
  DT: 'dl',
  LB: 'lb',
  CB: 'secondary',
  S: 'secondary',
};

export const TeamScreen: React.FC = () => {
  const userTeamId = useUserTeamId();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [groups, setGroups] = React.useState<RosterGroup[]>([]);
  const [selectedPlayer, setSelectedPlayer] = React.useState<RosterPlayer | null>(null);
  const [selectedCoach, setSelectedCoach] = React.useState<Coach | null>(null);
  const [unit, setUnit] = React.useState<Unit>('offense');

  const { data, isLoading, error } = useQuery({
    queryKey: ['roster', userTeamId],
    queryFn: () => api.roster(userTeamId!),
    enabled: !!userTeamId,
  });

  const { data: marketData } = useQuery({
    queryKey: ['market', userTeamId],
    queryFn: () => api.market(userTeamId!),
    enabled: !!userTeamId,
  });

  const buyListing = useMutation({
    mutationFn: (listingId: string) => api.buyListing(listingId, userTeamId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster', userTeamId] });
      queryClient.invalidateQueries({ queryKey: ['market', userTeamId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', userTeamId] });
      setSelectedPlayer(null);
    },
  });

  const saveDepth = useMutation({
    mutationFn: (nextGroups: RosterGroup[]) => api.updateDepthChart(userTeamId!, nextGroups.flatMap((group) => group.players.map((player) => player.id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster', userTeamId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', userTeamId] });
    },
  });

  React.useEffect(() => {
    if (data) setGroups(data.groups);
  }, [data]);


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
        <Text style={typography.body}>Failed to load roster. Is the backend running?</Text>
      </ScreenContainer>
    );
  }

  const allPlayers = groups.flatMap((group) => group.players);
  const offenseSlots = buildOffenseSlots(allPlayers);
  const defenseSlots = buildDefenseSlots(allPlayers);
  const starterIds = new Set([...offenseSlots, ...defenseSlots].map((slot) => slot.player?.id).filter(Boolean));
  const activeSlots = unit === 'offense' ? offenseSlots : defenseSlots;

  const isStarter = selectedPlayer ? starterIds.has(selectedPlayer.id) : false;
  let subOptions: RosterPlayer[] = [];
  if (selectedPlayer) {
    const samePosition = allPlayers.filter(p => p.position === selectedPlayer.position && p.id !== selectedPlayer.id);
    if (isStarter) {
      subOptions = samePosition.filter(p => !starterIds.has(p.id));
    } else {
      subOptions = samePosition.filter(p => starterIds.has(p.id));
    }
  }

  let topMarketListing: MarketResponse['listings'][0] | null = null;
  if (selectedPlayer && subOptions.length === 0 && marketData) {
    const validListings = marketData.listings.filter(l => l.player.position === selectedPlayer.position);
    if (validListings.length > 0) {
      validListings.sort((a, b) => b.player.overall - a.player.overall);
      topMarketListing = validListings[0];
    }
  }

  const swapPlayers = (player1: RosterPlayer, player2: RosterPlayer) => {
    const groupKey = GROUP_BY_POSITION[player1.position];
    const nextGroups = groups.map((group) => {
      if (group.key !== groupKey) return group;

      const p1Index = group.players.findIndex(p => p.id === player1.id);
      const p2Index = group.players.findIndex(p => p.id === player2.id);

      if (p1Index >= 0 && p2Index >= 0) {
        const players = [...group.players];
        [players[p1Index], players[p2Index]] = [players[p2Index], players[p1Index]];
        return { ...group, players };
      }
      return group;
    });
    setGroups(nextGroups);
    saveDepth.mutate(nextGroups);
    setSelectedPlayer(null);
  };

  return (
    <ScreenContainer scroll={false} contentStyle={styles.screenContent}>
      <View style={styles.identityBlock}>
        <View style={styles.identityTopRow}>
          <View style={styles.identityLabelGroup}>
            <Text style={styles.identityHeaderLabel}>Team Identity</Text>
            <View style={styles.identityIconRow}>
              <View style={styles.identityIconCircle}>
                <Ionicons
                  name={offensiveIdentityIcon(data.team.identity.offense)}
                  size={14}
                  color={offensiveIdentityColor(data.team.identity.offense)}
                />
              </View>
              <View style={styles.identityIconCircle}>
                <Ionicons
                  name={defensiveIdentityIcon(data.team.identity.defense)}
                  size={14}
                  color={defensiveIdentityColor(data.team.identity.defense)}
                />
              </View>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to home"
            onPress={() => navigation.navigate('Home')}
            style={({ pressed }) => [styles.homeButton, pressed && styles.homeButtonPressed]}
          >
            <Ionicons name="home-outline" size={16} color={colors.text.primary} />
            <Text style={styles.homeButtonText}>Home</Text>
          </Pressable>
        </View>
        <View style={styles.identityValue}>
          <Text style={styles.identityArchetype} numberOfLines={1}>{teamArchetypeLabel(data.team.identity)}</Text>
        </View>
      </View>

      {data.team.coaches.length > 0 && (
        <View>
          <View style={styles.staffGrid}>
            {data.team.coaches.map((coach) => (
              <StaffCard
                key={coach.id}
                coach={coach}
                onPress={() => setSelectedCoach(coach)}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.rosterPanel}>
        <View style={styles.unitHeader}>
          <View style={styles.segmented}>
            <UnitButton label="Offense" active={unit === 'offense'} onPress={() => setUnit('offense')} />
            <UnitButton label="Defense" active={unit === 'defense'} onPress={() => setUnit('defense')} />
          </View>
        </View>
        <View style={styles.field}>
          <View style={styles.yardLineTop} />
          <View style={styles.yardLineMiddle} />
          <View style={styles.yardLineBottom} />

          <Pressable
            onPress={() => navigation.navigate('ChooseScheme', { unit })}
            style={({ pressed }) => [styles.schemeButton, pressed && styles.pressed]}
          >
            <Text style={styles.schemeButtonText}>Change {unit === 'offense' ? 'Offensive' : 'Defensive'} Scheme</Text>
          </Pressable>

          {unit === 'offense' ? (
            <>
              {/* Row 1: line of scrimmage — LT LG C RG RT */}
              <View style={styles.fieldRow}>
                {activeSlots.slice(0, 5).map((slot) => (
                  <StarterCard
                    key={slot.id}
                    slot={slot}
                    compact
                    onPress={() => slot.player && setSelectedPlayer(slot.player)}
                  />
                ))}
              </View>
              {/* Row 2: receivers — WR WR WR TE */}
              <View style={styles.fieldRow}>
                {activeSlots.slice(5, 9).map((slot) => (
                  <StarterCard
                    key={slot.id}
                    slot={slot}
                    onPress={() => slot.player && setSelectedPlayer(slot.player)}
                  />
                ))}
              </View>
              {/* Row 3: backfield — RB QB RB */}
              <View style={styles.fieldRow}>
                {activeSlots.slice(9, 12).map((slot) => (
                  <StarterCard
                    key={slot.id}
                    slot={slot}
                    featured={slot.label === 'QB'}
                    onPress={() => slot.player && setSelectedPlayer(slot.player)}
                  />
                ))}
              </View>
            </>
          ) : (
            <>
              <View style={styles.fieldRow}>
                {activeSlots.slice(0, 4).map((slot) => (
                  <StarterCard
                    key={slot.id}
                    slot={slot}
                    onPress={() => slot.player && setSelectedPlayer(slot.player)}
                  />
                ))}
              </View>
              <View style={[styles.fieldRow, styles.middleFieldRow]}>
                {activeSlots.slice(4, 7).map((slot) => (
                  <StarterCard
                    key={slot.id}
                    slot={slot}
                    onPress={() => slot.player && setSelectedPlayer(slot.player)}
                  />
                ))}
              </View>
              <View style={styles.fieldRow}>
                {activeSlots.slice(7).map((slot) => (
                  <StarterCard
                    key={slot.id}
                    slot={slot}
                    onPress={() => slot.player && setSelectedPlayer(slot.player)}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      </View>

      <PlayerProfile
        player={selectedPlayer}
        subOptions={subOptions}
        topMarketListing={topMarketListing}
        buying={buyListing.isPending}
        onSub={swapPlayers}
        onBuyMarket={(listingId) => buyListing.mutate(listingId)}
        onClose={() => setSelectedPlayer(null)}
      />
      <CoachProfile coach={selectedCoach} onClose={() => setSelectedCoach(null)} />
    </ScreenContainer>
  );
};

function buildOffenseSlots(players: RosterPlayer[]): Slot[] {
  const byPosition = playersByPosition(players);
  return [
    // Row 1: line of scrimmage — LT LG C RG RT
    { id: 'lt', label: 'LT', player: byPosition.OL?.[0] },
    { id: 'lg', label: 'LG', player: byPosition.OL?.[1] },
    { id: 'c', label: 'C', player: byPosition.OL?.[2] },
    { id: 'rg', label: 'RG', player: byPosition.OL?.[3] },
    { id: 'rt', label: 'RT', player: byPosition.OL?.[4] },
    // Row 2: receivers — WR1 WR2 WR3 TE
    { id: 'wr1', label: 'WR1', player: byPosition.WR?.[0] },
    { id: 'wr2', label: 'WR2', player: byPosition.WR?.[1] },
    { id: 'wr3', label: 'WR3', player: byPosition.WR?.[2] },
    { id: 'te1', label: 'TE', player: byPosition.TE?.[0] },
    // Row 3: backfield — RB1 QB RB2
    { id: 'rb1', label: 'RB1', player: byPosition.RB?.[0] },
    { id: 'qb1', label: 'QB', player: byPosition.QB?.[0] },
    { id: 'rb2', label: 'RB2', player: byPosition.RB?.[1] },
  ];
}

function buildDefenseSlots(players: RosterPlayer[]): Slot[] {
  const byPosition = playersByPosition(players);
  return [
    { id: 'cb1', label: 'CB', player: byPosition.CB?.[0] },
    { id: 's1', label: 'S', player: byPosition.S?.[0] },
    { id: 's2', label: 'S', player: byPosition.S?.[1] },
    { id: 'cb2', label: 'CB', player: byPosition.CB?.[1] },
    { id: 'lb1', label: 'LB', player: byPosition.LB?.[0] },
    { id: 'lb2', label: 'LB', player: byPosition.LB?.[1] },
    { id: 'lb3', label: 'LB', player: byPosition.LB?.[2] },
    { id: 'de1', label: 'DE', player: byPosition.DE?.[0] },
    { id: 'dt1', label: 'DT', player: byPosition.DT?.[0] },
    { id: 'dt2', label: 'DT', player: byPosition.DT?.[1] },
    { id: 'de2', label: 'DE', player: byPosition.DE?.[1] },
  ];
}

function playersByPosition(players: RosterPlayer[]): Record<string, RosterPlayer[]> {
  return players.reduce<Record<string, RosterPlayer[]>>((acc, player) => {
    acc[player.position] = [...(acc[player.position] ?? []), player];
    return acc;
  }, {});
}

function OverviewMetric({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <View style={styles.metric}>
      <Text style={typography.label}>{label}</Text>
      <Text style={[typography.heading, { color: tone }]}>{value}</Text>
    </View>
  );
}

function UnitButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.unitButton, active && styles.unitButtonActive]}>
      <Text style={[styles.unitButtonText, active && styles.unitButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function StarterCard({
  slot,
  compact,
  featured,
  onPress,
}: {
  slot: Slot;
  compact?: boolean;
  featured?: boolean;
  onPress: () => void;
}) {
  const player = slot.player;
  return (
    <Pressable
      disabled={!player}
      onPress={onPress}
      style={({ pressed }) => [
        styles.starterCard,
        compact && styles.starterCardCompact,
        featured && styles.starterCardFeatured,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.starterTop}>
        <Text style={styles.slotLabel}>{slot.label}</Text>
        <Text style={styles.cardOverall}>{player?.overall ?? '--'}</Text>
      </View>
      <View style={styles.cardAvatar}>
        <Text style={styles.cardAvatarText}>{player ? initials(player.name) : '?'}</Text>
      </View>
      <Text style={styles.cardName} numberOfLines={1}>{player?.name.split(' ').slice(-1)[0] ?? 'Empty'}</Text>
      <Text style={styles.cardArchetype} numberOfLines={1}>{player?.archetype ?? 'No player'}</Text>
    </Pressable>
  );
}

function PlayerProfile({
  player,
  subOptions,
  topMarketListing,
  buying,
  onSub,
  onBuyMarket,
  onClose,
}: {
  player: RosterPlayer | null;
  subOptions: RosterPlayer[];
  topMarketListing?: MarketResponse['listings'][0] | null;
  buying: boolean;
  onSub: (playerA: RosterPlayer, playerB: RosterPlayer) => void;
  onBuyMarket: (listingId: string) => void;
  onClose: () => void;
}) {
  const [showSub, setShowSub] = React.useState(false);
  const [expandedSubId, setExpandedSubId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setShowSub(false);
    setExpandedSubId(null);
  }, [player]);

  if (!player) return null;

  return (
    <ProfileSheet
      visible
      onClose={onClose}
      name={player.name}
      subtitle={playerPositionLabel(player.position)}
      initials={initials(player.name)}
      action={{
        label: showSub ? 'Back' : 'Sub',
        tone: 'neutral',
        onPress: () => {
          setShowSub((s) => !s);
          setExpandedSubId(null);
        },
      }}
    >
      {showSub ? (
        <ScrollView contentContainerStyle={{ gap: spacing.md }} showsVerticalScrollIndicator={false}>
          {subOptions.length > 0 ? (
            subOptions.map((subOpt) => {
              const isExpanded = expandedSubId === subOpt.id;
              const lastName = subOpt.name.split(' ').slice(1).join(' ');
              return (
                <View key={subOpt.id} style={[styles.fireCandidateCard, isExpanded && styles.fireCandidateCardExpanded]}>
                  <Pressable
                    style={styles.fireCandidateRow}
                    onPress={() => setExpandedSubId(isExpanded ? null : subOpt.id)}
                  >
                    <View style={styles.fireCandidateAvatar}>
                      <Text style={styles.cardAvatarText}>{initials(subOpt.name)}</Text>
                    </View>
                    <Text style={[typography.body, styles.fireCandidateNameCol]} numberOfLines={1}>
                      {subOpt.name.charAt(0)}. {lastName}
                    </Text>
                    <View style={styles.fireCandidateSpacer} />
                    <Text style={[typography.heading, styles.fireCandidateOvrCol, { color: colors.accent.primary }]}>{subOpt.overall}</Text>
                  </Pressable>
                  {isExpanded && (
                    <View style={styles.fireExpand}>
                      <View style={styles.fireExpandHeader}>
                        <View style={styles.fireExpandIcon}>
                          <Text style={styles.fireExpandIconText}>{initials(subOpt.name)}</Text>
                        </View>
                        <View style={styles.fireExpandBars}>
                          <RatingBar label="OVR" value={subOpt.overall} thick />
                          {Object.entries(subOpt.attributes).map(([label, value]) => (
                            <AttributeBar key={label} label={label} value={value} />
                          ))}
                        </View>
                      </View>
                      <Pressable
                        style={styles.hireButton}
                        onPress={() => onSub(player, subOpt)}
                      >
                        <Text style={styles.hireButtonText}>Sub In</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <View style={{ gap: spacing.md }}>
              <Text style={typography.caption}>No eligible players to sub.</Text>
              {topMarketListing && (
                <View style={[styles.fireCandidateCard, expandedSubId === topMarketListing.id && styles.fireCandidateCardExpanded]}>
                  <Pressable
                    style={styles.fireCandidateRow}
                    onPress={() => setExpandedSubId(expandedSubId === topMarketListing.id ? null : topMarketListing.id)}
                  >
                    <View style={styles.fireCandidateAvatar}>
                      <Text style={styles.cardAvatarText}>{initials(topMarketListing.player.name)}</Text>
                    </View>
                    <Text style={[typography.body, styles.fireCandidateNameCol]} numberOfLines={1}>
                      {topMarketListing.player.name.charAt(0)}. {topMarketListing.player.name.split(' ').slice(1).join(' ')}
                    </Text>
                    <View style={styles.fireCandidateSpacer} />
                    <Text style={[styles.fireCandidateCost, styles.fireCandidateCostCol]}>{formatSalary(topMarketListing.askingPrice)}</Text>
                    <Text style={[typography.heading, styles.fireCandidateOvrCol, { color: colors.accent.primary }]}>{topMarketListing.player.overall}</Text>
                  </Pressable>
                  {expandedSubId === topMarketListing.id && (
                    <View style={styles.fireExpand}>
                      <View style={styles.fireExpandHeader}>
                        <View style={styles.fireExpandIcon}>
                          <Text style={styles.fireExpandIconText}>{initials(topMarketListing.player.name)}</Text>
                        </View>
                        <View style={styles.fireExpandBars}>
                          <RatingBar label="OVR" value={topMarketListing.player.overall} thick />
                        </View>
                      </View>
                      <Pressable
                        style={[styles.hireButton, (!topMarketListing.canBuy || buying) && styles.hireButtonDisabled]}
                        disabled={!topMarketListing.canBuy || buying}
                        onPress={() => onBuyMarket(topMarketListing.id)}
                      >
                        <Text style={styles.hireButtonText}>
                          {buying ? '...' : topMarketListing.canBuy ? 'Buy' : 'No Cash'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ gap: spacing.lg }} showsVerticalScrollIndicator={false}>
          <View style={styles.profileSection}>
            <View style={styles.playStyleRow}>
              <Text style={typography.body}>{player.archetype}</Text>
              <View style={styles.playStyleIconCircle}>
                <Ionicons
                  name={schemeFitIcon(player.schemeFit.label)}
                  size={16}
                  color={schemeFitColor(player.schemeFit.label)}
                />
              </View>
              <View style={{ flex: 1 }} />
              <Text style={typography.caption}>Contract {player.contract.yearsLeft}y</Text>
            </View>

            <RatingBar label="OVR" value={player.overall} thick />
            {Object.entries(player.attributes).map(([label, value]) => (
              <AttributeBar key={label} label={label} value={value} />
            ))}
          </View>

          <View style={styles.statRow}>
            <StatItem label="Record" value="0-0" />
            <StatItem label="Trophies" value={0} />
            <StatItem label="Tenure" value={`${player.yearsWithClub}y`} />
            <StatItem label="Age" value={player.age} />
          </View>
        </ScrollView>
      )}
    </ProfileSheet>
  );
}

function StaffCard({ coach, onPress }: { coach: Coach; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.staffCard, pressed && styles.pressed]}
    >
      <View style={styles.staffCardTop}>
        <Text style={styles.slotLabel}>{coachRoleShort(coach.role)}</Text>
        <Text style={[styles.cardOverall, { color: hotSeatColor(coach.hotSeat) }]}>{coach.reputation}</Text>
      </View>
      <View style={styles.cardAvatar}>
        <Text style={styles.cardAvatarText}>{initials(coach.name)}</Text>
      </View>
      <Text style={styles.cardName} numberOfLines={1}>{coach.name}</Text>
      <Text style={styles.cardArchetype} numberOfLines={1}>{coach.philosophy}</Text>
    </Pressable>
  );
}

function CoachProfile({ coach, onClose }: { coach: Coach | null; onClose: () => void }) {
  const userTeamId = useUserTeamId();
  const queryClient = useQueryClient();
  const [showFire, setShowFire] = React.useState(false);
  const [expandedCandidateId, setExpandedCandidateId] = React.useState<string | null>(null);

  const { data: coachMarket } = useQuery({
    queryKey: ['coachMarket', userTeamId],
    queryFn: () => api.coachMarket(userTeamId!),
    enabled: !!userTeamId && !!coach && showFire,
  });

  const hireCoach = useMutation({
    mutationFn: (coachId: string) => api.hireCoach(userTeamId!, coachId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster', userTeamId] });
      queryClient.invalidateQueries({ queryKey: ['coachMarket', userTeamId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', userTeamId] });
      setShowFire(false);
      setExpandedCandidateId(null);
      onClose();
    },
  });

  React.useEffect(() => {
    if (!coach) {
      setShowFire(false);
      setExpandedCandidateId(null);
    }
  }, [coach]);

  if (!coach) return null;

  const topCandidates = (coachMarket?.candidates ?? [])
    .filter((c) => c.role === coach.role)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 5);

  return (
    <ProfileSheet
      visible
      onClose={onClose}
      name={coach.name}
      subtitle={coachRoleLabel(coach.role)}
      initials={initials(coach.name)}
      action={{
        label: showFire ? 'Back' : 'Fire',
        tone: 'danger',
        onPress: () => {
          setShowFire(!showFire);
          setExpandedCandidateId(null);
        },
      }}
    >
      {showFire ? (
        <ScrollView contentContainerStyle={{ gap: spacing.md }} showsVerticalScrollIndicator={false}>
          {topCandidates.length > 0 ? (
            topCandidates.map((candidate) => {
              const isExpanded = expandedCandidateId === candidate.id;
              return (
                <View key={candidate.id} style={[styles.fireCandidateCard, isExpanded && styles.fireCandidateCardExpanded]}>
                  <Pressable
                    style={styles.fireCandidateRow}
                    onPress={() => setExpandedCandidateId(isExpanded ? null : candidate.id)}
                  >
                    <View style={styles.fireCandidateAvatar}>
                      <Ionicons
                        name={coachPlayStyleIcon(candidate)}
                        size={20}
                        color={coachPlayStyleColor(candidate)}
                      />
                    </View>
                    <Text style={[typography.body, styles.fireCandidateNameCol]} numberOfLines={1}>
                      {candidate.name.charAt(0)}. {candidate.name.split(' ').slice(1).join(' ')}
                    </Text>
                    <View style={styles.fireCandidateSpacer} />
                    <Text style={[styles.fireCandidateCost, styles.fireCandidateCostCol]}>{formatSalary(candidate.cost)}</Text>
                    <Text style={[typography.heading, styles.fireCandidateOvrCol, { color: colors.accent.primary }]}>{candidate.overall}</Text>
                  </Pressable>
                  {isExpanded && (
                    <View style={styles.fireExpand}>
                      <View style={styles.fireExpandHeader}>
                        <View style={styles.fireExpandIcon}>
                          <Text style={styles.fireExpandIconText}>{initials(candidate.name)}</Text>
                        </View>
                        <View style={styles.fireExpandBars}>
                          <RatingBar label="OVR" value={candidate.overall} thick />
                          {candidate.role !== 'DC' && (
                            <RatingBar label="OFF" value={candidate.offenseRating} />
                          )}
                          {candidate.role !== 'OC' && (
                            <RatingBar label="DEF" value={candidate.defenseRating} />
                          )}
                        </View>
                      </View>
                      <Pressable
                        style={[styles.hireButton, (!candidate.canHire || hireCoach.isPending) && styles.hireButtonDisabled]}
                        disabled={!candidate.canHire || hireCoach.isPending}
                        onPress={() => hireCoach.mutate(candidate.id)}
                      >
                        <Text style={styles.hireButtonText}>
                          {hireCoach.isPending ? '...' : candidate.canHire ? 'Hire' : 'No Cash'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <Text style={typography.caption}>No replacement candidates available.</Text>
          )}
        </ScrollView>
      ) : (
        <>
          <View style={styles.profileSection}>
            <View style={styles.playStyleRow}>
              <Text style={typography.body}>{coach.philosophy}</Text>
              <View style={styles.playStyleIconCircle}>
                <Ionicons
                  name={coachPlayStyleIcon(coach)}
                  size={16}
                  color={coachPlayStyleColor(coach)}
                />
              </View>
            </View>

            <RatingBar label="OVR" value={coach.overall} thick />
            {coach.role !== 'DC' && (
              <RatingBar label="OFF" value={coach.offenseRating} />
            )}
            {coach.role !== 'OC' && (
              <RatingBar label="DEF" value={coach.defenseRating} />
            )}
          </View>

          <View style={styles.statRow}>
            <StatItem label="Record" value={`${coach.careerWins}-${coach.careerLosses}`} />
            <StatItem label="Trophies" value={coach.titles} />
            <StatItem label="Tenure" value={`${coach.yearsWithTeam}y`} />
            <StatItem label="Age" value={coach.age} />
          </View>
        </>
      )}
    </ProfileSheet>
  );
}

const OFFENSIVE_PHILOSOPHY_IDENTITY: Record<string, OffensiveIdentity> = {
  'Vertical Architect': 'VERTICAL',
  'Downfield Creator': 'VERTICAL',
  'Air Raid Maestro': 'PASS_HEAVY',
  'Route Chemist': 'PASS_HEAVY',
  'Ground Game Designer': 'RUN_HEAVY',
  'Trench Conductor': 'RUN_HEAVY',
  'Tempo Mixer': 'BALANCED',
  'Balance Builder': 'BALANCED',
};

const DEFENSIVE_PHILOSOPHY_IDENTITY: Record<string, DefensiveIdentity> = {
  'Blitz Designer': 'PRESSURE',
  'Chaos Coordinator': 'PRESSURE',
  'Island Sculptor': 'MAN_HEAVY',
  'Matchup Eraser': 'MAN_HEAVY',
  'Coverage Sculptor': 'ZONE_HEAVY',
  'Shell Master': 'ZONE_HEAVY',
  'Adjustment Artist': 'BALANCED',
  'Two-Level Organizer': 'BALANCED',
};

type HCLean = 'VERY_OFFENSE' | 'OFFENSE' | 'BALANCED' | 'DEFENSE' | 'VERY_DEFENSE';

const HC_PHILOSOPHY_LEAN: Record<string, HCLean> = {
  'Aerial Mastermind':   'VERY_OFFENSE',
  'Offensive Visionary': 'VERY_OFFENSE',
  'Modern Shot-Caller':  'OFFENSE',
  'Tempo Strategist':    'OFFENSE',
  'Program Stabilizer':  'BALANCED',
  'Two-Way General':     'BALANCED',
  'Old-School Builder':  'DEFENSE',
  'Trench Warrior':      'DEFENSE',
  'Defensive Tactician': 'VERY_DEFENSE',
  'Stonewall Strategist':'VERY_DEFENSE',
};

type CoachLike = { role: string; philosophy: string; offenseRating?: number; defenseRating?: number };

function hcLeanFromCoach(coach: CoachLike): HCLean {
  const fromName = HC_PHILOSOPHY_LEAN[coach.philosophy];
  if (fromName) return fromName;
  const diff = (coach.offenseRating ?? 60) - (coach.defenseRating ?? 60);
  if (diff >= 15) return 'VERY_OFFENSE';
  if (diff >= 5)  return 'OFFENSE';
  if (diff > -5)  return 'BALANCED';
  if (diff > -15) return 'DEFENSE';
  return 'VERY_DEFENSE';
}

const HC_PHILOSOPHY_ICON: Record<string, IoniconName> = {
  'Aerial Mastermind':   'rocket-outline',
  'Offensive Visionary': 'flame-outline',
  'Modern Shot-Caller':  'send-outline',
  'Tempo Strategist':    'speedometer-outline',
  'Program Stabilizer':  'podium-outline',
  'Two-Way General':     'swap-horizontal-outline',
  'Old-School Builder':  'hammer-outline',
  'Trench Warrior':      'barbell-outline',
  'Defensive Tactician': 'analytics-outline',
  'Stonewall Strategist':'shield-checkmark-outline',
};

function hcLeanFallbackIcon(lean: HCLean): IoniconName {
  if (lean === 'VERY_OFFENSE') return 'rocket-outline';
  if (lean === 'OFFENSE')      return 'send-outline';
  if (lean === 'BALANCED')     return 'swap-horizontal-outline';
  if (lean === 'DEFENSE')      return 'shield-outline';
  return 'shield-checkmark-outline';
}

function hcLeanColor(lean: HCLean): string {
  if (lean === 'VERY_OFFENSE' || lean === 'OFFENSE') return colors.identity.pass;
  if (lean === 'BALANCED') return colors.identity.bal;
  return colors.identity.zone;
}

function coachPlayStyleIcon(coach: CoachLike): IoniconName {
  if (coach.role === 'HEAD_COACH') return HC_PHILOSOPHY_ICON[coach.philosophy] ?? hcLeanFallbackIcon(hcLeanFromCoach(coach));
  if (coach.role === 'DC') {
    const id = DEFENSIVE_PHILOSOPHY_IDENTITY[coach.philosophy] ?? 'BALANCED';
    return defensiveIdentityIcon(id);
  }
  const id = OFFENSIVE_PHILOSOPHY_IDENTITY[coach.philosophy] ?? 'BALANCED';
  return offensiveIdentityIcon(id);
}

function coachPlayStyleColor(coach: CoachLike): string {
  if (coach.role === 'HEAD_COACH') return hcLeanColor(hcLeanFromCoach(coach));
  if (coach.role === 'DC') {
    const id = DEFENSIVE_PHILOSOPHY_IDENTITY[coach.philosophy] ?? 'BALANCED';
    return defensiveIdentityColor(id);
  }
  const id = OFFENSIVE_PHILOSOPHY_IDENTITY[coach.philosophy] ?? 'BALANCED';
  return offensiveIdentityColor(id);
}

function AttributeBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.attributeRow}>
      <Text style={styles.attributeLabel}>{formatAttribute(label)}</Text>
      <View style={styles.attributeTrack}>
        <View style={[styles.attributeFill, { width: `${value}%` }]} />
      </View>
      <Text style={styles.attributeValue}>{value}</Text>
    </View>
  );
}

function RatingBar({ label, value, thick }: { label: string; value: number; thick?: boolean }) {
  return (
    <View style={styles.attributeRow}>
      <Text style={[styles.attributeLabel, thick && styles.ratingLabelStrong]}>{label}</Text>
      <View style={[styles.attributeTrack, thick && styles.ratingTrackThick]}>
        <View style={[styles.attributeFill, { width: `${value}%` }, thick && styles.ratingFillStrong]} />
      </View>
      <Text style={[styles.attributeValue, thick && styles.ratingValueStrong]}>{value}</Text>
    </View>
  );
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statItem}>
      <Text style={typography.label}>{label}</Text>
      <Text style={styles.statItemValue}>{value}</Text>
    </View>
  );
}

function schemeFitColor(fit: RosterPlayer['schemeFit']['label']): string {
  if (fit === 'Excellent Fit') return colors.success;
  if (fit === 'Solid Fit') return colors.accent.primary;
  return colors.warn;
}

function schemeFitIcon(fit: RosterPlayer['schemeFit']['label']): IoniconName {
  if (fit === 'Excellent Fit') return 'checkmark-circle-outline';
  if (fit === 'Solid Fit') return 'checkmark-outline';
  return 'trending-up-outline';
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function offensiveIdentityIcon(identity: OffensiveIdentity): IoniconName {
  const icons: Record<OffensiveIdentity, IoniconName> = {
    VERTICAL: 'rocket-outline',
    RUN_HEAVY: 'footsteps-outline',
    PASS_HEAVY: 'send-outline',
    BALANCED: 'options-outline',
  };
  return icons[identity];
}

function defensiveIdentityIcon(identity: DefensiveIdentity): IoniconName {
  const icons: Record<DefensiveIdentity, IoniconName> = {
    PRESSURE: 'flash-outline',
    MAN_HEAVY: 'person-outline',
    ZONE_HEAVY: 'grid-outline',
    BALANCED: 'shield-checkmark-outline',
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

function hotSeatColor(value: number): string {
  if (value >= 75) return colors.danger;
  if (value >= 50) return colors.warn;
  return colors.success;
}

function coachRoleShort(role: string): string {
  if (role === 'HEAD_COACH') return 'HC';
  return role;
}

function coachRoleLabel(role: string): string {
  if (role === 'HEAD_COACH') return 'Head Coach';
  if (role === 'OC') return 'Offensive Coordinator';
  if (role === 'DC') return 'Defensive Coordinator';
  return role;
}

function playerPositionLabel(position: string): string {
  const labels: Record<string, string> = {
    QB: 'Quarterback',
    RB: 'Running Back',
    WR: 'Wide Receiver',
    TE: 'Tight End',
    OL: 'Offensive Lineman',
    DE: 'Defensive End',
    DT: 'Defensive Tackle',
    LB: 'Linebacker',
    CB: 'Cornerback',
    S: 'Safety',
  };
  return labels[position] ?? position;
}

function formatSalary(value: number): string {
  return `$${(value / 1_000_000).toFixed(1)}M`;
}

function initials(name: string): string {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function formatAttribute(label: string): string {
  return label.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}

const styles = StyleSheet.create({
  screenContent: {
    flex:          1,
    paddingTop:    spacing.sm,
    paddingBottom: spacing.sm,
    gap:           spacing.sm,
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metric: {
    width: '31%',
    minWidth: 86,
    backgroundColor: colors.bg.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
  schemeButton: {
    minHeight: 38,
    borderRadius: radius.md,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  schemeButtonText: {
    ...typography.label,
    color: colors.text.primary,
    fontWeight: '800',
  },
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
  identityIconRow: {
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
  },
  identityIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  philosophyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  philosophyOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  philosophyOptionActive: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  philosophyText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '700',
  },
  philosophyTextActive: {
    color: colors.bg.base,
  },
  staffGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  staffCard: {
    width: '31.5%',
    minHeight: 112,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    gap: spacing.xs,
  },
  staffCardTop: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rosterPanel: {
    flex: 1,
    minHeight: 0,
  },
  unitHeader: {
    gap: spacing.sm,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  unitButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitButtonActive: {
    backgroundColor: colors.bg.surface,
  },
  unitButtonText: {
    ...typography.label,
    color: colors.text.muted,
  },
  unitButtonTextActive: {
    color: colors.text.primary,
  },
  field: {
    flex: 1,
    minHeight: 0,
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.xs,
    gap: spacing.xs,
    overflow: 'hidden',
    backgroundColor: '#111B16',
    borderWidth: 1,
    borderColor: colors.border,
  },
  yardLineTop: {
    position: 'absolute',
    top: '30%',
    left: spacing.md,
    right: spacing.md,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  yardLineMiddle: {
    position: 'absolute',
    top: '60%',
    left: spacing.md,
    right: spacing.md,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  yardLineBottom: {
    position: 'absolute',
    bottom: 44,
    left: spacing.md,
    right: spacing.md,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  fieldRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  middleFieldRow: {
    paddingHorizontal: spacing.xl,
  },
  starterCard: {
    flex: 1,
    maxWidth: 86,
    minHeight: 118,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    gap: spacing.xs,
  },
  starterCardCompact: {
    maxWidth: 62,
    minHeight: 108,
    paddingHorizontal: spacing.xs,
  },
  starterCardFeatured: {
    maxWidth: 96,
    borderColor: colors.accent.primary,
  },
  starterTop: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slotLabel: {
    ...typography.label,
    color: colors.text.secondary,
    fontSize: 10,
  },
  cardOverall: {
    color: colors.accent.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  cardAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardAvatarText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '800',
  },
  cardName: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '800',
    width: '100%',
    textAlign: 'center',
  },
  cardArchetype: {
    color: colors.text.secondary,
    fontSize: 10,
    width: '100%',
    textAlign: 'center',
  },
  pressed: {
    backgroundColor: colors.bg.surface,
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
  },
  marketOptionCard: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buyButton: {
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  buyButtonText: {
    ...typography.caption,
    color: colors.bg.elevated,
    fontWeight: '700',
  },
  profileSection: {
    gap: spacing.sm,
  },
  playStyleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  playStyleIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratingLabelStrong: {
    color: colors.text.primary,
    fontWeight: '800',
  },
  ratingTrackThick: {
    height: 10,
  },
  ratingFillStrong: {
    backgroundColor: colors.accent.primary,
  },
  ratingValueStrong: {
    color: colors.text.primary,
    fontWeight: '800',
  },
  fireCandidateCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fireCandidateCardExpanded: {
    borderColor: colors.accent.primary,
  },
  fireCandidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  fireExpand: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: 0,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fireExpandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  fireExpandIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fireExpandIconText: {
    ...typography.heading,
    color: colors.text.secondary,
  },
  fireExpandBars: {
    flex: 1,
    gap: spacing.xs,
  },
  hireButton: {
    paddingVertical: spacing.md,
    backgroundColor: colors.accent.primary,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  hireButtonText: {
    ...typography.label,
    color: colors.bg.elevated,
    fontWeight: '800',
  },
  hireButtonDisabled: {
    backgroundColor: colors.bg.elevated,
    opacity: 0.7,
  },
  fireCandidateAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  fireCandidateNameCol: {
    width: 75,
  },
  fireCandidateSpacer: {
    flex: 1,
  },
  fireCandidateCostCol: {
    width: 60,
    textAlign: 'right',
  },
  fireCandidateOvrCol: {
    width: 32,
    textAlign: 'right',
  },
  fireCandidateIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fireCandidateCost: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '700',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statItemValue: {
    ...typography.heading,
    color: colors.text.primary,
  },
  fitDetail: {
    marginTop: spacing.xs,
  },
  buyButtonDisabled: {
    backgroundColor: colors.bg.elevated,
    opacity: 0.7,
  },
  attributeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 28,
  },
  attributeLabel: {
    ...typography.caption,
    width: 104,
  },
  attributeTrack: {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bg.surface,
    overflow: 'hidden',
  },
  attributeFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent.primary,
  },
  attributeValue: {
    ...typography.caption,
    width: 28,
    textAlign: 'right',
    color: colors.text.primary,
    fontWeight: '700',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusTile: {
    width: '48%',
    backgroundColor: colors.bg.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
