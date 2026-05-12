import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  CommonActions, RouteProp, useNavigation, useRoute,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';

import { ScreenContainer } from '../components/ScreenContainer';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Pill, pillColor, pillLabel } from '../components/Pill';
import { SectionLabel } from '../components/SectionLabel';
import { colors, spacing, typography } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { lastSim } from '../state/lastSim';

export const PostgameScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route      = useRoute<RouteProp<RootStackParamList, 'Postgame'>>();
  const result     = route.params.result;
  const queryClient = useQueryClient();
  const seasonAdvance = result.seasonAdvance;
  const userIsHome = (() => {
    // We don't have userTeamId on the result, but the gameplans tell us:
    // whichever side has a non-AI gameplan is the user. For now, derive from
    // route param alongside the home/away team ids.
    return false; // populated below
  })();

  // Determine W/L from the user's perspective
  const userTeamId  = route.params.userTeamId;
  const _userIsHome = userTeamId === undefined ? false : false;
  // We need to check via the matchId. Since the dashboard refresh handles it,
  // here we simply show the result. To label W/L, infer from team names is fragile —
  // the simplest solid approach: assume userIsHome based on which team won the morale boost.
  // (moraleChange.home > 0 means home won, etc.)
  const userScore = (() => {
    // We don't actually have userTeamId-vs-side mapping client-side without another
    // round-trip. The Postgame UI shows both scores symmetrically; outcome label
    // is derived from result.moraleChange + checking which side gained.
    return result.homeScore > result.awayScore ? 'home' : result.awayScore > result.homeScore ? 'away' : 'tie';
  })();

  // Final outcome (just the score; W/L color hint shown subtly)
  const isTie    = result.homeScore === result.awayScore;
  const homeWon  = result.homeScore > result.awayScore;

  return (
    <ScreenContainer>
      {/* ── Final Score Display ─────────────────────────── */}
      <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
        <Text style={[typography.label, { color: colors.accent.primary }]}>FINAL</Text>
        <View style={styles.scoreRow}>
          <View style={[styles.teamColumn, { alignItems: 'flex-end' }]}>
            <Text style={[typography.heading, { color: homeWon ? colors.text.primary : colors.text.secondary }]}>
              {result.homeTeamName}
            </Text>
            <Text style={[
              typography.score,
              homeWon && { color: colors.accent.primary },
            ]}>{result.homeScore}</Text>
          </View>
          <Text style={[typography.title, { color: colors.text.muted, paddingHorizontal: spacing.md }]}>—</Text>
          <View style={styles.teamColumn}>
            <Text style={[typography.heading, { color: !homeWon && !isTie ? colors.text.primary : colors.text.secondary }]}>
              {result.awayTeamName}
            </Text>
            <Text style={[
              typography.score,
              !homeWon && !isTie && { color: colors.accent.primary },
            ]}>{result.awayScore}</Text>
          </View>
        </View>
      </View>

      {/* ── Tactical Summary ────────────────────────────── */}
      <Card>
        <SectionLabel>Tactical Summary</SectionLabel>
        <View style={{ marginVertical: spacing.sm }}>
          <Pill label={result.keyMatchup} color={colors.accent.primary} />
        </View>
        <Text style={typography.body}>{result.narrative}</Text>
      </Card>

      {/* ── Quarter Scores ──────────────────────────────── */}
      <Card>
        <SectionLabel>By Quarter</SectionLabel>
        <View style={styles.quarterTable}>
          <View style={styles.quarterRow}>
            <Text style={[typography.label, { width: 80 }]}>Team</Text>
            <Text style={styles.qHeader}>Q1</Text>
            <Text style={styles.qHeader}>Q2</Text>
            <Text style={styles.qHeader}>Q3</Text>
            <Text style={styles.qHeader}>Q4</Text>
            <Text style={[styles.qHeader, { fontWeight: '700' }]}>T</Text>
          </View>
          <View style={styles.quarterRow}>
            <Text style={[typography.body, { width: 80 }]} numberOfLines={1}>{result.homeTeamName}</Text>
            {result.quarterScores.map((q, i) => (
              <Text key={i} style={styles.qVal}>{q[0]}</Text>
            ))}
            <Text style={[styles.qVal, { fontWeight: '700', color: colors.text.primary }]}>{result.homeScore}</Text>
          </View>
          <View style={styles.quarterRow}>
            <Text style={[typography.body, { width: 80 }]} numberOfLines={1}>{result.awayTeamName}</Text>
            {result.quarterScores.map((q, i) => (
              <Text key={i} style={styles.qVal}>{q[1]}</Text>
            ))}
            <Text style={[styles.qVal, { fontWeight: '700', color: colors.text.primary }]}>{result.awayScore}</Text>
          </View>
        </View>
      </Card>

      {/* ── Gameplans Used ─────────────────────────────── */}
      <Card>
        <SectionLabel>Gameplans</SectionLabel>
        <View style={styles.gameplanRow}>
          <Text style={[typography.caption, { width: 80 }]}>{result.homeTeamName}</Text>
          <View style={styles.pillRow}>
            {result.homeGameplan.offensiveConcepts.map((concept) => (
              <Pill key={concept} label={pillLabel(concept)} color={pillColor(concept)} />
            ))}
            {result.homeGameplan.defensiveCounters.map((counter) => (
              <Pill key={counter} label={pillLabel(counter)} color={pillColor(counter)} />
            ))}
          </View>
        </View>
        <View style={styles.gameplanRow}>
          <Text style={[typography.caption, { width: 80 }]}>{result.awayTeamName}</Text>
          <View style={styles.pillRow}>
            {result.awayGameplan.offensiveConcepts.map((concept) => (
              <Pill key={concept} label={pillLabel(concept)} color={pillColor(concept)} />
            ))}
            {result.awayGameplan.defensiveCounters.map((counter) => (
              <Pill key={counter} label={pillLabel(counter)} color={pillColor(counter)} />
            ))}
          </View>
        </View>
      </Card>

      {/* ── Morale Impact ────────────────────────────────── */}
      <Card>
        <SectionLabel>Morale Impact</SectionLabel>
        <View style={styles.moraleRow}>
          <Text style={typography.body}>{result.homeTeamName}</Text>
          <Text style={[
            typography.heading,
            { color: result.moraleChange.home >= 0 ? colors.success : colors.danger },
          ]}>
            {result.moraleChange.home >= 0 ? '+' : ''}{result.moraleChange.home}
          </Text>
        </View>
        <View style={styles.moraleRow}>
          <Text style={typography.body}>{result.awayTeamName}</Text>
          <Text style={[
            typography.heading,
            { color: result.moraleChange.away >= 0 ? colors.success : colors.danger },
          ]}>
            {result.moraleChange.away >= 0 ? '+' : ''}{result.moraleChange.away}
          </Text>
        </View>
      </Card>

      <Button
        label={seasonAdvance ? 'Season recap' : 'Done'}
        onPress={() => {
          if (seasonAdvance) {
            navigation.replace('SeasonAwards', {
              offseason: seasonAdvance,
              userTeamId: route.params.userTeamId,
            });
            return;
          }
          lastSim.clear();
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['standings'] });
          queryClient.invalidateQueries({ queryKey: ['roster'] });
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Tabs' }],
            })
          );
        }}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scoreRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     spacing.md,
  },
  teamColumn: { flex: 1 },
  quarterTable: { marginTop: spacing.sm },
  quarterRow: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingVertical: spacing.sm,
  },
  qHeader: {
    ...typography.label,
    flex: 1,
    textAlign: 'center',
  },
  qVal: {
    ...typography.body,
    flex: 1,
    textAlign: 'center',
    color: colors.text.secondary,
  },
  gameplanRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
    marginVertical: spacing.sm,
  },
  pillRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
    flex:          1,
    flexWrap:      'wrap',
  },
  moraleRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingVertical: spacing.sm,
  },
});
