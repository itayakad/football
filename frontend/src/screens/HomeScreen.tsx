import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import { ScreenContainer } from '../components/ScreenContainer';
import { Card } from '../components/Card';
import { SectionLabel } from '../components/SectionLabel';
import { FormDots } from '../components/FormDots';
import { api } from '../api/client';
import { useUserTeamId } from '../state/userTeam';
import { colors, spacing, typography, radius } from '../theme';
import { RootStackParamList } from '../navigation/types';

export const HomeScreen: React.FC = () => {
  const userTeamId = useUserTeamId();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', userTeamId],
    queryFn: () => api.dashboard(userTeamId!),
    enabled: !!userTeamId,
  });

  // Auto-refetch on focus so next-match updates after a sim
  React.useEffect(() => {
    const unsub = navigation.addListener('focus', () => refetch());
    return unsub;
  }, [navigation, refetch]);

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
        <Text style={typography.body}>Failed to load dashboard. Is the backend running?</Text>
      </ScreenContainer>
    );
  }

  const { team, nextMatch, recentResult, standingsPosition, recentForm, news } = data;

  return (
    <ScreenContainer>
      {/* ── Team Header ──────────────────────────────────── */}
      <View>
        <View style={styles.headerRow}>
          <Text style={typography.label}>{team.leagueName}</Text>
          {recentForm.lastResults.length > 0 && (
            <FormDots results={recentForm.lastResults} streak={recentForm.streak} />
          )}
        </View>
        <Text style={[typography.display, { marginTop: spacing.xs }]}>{team.name}</Text>
      </View>

      {/* ── Primary Action: Next Match ───────────────────── */}
      {nextMatch ? (
        <Pressable
          onPress={() => navigation.navigate('MatchPreview', { matchId: nextMatch.id })}
          style={({ pressed }) => [styles.matchButton, pressed && styles.actionButtonPressed]}
        >
          <View style={styles.matchButtonTopRow}>
            <Text style={styles.matchButtonLabel}>
              {`Week ${nextMatch.week} · ${nextMatch.isHome ? 'Home' : 'Away'}`}
            </Text>
            <Text style={styles.actionArrowLight}>→</Text>
          </View>
          <Text style={styles.matchButtonOpponent}>
            {nextMatch.isHome ? 'vs' : '@'} {nextMatch.opponent.name}
          </Text>
        </Pressable>
      ) : (
        <Card>
          <Text style={typography.body}>Season complete. No upcoming matches.</Text>
        </Card>
      )}

      {/* ── Nav Buttons ─────────────────────────────────── */}
      <View style={styles.actionRow}>
        <NavButton label="Team"   onPress={() => navigation.navigate('Team')} />
        <NavButton label="League" onPress={() => navigation.navigate('League')} />
      </View>

      {/* ── Two-up: Standings + Last Result ──────────────── */}
      <View style={styles.twoUp}>
        <Pressable
          style={({ pressed }) => [styles.halfCardPressable, pressed && styles.cardPressed]}
          onPress={() => navigation.navigate('League')}
        >
          <Card style={styles.halfCard}>
            <SectionLabel>Standings</SectionLabel>
            <Text style={typography.title}>
              {standingsPosition.rank != null ? String(standingsPosition.rank) : '—'}
              <Text style={typography.caption}>{` / ${standingsPosition.total}`}</Text>
            </Text>
            <Text style={typography.caption}>
              {standingsPosition.wins}-{standingsPosition.losses}
              {standingsPosition.ties > 0 ? `-${standingsPosition.ties}` : ''}
            </Text>
          </Card>
        </Pressable>

        <Card style={styles.halfCard}>
          <SectionLabel>Last Week</SectionLabel>
          {recentResult ? (
            <>
              <Text style={[typography.title, {
                color: recentResult.result === 'W' ? colors.success
                     : recentResult.result === 'L' ? colors.danger
                     : colors.text.secondary
              }]}>
                {recentResult.result} {recentResult.myScore}–{recentResult.theirScore}
              </Text>
              <Text style={typography.caption} numberOfLines={1}>
                vs {recentResult.opponentName}
              </Text>
            </>
          ) : (
            <Text style={typography.caption}>No matches played yet.</Text>
          )}
        </Card>
      </View>

      {/* ── League News ─────────────────────────────────── */}
      {news && news.length > 0 && (
        <View>
          <SectionLabel>Around the League</SectionLabel>
          {news.map((item, idx) => (
            <Card key={idx} style={styles.newsCard}>
              <View style={styles.newsRow}>
                <View style={[styles.newsCategoryDot, { backgroundColor: newsCategoryColor(item.category) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { fontWeight: '600' }]} numberOfLines={2}>
                    {item.headline}
                  </Text>
                  <Text style={[typography.caption, { marginTop: spacing.xs }]} numberOfLines={2}>
                    {item.summary}
                  </Text>
                  {item.leagueName && (
                    <Text style={[typography.label, { marginTop: spacing.xs, fontSize: 10 }]}>
                      {item.sourceName}
                    </Text>
                  )}
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
};

function NavButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        styles.actionButtonActive,
        pressed && styles.actionButtonPressed,
      ]}
    >
      <View style={styles.actionTopRow}>
        <Text style={[styles.actionLabel, styles.actionLabelActive]}>
          {label}
        </Text>
        <Text style={styles.actionArrow}>→</Text>
      </View>
    </Pressable>
  );
}

function newsCategoryColor(category: string): string {
  switch (category) {
    case 'BLOWOUT':  return colors.identity.run;
    case 'UPSET':    return colors.warn;
    case 'THRILLER': return colors.identity.pass;
    case 'STREAK':   return colors.success;
    case 'COACH':    return colors.danger;
    case 'PLAYER':   return colors.accent.primary;
    case 'STANDINGS':return colors.text.secondary;
    default:         return colors.text.muted;
  }
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems:    'center',
  },
  newsCard: {
    marginBottom: spacing.sm,
  },
  newsRow: {
    flexDirection: 'row',
    gap:           spacing.md,
    alignItems:    'flex-start',
  },
  newsCategoryDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    marginTop:    7,
  },
  twoUp: {
    flexDirection: 'row',
    gap:           spacing.md,
  },
  halfCard: {
    flex: 1,
  },
  halfCardPressable: {
    flex: 1,
  },
  cardPressed: {
    opacity: 0.85,
  },
  actionRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  actionButton: {
    flex:            1,
    minHeight:       64,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap:             spacing.xs,
    justifyContent:  'center',
  },
  actionButtonActive: {
    backgroundColor: colors.accent.primary,
    borderWidth:     0,
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionTopRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  actionLabel: {
    fontSize:      18,
    fontWeight:    '800',
    letterSpacing: 0.4,
  },
  actionLabelActive: {
    color: colors.text.primary,
  },
  actionArrow: {
    fontSize:   18,
    fontWeight: '800',
    color:      colors.text.primary,
  },
  actionArrowLight: {
    fontSize:   22,
    fontWeight: '800',
    color:      colors.text.primary,
  },
  matchButton: {
    backgroundColor:   colors.accent.primary,
    borderRadius:      radius.lg,
    padding:           spacing.lg,
    gap:               spacing.sm,
  },
  matchButtonTopRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  matchButtonLabel: {
    ...typography.label,
    color: 'rgba(255,255,255,0.78)',
  },
  matchButtonOpponent: {
    ...typography.title,
    color: colors.text.primary,
  },
});
