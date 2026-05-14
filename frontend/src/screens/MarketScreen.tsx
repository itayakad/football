import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../api/client';
import { MarketPlayer, MarketResponse, RosterPlayer } from '../api/types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Pill, pillColor, pillLabel } from '../components/Pill';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionLabel } from '../components/SectionLabel';
import { useUserTeamId } from '../state/userTeam';
import { colors, radius, spacing, typography } from '../theme';

type Listing = MarketResponse['listings'][number];

export const MarketScreen: React.FC = () => {
  const userTeamId = useUserTeamId();
  const queryClient = useQueryClient();

  const market = useQuery({
    queryKey: ['market', userTeamId],
    queryFn: () => api.market(userTeamId!),
    enabled: !!userTeamId,
  });
  const roster = useQuery({
    queryKey: ['roster', userTeamId],
    queryFn: () => api.roster(userTeamId!),
    enabled: !!userTeamId,
  });
  const coachMarket = useQuery({
    queryKey: ['coachMarket', userTeamId],
    queryFn: () => api.coachMarket(userTeamId!),
    enabled: !!userTeamId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['market', userTeamId] });
    queryClient.invalidateQueries({ queryKey: ['roster', userTeamId] });
  };

  const hireCoach = useMutation({
    mutationFn: (coachId: string) => api.hireCoach(userTeamId!, coachId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster', userTeamId] });
      queryClient.invalidateQueries({ queryKey: ['coachMarket', userTeamId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', userTeamId] });
    },
  });

  const buy = useMutation({
    mutationFn: (listingId: string) => api.buyListing(listingId, userTeamId!),
    onSuccess: refresh,
  });
  const list = useMutation({
    mutationFn: (playerId: string) => api.listPlayer(userTeamId!, playerId),
    onSuccess: refresh,
  });
  const delist = useMutation({
    mutationFn: (listingId: string) => api.delistPlayer(listingId, userTeamId!),
    onSuccess: refresh,
  });
  const accept = useMutation({
    mutationFn: (offerId: string) => api.acceptOffer(offerId, userTeamId!),
    onSuccess: refresh,
  });
  const reject = useMutation({
    mutationFn: (offerId: string) => api.rejectOffer(offerId, userTeamId!),
    onSuccess: refresh,
  });

  if (!userTeamId || market.isLoading || roster.isLoading) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing.xxxl }} />
      </ScreenContainer>
    );
  }

  if (!market.data || !roster.data || market.error || roster.error) {
    return (
      <ScreenContainer>
        <Text style={typography.body}>Failed to load transfer market. Is the backend running?</Text>
      </ScreenContainer>
    );
  }

  const userListings = market.data.listings.filter((listing) => listing.sellerTeam.id === userTeamId);
  const externalListings = market.data.listings.filter((listing) => listing.sellerTeam.id !== userTeamId);
  const allPlayers = roster.data.groups.flatMap((group) => group.players);
  const listedIds = new Set(userListings.map((listing) => listing.player.id));
  const tradeChips = allPlayers
    .filter((player) => !listedIds.has(player.id))
    .sort((a, b) => tradeChipScore(b) - tradeChipScore(a))
    .slice(0, 6);
  const capPct = Math.min(100, Math.round((market.data.team.salaryUsed / market.data.team.salaryCap) * 100));

  return (
    <ScreenContainer>
      <View>
        <Text style={typography.label}>Transfer Market</Text>
        <Text style={[typography.display, styles.title]}>Market</Text>
      </View>

      <Card>
        <View style={styles.financeRow}>
          <FinanceMetric label="Cash" value={formatMoney(market.data.team.money)} tone={colors.success} />
          <FinanceMetric label="Cap Used" value={`${capPct}%`} tone={capPct > 92 ? colors.warn : colors.text.secondary} />
          <FinanceMetric label="Space" value={formatMoney(market.data.team.capSpace)} tone={market.data.team.capSpace < 8_000_000 ? colors.warn : colors.text.primary} />
        </View>
        <View style={styles.capTrack}>
          <View style={[styles.capFill, { width: `${capPct}%`, backgroundColor: capPct > 92 ? colors.warn : colors.accent.primary }]} />
        </View>
      </Card>

      {userListings.length > 0 && (
        <View>
          <SectionLabel>Your Listings</SectionLabel>
          {userListings.map((listing) => (
            <MarketCard
              key={listing.id}
              listing={listing}
              actionLabel="Delist"
              actionTone={colors.text.secondary}
              onAction={() => delist.mutate(listing.id)}
            />
          ))}
        </View>
      )}

      {market.data.incomingOffers.length > 0 && (
        <View>
          <SectionLabel>Incoming Offers</SectionLabel>
          {market.data.incomingOffers.map((offer) => (
            <Card key={offer.id} style={styles.marketCard}>
              <View style={styles.cardHeader}>
                <View style={styles.playerBadge}>
                  <Text style={styles.badgeOverall}>{offer.player.overall}</Text>
                  <Text style={styles.badgePosition}>{offer.player.position}</Text>
                </View>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName} numberOfLines={1}>{offer.player.name}</Text>
                  <Text style={typography.caption} numberOfLines={1}>
                    {offer.buyerTeam.name} offered {formatMoney(offer.amount)}
                  </Text>
                </View>
              </View>
              <View style={styles.offerActions}>
                <Pressable onPress={() => reject.mutate(offer.id)} style={styles.offerButton}>
                  <Text style={[styles.actionText, { color: colors.text.secondary }]}>Reject</Text>
                </Pressable>
                <Pressable onPress={() => accept.mutate(offer.id)} style={styles.offerButton}>
                  <Text style={[styles.actionText, { color: colors.success }]}>Accept</Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}

      <View>
        <SectionLabel>Available Targets</SectionLabel>
        {externalListings.map((listing) => (
          <MarketCard
            key={listing.id}
            listing={listing}
            actionLabel={listing.canBuy ? 'Buy' : 'Blocked'}
            actionTone={listing.canBuy ? colors.accent.primary : colors.text.muted}
            disabled={!listing.canBuy || buy.isPending}
            onAction={() => buy.mutate(listing.id)}
          />
        ))}
      </View>

      <View>
        <SectionLabel>Trade Chips</SectionLabel>
        {tradeChips.map((player) => (
          <TradeChipCard
            key={player.id}
            player={player}
            onList={() => list.mutate(player.id)}
            disabled={list.isPending}
          />
        ))}
      </View>

      {coachMarket.data && coachMarket.data.candidates.length > 0 && (
        <View>
          <SectionLabel>Available Staff</SectionLabel>
          {coachMarket.data.candidates.map((coach) => (
            <Card key={coach.id} style={styles.marketCard}>
              <View style={styles.cardHeader}>
                <View style={styles.staffBadge}>
                  <Text style={styles.staffBadgeText}>{coachRoleShort(coach.role)}</Text>
                </View>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName} numberOfLines={1}>{coach.name}</Text>
                  <Text style={typography.caption} numberOfLines={1}>
                    {coach.philosophy} / {coachSpecialtyLabel(coach.role, coach.developmentSpecialty)}
                  </Text>
                  <Text style={[typography.caption, styles.story]} numberOfLines={2}>
                    {coach.story}
                  </Text>
                </View>
                <View style={styles.staffSide}>
                  <Text style={styles.staffRep}>{coach.reputation}</Text>
                  <Text style={typography.caption}>{formatMoney(coach.cost)}</Text>
                </View>
              </View>
              <Button
                label={`Hire ${coachRoleShort(coach.role)}`}
                onPress={() => hireCoach.mutate(coach.id)}
                loading={hireCoach.isPending}
                disabled={!coach.canHire}
                style={styles.hireButton}
              />
            </Card>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
};

function coachRoleShort(role: string): string {
  if (role === 'HEAD_COACH') return 'HC';
  return role;
}

function coachSpecialtyLabel(_role: string, specialty: string): string {
  return `${specialty} dev`;
}

function MarketCard({
  listing,
  actionLabel,
  actionTone,
  disabled,
  onAction,
}: {
  listing: Listing;
  actionLabel: string;
  actionTone: string;
  disabled?: boolean;
  onAction: () => void;
}) {
  const { player } = listing;
  return (
    <Card style={styles.marketCard}>
      <View style={styles.cardHeader}>
        <View style={styles.playerBadge}>
          <Text style={styles.badgeOverall}>{player.overall}</Text>
          <Text style={styles.badgePosition}>{player.position}</Text>
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
          <Text style={typography.caption} numberOfLines={1}>{player.archetype} / Age {player.age}</Text>
          <View style={styles.pillRow}>
            <Pill label={pillLabel(listing.sellerTeam.identity.offense)} color={pillColor(listing.sellerTeam.identity.offense)} />
            <Pill label={pillLabel(listing.sellerTeam.identity.defense)} color={pillColor(listing.sellerTeam.identity.defense)} />
          </View>
        </View>
        <Pressable disabled={disabled} onPress={onAction} style={[styles.actionButton, disabled && styles.disabled]}>
          <Text style={[styles.actionText, { color: actionTone }]}>{actionLabel}</Text>
        </Pressable>
      </View>
      <Text style={[typography.caption, styles.story]}>{player.story}</Text>
      <View style={styles.marketMeta}>
        <Meta label="Price" value={formatMoney(listing.askingPrice)} />
        <Meta label="Salary" value={formatMoney(player.contract.salary)} />
        <Meta label="Deal" value={`${player.contract.yearsLeft}y`} />
        <Meta label="From" value={listing.sellerTeam.name.split(' ').slice(-1)[0]} />
      </View>
    </Card>
  );
}

function TradeChipCard({ player, onList, disabled }: { player: RosterPlayer; onList: () => void; disabled?: boolean }) {
  return (
    <Card style={styles.marketCard}>
      <View style={styles.cardHeader}>
        <View style={styles.playerBadge}>
          <Text style={styles.badgeOverall}>{player.overall}</Text>
          <Text style={styles.badgePosition}>{player.position}</Text>
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
          <Text style={typography.caption} numberOfLines={1}>{player.archetype} / {player.contract.yearsLeft}y left</Text>
        </View>
        <Pressable disabled={disabled} onPress={onList} style={[styles.actionButton, disabled && styles.disabled]}>
          <Text style={[styles.actionText, { color: colors.warn }]}>List</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function FinanceMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={styles.financeMetric}>
      <Text style={typography.label}>{label}</Text>
      <Text style={[typography.heading, { color: tone }]}>{value}</Text>
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={typography.label}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function tradeChipScore(player: RosterPlayer): number {
  return (player.age >= 31 ? 12 : 0) + (player.contract.yearsLeft === 1 ? 10 : 0) + player.overall * 0.1;
}

function formatMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(value / 1_000)}K`;
}

const styles = StyleSheet.create({
  title: {
    marginTop: spacing.xs,
  },
  financeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  financeMetric: {
    flex: 1,
    backgroundColor: colors.bg.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
  capTrack: {
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.bg.surface,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  capFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  marketCard: {
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  playerBadge: {
    width: 58,
    minHeight: 70,
    borderRadius: radius.md,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeOverall: {
    color: colors.accent.primary,
    fontSize: 22,
    fontWeight: '800',
  },
  badgePosition: {
    ...typography.label,
    color: colors.text.secondary,
  },
  playerInfo: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  playerName: {
    ...typography.body,
    fontWeight: '800',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actionButton: {
    minWidth: 66,
    minHeight: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  disabled: {
    opacity: 0.45,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '800',
  },
  story: {
    marginTop: spacing.md,
  },
  marketMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  offerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  offerButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaItem: {
    flex: 1,
    minWidth: 0,
  },
  metaValue: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  staffBadge: {
    width: 58,
    minHeight: 70,
    borderRadius: radius.md,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  staffBadgeText: {
    color: colors.accent.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  staffSide: {
    width: 70,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  staffRep: {
    ...typography.heading,
    color: colors.accent.primary,
  },
  hireButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
  },
});
