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
import { usePlayCatalog } from '../state/playCatalog';
import { PlayTemplate } from '../api/types';

export const PostgameScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route      = useRoute<RouteProp<RootStackParamList, 'Postgame'>>();
  const result     = route.params.result;
  const queryClient = useQueryClient();
  const seasonAdvance = result.seasonAdvance;
  const { playById } = usePlayCatalog();
  const userIsHome = (() => {
    // We don't have userTeamId on the result, but the gameplans tell us:
    // whichever side has a non-AI gameplan is the user. For now, derive from
    // route param alongside the home/away team ids.
    return false; // populated below
  })();

  const userScore = result.homeScore > result.awayScore ? 'home' : result.awayScore > result.homeScore ? 'away' : 'tie';

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
            {gameplanPills(result.homeGameplan.offensivePlays, result.homeGameplan.defensivePlays, playById)}
          </View>
        </View>
        <View style={styles.gameplanRow}>
          <Text style={[typography.caption, { width: 80 }]}>{result.awayTeamName}</Text>
          <View style={styles.pillRow}>
            {gameplanPills(result.awayGameplan.offensivePlays, result.awayGameplan.defensivePlays, playById)}
          </View>
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
              routes: [{ name: 'Home' }],
            })
          );
        }}
      />
    </ScreenContainer>
  );
};

function gameplanPills(
  offensivePlays: string[],
  defensivePlays: string[],
  playById: (id: string) => PlayTemplate | undefined,
) {
  return [...offensivePlays, ...defensivePlays].map((id) => {
    const play = playById(id);
    return (
      <Pill
        key={id}
        label={play ? play.categoryLabel : pillLabel(id)}
        color={play?.categoryColor ?? pillColor(id)}
      />
    );
  });
}

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
});
