import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  RouteProp, useNavigation, useRoute,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ScreenContainer } from '../components/ScreenContainer';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { SectionLabel } from '../components/SectionLabel';
import { colors, radius, spacing, typography } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { LeaguePlayoffBracket, OffseasonResponse, PlayoffSeed } from '../api/types';

export const SeasonTransitionScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route      = useRoute<RouteProp<RootStackParamList, 'SeasonTransition'>>();
  const offseason  = route.params.offseason;
  const userTeamId = route.params.userTeamId;

  const promoted = offseason.movements.filter((m) => m.type === 'PROMOTED');
  const relegated = offseason.movements.filter((m) => m.type === 'RELEGATED');

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={typography.label}>Season {offseason.season}</Text>
        <Text style={typography.display}>Transition</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <SectionLabel>Promotion / Relegation</SectionLabel>
          <Card padded={false}>
            {promoted.length === 0 && relegated.length === 0 && (
              <View style={styles.emptyRow}>
                <Text style={typography.caption}>No movement this season.</Text>
              </View>
            )}
            {promoted.map((m, i) => (
              <View key={`up-${m.teamId}`} style={[styles.movementRow, (i < promoted.length - 1 || relegated.length > 0) && styles.rowDivider]}>
                <View style={[styles.dirBadge, { backgroundColor: colors.success }]}>
                  <Text style={styles.dirBadgeText}>UP</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.body}>{m.teamName}</Text>
                  <Text style={typography.caption}>Tier {m.fromTier} → Tier {m.toTier}</Text>
                </View>
              </View>
            ))}
            {relegated.map((m, i) => (
              <View key={`dn-${m.teamId}`} style={[styles.movementRow, i < relegated.length - 1 && styles.rowDivider]}>
                <View style={[styles.dirBadge, { backgroundColor: colors.danger }]}>
                  <Text style={styles.dirBadgeText}>DN</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.body}>{m.teamName}</Text>
                  <Text style={typography.caption}>Tier {m.fromTier} → Tier {m.toTier}</Text>
                </View>
              </View>
            ))}
          </Card>
        </View>

        <View style={styles.section}>
          <SectionLabel>Playoff Picture</SectionLabel>
          {[...offseason.playoffs]
            .sort((a, b) => leagueTier(offseason, a) - leagueTier(offseason, b))
            .map((bracket) => (
              <PlayoffSeedCard key={bracket.leagueId} bracket={bracket} userTeamId={userTeamId} />
            ))}
        </View>
      </ScrollView>

      <Button
        label="Run playoffs"
        onPress={() => navigation.replace('PlayoffBracket', { offseason, userTeamId })}
        style={styles.next}
      />
    </ScreenContainer>
  );
};

function leagueTier(offseason: OffseasonResponse, bracket: LeaguePlayoffBracket): number {
  const award = offseason.awards.find((a) => a.leagueId === bracket.leagueId);
  return award?.tier ?? 99;
}

function PlayoffSeedCard({ bracket, userTeamId }: { bracket: LeaguePlayoffBracket; userTeamId: string }) {
  return (
    <Card style={styles.bracketCard}>
      <Text style={[typography.label, { marginBottom: spacing.sm }]}>{bracket.leagueName}</Text>
      {bracket.seeds.map((seed, i) => (
        <SeedRow key={seed.teamId} seed={seed} isLast={i === bracket.seeds.length - 1} isUser={seed.teamId === userTeamId} />
      ))}
    </Card>
  );
}

function SeedRow({ seed, isLast, isUser }: { seed: PlayoffSeed; isLast: boolean; isUser: boolean }) {
  const hasBye = seed.rank <= 2;
  return (
    <View style={[styles.seedRow, !isLast && styles.rowDivider]}>
      <View style={[styles.seedRank, hasBye && styles.seedRankBye]}>
        <Text style={[styles.seedRankText, hasBye && { color: colors.accent.primary }]}>{seed.rank}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.body, isUser && { color: colors.accent.primary, fontWeight: '800' }]} numberOfLines={1}>
          {seed.teamName}
        </Text>
        <Text style={typography.caption}>{seed.record}{hasBye ? ' / first-round bye' : ''}</Text>
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
  },
  emptyRow: {
    padding: spacing.md,
  },
  movementRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
    padding:       spacing.md,
    minHeight:     58,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  dirBadge: {
    width: 38,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dirBadgeText: {
    color: colors.bg.base,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  bracketCard: {
    marginBottom: spacing.sm,
  },
  seedRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
    paddingVertical: spacing.sm,
  },
  seedRank: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seedRankBye: {
    borderWidth: 1,
    borderColor: colors.accent.primary,
  },
  seedRankText: {
    ...typography.label,
    color: colors.text.secondary,
  },
  next: {
    marginTop: spacing.md,
  },
});
