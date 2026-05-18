import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../api/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ContractValue, formatMoney } from '../components/ContractValue';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionLabel } from '../components/SectionLabel';
import { useUserTeamId } from '../state/userTeam';
import { colors, radius, spacing, typography } from '../theme';

export const MarketScreen: React.FC = () => {
  const userTeamId = useUserTeamId();
  const queryClient = useQueryClient();

  const coachMarket = useQuery({
    queryKey: ['coachMarket', userTeamId],
    queryFn: () => api.coachMarket(userTeamId!),
    enabled: !!userTeamId,
  });

  const hireCoach = useMutation({
    mutationFn: (coachId: string) => api.hireCoach(userTeamId!, coachId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster', userTeamId] });
      queryClient.invalidateQueries({ queryKey: ['coachMarket', userTeamId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', userTeamId] });
    },
  });

  if (!userTeamId || coachMarket.isLoading) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing.xxxl }} />
      </ScreenContainer>
    );
  }

  if (!coachMarket.data || coachMarket.error) {
    return (
      <ScreenContainer>
        <Text style={typography.body}>Failed to load staff market. Is the backend running?</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View>
        <Text style={typography.label}>Free Agency</Text>
        <Text style={[typography.display, styles.title]}>Staff Market</Text>
      </View>

      <Card>
        <View style={styles.financeRow}>
          <View style={styles.financeMetric}>
            <Text style={typography.label}>Cash</Text>
            <Text style={[typography.heading, { color: colors.success }]}>
              {formatMoney(coachMarket.data.team.money)}
            </Text>
          </View>
        </View>
      </Card>

      {coachMarket.data.candidates.length > 0 ? (
        <View>
          <SectionLabel>Available Staff</SectionLabel>
          {coachMarket.data.candidates.map((coach) => (
            <Card key={coach.id} style={styles.marketCard}>
              <View style={styles.cardHeader}>
                <View style={styles.staffBadge}>
                  <Text style={styles.staffBadgeText}>{coach.position}</Text>
                </View>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName} numberOfLines={1}>{coach.name}</Text>
                  <Text style={typography.caption} numberOfLines={1}>
                    {coach.archetype}
                  </Text>
                  <Text style={[typography.caption, styles.story]} numberOfLines={2}>
                    {coach.story}
                  </Text>
                </View>
                <View style={styles.staffSide}>
                  <Text style={styles.staffRep}>{coach.overall}</Text>
                  <ContractValue amount={coach.salary} years={coach.contractYearsLeft} compact perYear />
                </View>
              </View>
              <Button
                label={`Hire ${coach.position}`}
                onPress={() => hireCoach.mutate(coach.id)}
                loading={hireCoach.isPending}
                disabled={!coach.canHire}
                style={styles.hireButton}
              />
            </Card>
          ))}
        </View>
      ) : (
        <Text style={typography.body}>No staff candidates available right now.</Text>
      )}
    </ScreenContainer>
  );
};

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
  marketCard: {
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  story: {
    marginTop: spacing.md,
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
    width: 80,
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
