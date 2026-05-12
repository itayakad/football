import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  CommonActions, RouteProp, useNavigation, useRoute,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';

import { ScreenContainer } from '../components/ScreenContainer';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { SectionLabel } from '../components/SectionLabel';
import { colors, radius, spacing, typography } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { LeaguePlayoffBracket, OffseasonResponse, PlayoffMatchOutcome } from '../api/types';
import { lastSim } from '../state/lastSim';

export const PlayoffBracketScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route      = useRoute<RouteProp<RootStackParamList, 'PlayoffBracket'>>();
  const offseason  = route.params.offseason;
  const userTeamId = route.params.userTeamId;
  const queryClient = useQueryClient();

  const userBracket = offseason.playoffs.find((b) =>
    b.seeds.some((s) => s.teamId === userTeamId)
  );

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={typography.label}>Season {offseason.season}</Text>
        <Text style={typography.display}>Playoffs</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {[...offseason.playoffs]
          .sort((a, b) => leagueTier(offseason, a) - leagueTier(offseason, b))
          .map((bracket) => (
            <BracketCard key={bracket.leagueId} bracket={bracket} userTeamId={userTeamId} />
          ))}

        {userBracket?.championTeamId === userTeamId && (
          <Card style={styles.championCard}>
            <Text style={typography.label}>You won it all</Text>
            <Text style={[typography.display, { color: colors.accent.primary }]}>Champions</Text>
          </Card>
        )}
      </ScrollView>

      <Button
        label="Done"
        onPress={() => {
          lastSim.clear();
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['standings'] });
          queryClient.invalidateQueries({ queryKey: ['history'] });
          queryClient.invalidateQueries({ queryKey: ['roster'] });
          queryClient.invalidateQueries({ queryKey: ['market'] });
          queryClient.invalidateQueries({ queryKey: ['coachMarket'] });
          navigation.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: 'Tabs' }] })
          );
        }}
        style={styles.next}
      />
    </ScreenContainer>
  );
};

function leagueTier(offseason: OffseasonResponse, bracket: LeaguePlayoffBracket): number {
  const award = offseason.awards.find((a) => a.leagueId === bracket.leagueId);
  return award?.tier ?? 99;
}

function BracketCard({ bracket, userTeamId }: { bracket: LeaguePlayoffBracket; userTeamId: string }) {
  return (
    <View style={styles.section}>
      <SectionLabel>{bracket.leagueName}</SectionLabel>
      <Card>
        <Text style={[typography.caption, { marginBottom: spacing.sm }]}>Wild Card</Text>
        {bracket.wildCard.map((m) => (
          <PlayoffMatchRow key={m.matchId} match={m} userTeamId={userTeamId} />
        ))}

        <Text style={[typography.caption, styles.roundLabel]}>Semifinals</Text>
        {bracket.semi.map((m) => (
          <PlayoffMatchRow key={m.matchId} match={m} userTeamId={userTeamId} />
        ))}

        <Text style={[typography.caption, styles.roundLabel]}>Final</Text>
        {bracket.final && <PlayoffMatchRow match={bracket.final} userTeamId={userTeamId} />}

        {bracket.championTeamName && (
          <View style={styles.championRow}>
            <Text style={typography.label}>Champion</Text>
            <Text style={[typography.heading, {
              color: bracket.championTeamId === userTeamId ? colors.accent.primary : colors.text.primary,
            }]} numberOfLines={1}>
              {bracket.championTeamName}
            </Text>
          </View>
        )}
      </Card>
    </View>
  );
}

function PlayoffMatchRow({ match, userTeamId }: { match: PlayoffMatchOutcome; userTeamId: string }) {
  const homeWon = match.homeScore > match.awayScore;
  const userIsHome = match.homeTeamId === userTeamId;
  const userIsAway = match.awayTeamId === userTeamId;
  return (
    <View style={styles.matchRow}>
      <View style={styles.matchSide}>
        <Text style={[
          typography.body,
          { color: homeWon ? colors.text.primary : colors.text.muted },
          userIsHome && { color: colors.accent.primary, fontWeight: '800' },
        ]} numberOfLines={1}>
          ({match.homeSeed}) {match.homeTeamName}
        </Text>
        <Text style={[
          typography.heading,
          { color: homeWon ? colors.text.primary : colors.text.muted },
        ]}>
          {match.homeScore}
        </Text>
      </View>
      <View style={styles.matchSide}>
        <Text style={[
          typography.body,
          { color: !homeWon ? colors.text.primary : colors.text.muted },
          userIsAway && { color: colors.accent.primary, fontWeight: '800' },
        ]} numberOfLines={1}>
          ({match.awaySeed}) {match.awayTeamName}
        </Text>
        <Text style={[
          typography.heading,
          { color: !homeWon ? colors.text.primary : colors.text.muted },
        ]}>
          {match.awayScore}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  section: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  roundLabel: {
    marginTop:  spacing.md,
    marginBottom: spacing.sm,
  },
  matchRow: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  matchSide: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            spacing.md,
  },
  championRow: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: spacing.xs,
  },
  championCard: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent.primary,
    borderRadius: radius.lg,
  },
  next: {
    marginTop: spacing.md,
  },
});
