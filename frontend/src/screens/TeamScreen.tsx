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
import { DefensiveIdentity, OffensiveIdentity, PlayerFreeAgentResponse, RosterPlayer, RosterResponse } from '../api/types';
import { ContractValue } from '../components/ContractValue';
import { ProfileSheet } from '../components/ProfileSheet';
import { ScreenContainer } from '../components/ScreenContainer';
import { useUserTeamId } from '../state/userTeam';
import { colors, radius, spacing, typography } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { teamArchetypeLabel } from '../utils/teamArchetype';

type RosterGroup = RosterResponse['groups'][number];
type Coach = RosterResponse['team']['coaches'][number];
type PlayerFreeAgent = PlayerFreeAgentResponse['candidates'][number];
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

  const { data: freeAgentData } = useQuery({
    queryKey: ['playerFreeAgents', userTeamId, selectedPlayer?.position],
    queryFn: () => api.playerFreeAgents(userTeamId!, selectedPlayer!.position, 5),
    enabled: !!userTeamId && !!selectedPlayer,
  });

  const signFreeAgent = useMutation({
    mutationFn: (playerId: string) => api.signFreeAgent(userTeamId!, playerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster', userTeamId] });
      queryClient.invalidateQueries({ queryKey: ['playerFreeAgents', userTeamId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', userTeamId] });
      setSelectedPlayer(null);
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
  const benchSubOptions = subOptions.slice(0, 5);
  const freeAgentOptions = (freeAgentData?.candidates ?? []).slice(0, Math.max(0, 5 - benchSubOptions.length));

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
        <View style={styles.field}>
          <View style={styles.yardLineTop} />
          <View style={styles.yardLineMiddle} />
          <View style={styles.yardLineBottom} />

          <Pressable
            onPress={() => navigation.navigate('ChooseScheme', { unit })}
            style={({ pressed }) => [styles.schemeButton, pressed && styles.pressed]}
          >
            <Text style={styles.schemeButtonText}>Change {unit === 'offense' ? 'Offensive' : 'Defensive'} Playbook</Text>
          </Pressable>

          {unit === 'offense' ? (
            <>
              {/* Row 1: line of scrimmage — T G C G T */}
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
              {/* Row 2: receivers — WR WR TE */}
              <View style={styles.fieldRow}>
                {activeSlots.slice(5, 8).map((slot) => (
                  <StarterCard
                    key={slot.id}
                    slot={slot}
                    onPress={() => slot.player && setSelectedPlayer(slot.player)}
                  />
                ))}
              </View>
              {/* Row 3: backfield — RB QB RB */}
              <View style={styles.fieldRow}>
                {activeSlots.slice(8, 11).map((slot) => (
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

      <View style={styles.unitHeader}>
        <View style={styles.segmented}>
          <UnitButton label="Offense" active={unit === 'offense'} onPress={() => setUnit('offense')} />
          <UnitButton label="Defense" active={unit === 'defense'} onPress={() => setUnit('defense')} />
        </View>
      </View>

      <PlayerProfile
        player={selectedPlayer}
        subOptions={benchSubOptions}
        freeAgentOptions={freeAgentOptions}
        signing={signFreeAgent.isPending}
        onSub={swapPlayers}
        onSignFreeAgent={(playerId) => signFreeAgent.mutate(playerId)}
        onClose={() => setSelectedPlayer(null)}
      />
      <CoachProfile coach={selectedCoach} onClose={() => setSelectedCoach(null)} />
    </ScreenContainer>
  );
};

function buildOffenseSlots(players: RosterPlayer[]): Slot[] {
  const byPosition = playersByPosition(players);
  return [
    // Row 1: line of scrimmage — T G C G T
    { id: 'lt', label: 'T', player: byPosition.OL?.[0] },
    { id: 'lg', label: 'G', player: byPosition.OL?.[1] },
    { id: 'c', label: 'C', player: byPosition.OL?.[2] },
    { id: 'rg', label: 'G', player: byPosition.OL?.[3] },
    { id: 'rt', label: 'T', player: byPosition.OL?.[4] },
    // Row 2: receivers — WR WR TE
    { id: 'wr1', label: 'WR', player: byPosition.WR?.[0] },
    { id: 'wr2', label: 'WR', player: byPosition.WR?.[1] },
    { id: 'te1', label: 'TE', player: byPosition.TE?.[0] },
    // Row 3: backfield — RB QB RB
    { id: 'rb1', label: 'RB', player: byPosition.RB?.[0] },
    { id: 'qb1', label: 'QB', player: byPosition.QB?.[0] },
    { id: 'rb2', label: 'RB', player: byPosition.RB?.[1] },
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
    </Pressable>
  );
}

function PlayerProfile({
  player,
  subOptions,
  freeAgentOptions,
  signing,
  onSub,
  onSignFreeAgent,
  onClose,
}: {
  player: RosterPlayer | null;
  subOptions: RosterPlayer[];
  freeAgentOptions: PlayerFreeAgent[];
  signing: boolean;
  onSub: (playerA: RosterPlayer, playerB: RosterPlayer) => void;
  onSignFreeAgent: (playerId: string) => void;
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
          {subOptions.length + freeAgentOptions.length > 0 ? (
            <>
            {subOptions.length > 0 && <Text style={styles.subSectionHeader}>Bench</Text>}
            {subOptions.map((subOpt) => {
              const isExpanded = expandedSubId === subOpt.id;
              const lastName = subOpt.name.split(' ').slice(1).join(' ');
              return (
                <View key={subOpt.id} style={[styles.fireCandidateCard, isExpanded && styles.fireCandidateCardExpanded]}>
                  <Pressable
                    style={styles.fireCandidateRow}
                    onPress={() => setExpandedSubId(isExpanded ? null : subOpt.id)}
                  >
                    <View style={styles.fireCandidateAvatar}>
                      <Ionicons
                        name={schemeFitIcon(subOpt.schemeFit.label)}
                        size={20}
                        color={schemeFitColor(subOpt.schemeFit.label)}
                      />
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
                        <View style={styles.fireExpandAvatarCol}>
                          <View style={styles.fireExpandIcon}>
                            <Text style={styles.fireExpandIconText}>{initials(subOpt.name)}</Text>
                          </View>
                          <Text style={styles.fireExpandAge}>Age: {subOpt.age}</Text>
                        </View>
                        <View style={styles.fireExpandBars}>
                          <RatingBar label="Overall" value={subOpt.overall} thick />
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
            })}
            {freeAgentOptions.length > 0 && <Text style={styles.subSectionHeader}>Free Agents</Text>}
            {freeAgentOptions.map((freeAgent) => {
              const isExpanded = expandedSubId === freeAgent.id;
              return (
                <View key={freeAgent.id} style={[styles.fireCandidateCard, isExpanded && styles.fireCandidateCardExpanded]}>
                  <Pressable
                    style={styles.fireCandidateRow}
                    onPress={() => setExpandedSubId(isExpanded ? null : freeAgent.id)}
                  >
                    <View style={styles.fireCandidateAvatar}>
                      <Ionicons
                        name={'person-add-outline'}
                        size={20}
                        color={colors.accent.primary}
                      />
                    </View>
                    <Text style={[typography.body, styles.fireCandidateNameCol]} numberOfLines={1}>
                      {freeAgent.name.charAt(0)}. {freeAgent.name.split(' ').slice(1).join(' ')}
                    </Text>
                    <View style={styles.fireCandidateSpacer} />
                    <Text style={[typography.heading, styles.fireCandidateOvrCol, { color: colors.accent.primary }]}>{freeAgent.overall}</Text>
                  </Pressable>
                  {isExpanded && (
                    <View style={styles.fireExpand}>
                      <View style={styles.fireExpandHeader}>
                        <View style={styles.fireExpandAvatarCol}>
                          <View style={styles.fireExpandIcon}>
                            <Text style={styles.fireExpandIconText}>{initials(freeAgent.name)}</Text>
                          </View>
                          <Text style={styles.fireExpandAge}>Age: {freeAgent.age}</Text>
                        </View>
                        <View style={styles.fireExpandBars}>
                          <RatingBar label="Overall" value={freeAgent.overall} thick />
                          {Object.entries(freeAgent.attributes).map(([label, value]) => (
                            <AttributeBar key={label} label={label} value={value} />
                          ))}
                        </View>
                      </View>
                      <Pressable
                        style={[styles.hireButton, (!freeAgent.canSign || signing) && styles.hireButtonDisabled]}
                        disabled={!freeAgent.canSign || signing}
                        onPress={() => onSignFreeAgent(freeAgent.id)}
                      >
                        <Text style={styles.hireButtonText}>
                          {signing ? '...' : freeAgent.canSign ? 'Sign' : 'No Cap'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
            </>
          ) : (
            <Text style={typography.caption}>No eligible players available.</Text>
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
              <ContractValue
                amount={player.contract.salary * player.contract.yearsLeft}
                years={player.contract.yearsLeft}
                compact
              />
            </View>

            <RatingBar label="Overall" value={player.overall} thick />
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
        <Text style={styles.slotLabel}>{coach.position}</Text>
        <Text style={[styles.cardOverall, { color: colors.accent.primary }]}>{coach.overall}</Text>
      </View>
      <View style={styles.cardAvatar}>
        <Text style={styles.cardAvatarText}>{initials(coach.name)}</Text>
      </View>
      <Text style={styles.cardName} numberOfLines={1}>{coach.name}</Text>
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
    .filter((c) => c.position === coach.position)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 5);

  return (
    <ProfileSheet
      visible
      onClose={onClose}
      name={coach.name}
      subtitle={coachPositionLabel(coach.position)}
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
                    <View style={styles.fireCandidateCostCol}>
                      <ContractValue amount={candidate.salary} years={candidate.contractYearsLeft} compact perYear />
                    </View>
                    <Text style={[typography.heading, styles.fireCandidateOvrCol, { color: colors.accent.primary }]}>{candidate.overall}</Text>
                  </Pressable>
                  {isExpanded && (
                    <View style={styles.fireExpand}>
                      <View style={styles.fireExpandHeader}>
                        <View style={styles.fireExpandAvatarCol}>
                          <View style={styles.fireExpandIcon}>
                            <Text style={styles.fireExpandIconText}>{initials(candidate.name)}</Text>
                          </View>
                          <Text style={styles.fireExpandAge}>Age: {candidate.age}</Text>
                        </View>
                        <View style={styles.fireExpandBars}>
                          <RatingBar label="Overall" value={candidate.overall} thick />
                          <RatingBar label={candidate.statLabels[0]} value={candidate.stat1} />
                          <RatingBar label={candidate.statLabels[1]} value={candidate.stat2} />
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
              <Text style={typography.body}>{coach.archetype}</Text>
              <View style={styles.playStyleIconCircle}>
                <Ionicons
                  name={coachPlayStyleIcon(coach)}
                  size={16}
                  color={coachPlayStyleColor(coach)}
                />
              </View>
              <View style={{ flex: 1 }} />
              <ContractValue amount={coach.salary} years={coach.contractYearsLeft} compact perYear />
            </View>

            <RatingBar label="Overall" value={coach.overall} thick />
            <RatingBar label={coach.statLabels[0]} value={coach.stat1} />
            <RatingBar label={coach.statLabels[1]} value={coach.stat2} />
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
  // OC philosophies (new ratio-based)
  'Air Raid Maestro': 'PASS_HEAVY',
  'Vertical Architect': 'VERTICAL',
  'Route Chemist': 'PASS_HEAVY',
  'Downfield Creator': 'VERTICAL',
  'Tempo Mixer': 'BALANCED',
  'Balance Builder': 'BALANCED',
  'Ground Game Designer': 'RUN_HEAVY',
  'Trench Conductor': 'RUN_HEAVY',
  'Smashmouth Specialist': 'RUN_HEAVY',
  'Power Run Guru': 'RUN_HEAVY',
};

const DEFENSIVE_PHILOSOPHY_IDENTITY: Record<string, DefensiveIdentity> = {
  // DC philosophies (new ratio-based)
  'Run Stuffer': 'BALANCED',
  'Gap Destroyer': 'PRESSURE',
  'Front Seven Anchor': 'BALANCED',
  'Downhill Stopper': 'BALANCED',
  'Adjustment Artist': 'BALANCED',
  'Two-Level Organizer': 'BALANCED',
  'Coverage Sculptor': 'ZONE_HEAVY',
  'Shell Master': 'ZONE_HEAVY',
  'Blitz Designer': 'PRESSURE',
  'Chaos Coordinator': 'PRESSURE',
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

type CoachLike = { position: string; archetype: string; stat1?: number; stat2?: number };

function hcLeanFromCoach(coach: CoachLike): HCLean {
  const fromName = HC_PHILOSOPHY_LEAN[coach.archetype];
  if (fromName) return fromName;
  const diff = (coach.stat1 ?? 60) - (coach.stat2 ?? 60);
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
  if (coach.position === 'HC') return HC_PHILOSOPHY_ICON[coach.archetype] ?? hcLeanFallbackIcon(hcLeanFromCoach(coach));
  if (coach.position === 'DC') {
    const id = DEFENSIVE_PHILOSOPHY_IDENTITY[coach.archetype] ?? 'BALANCED';
    return defensiveIdentityIcon(id);
  }
  const id = OFFENSIVE_PHILOSOPHY_IDENTITY[coach.archetype] ?? 'BALANCED';
  return offensiveIdentityIcon(id);
}

function coachPlayStyleColor(coach: CoachLike): string {
  if (coach.position === 'HC') return hcLeanColor(hcLeanFromCoach(coach));
  if (coach.position === 'DC') {
    const id = DEFENSIVE_PHILOSOPHY_IDENTITY[coach.archetype] ?? 'BALANCED';
    return defensiveIdentityColor(id);
  }
  const id = OFFENSIVE_PHILOSOPHY_IDENTITY[coach.archetype] ?? 'BALANCED';
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

function coachPositionLabel(position: string): string {
  if (position === 'HC') return 'Head Coach';
  if (position === 'OC') return 'Offensive Coordinator';
  if (position === 'DC') return 'Defensive Coordinator';
  return position;
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
    width: '92%',
    alignSelf: 'center',
    minHeight: 38,
    borderRadius: radius.md,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
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
    minHeight: 116,
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
  staffCardFooter: {
    width: '100%',
    alignItems: 'center',
    gap: 2,
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
    maxWidth: 100,
    minHeight: 120,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    gap: spacing.xs,
  },
  starterCardCompact: {
    maxWidth: 72,
    minHeight: 110,
    paddingHorizontal: spacing.xs,
  },
  starterCardFeatured: {
    maxWidth: 110,
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
  subSectionHeader: {
    ...typography.label,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  fireExpandAvatarCol: {
    alignItems: 'center',
    gap: spacing.xs,
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
  fireExpandAge: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '800',
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
    width: 96,
    alignItems: 'flex-end',
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
