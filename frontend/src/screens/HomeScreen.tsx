import React from 'react';
import { ActivityIndicator, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { ScreenContainer } from '../components/ScreenContainer';
import { Card } from '../components/Card';
import { SectionLabel } from '../components/SectionLabel';
import { api } from '../api/client';
import { useUserTeamId } from '../state/userTeam';
import { colors, spacing, typography, radius } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { NewsItem, TeamIdentity } from '../api/types';
import { teamArchetypeLabel } from '../utils/teamArchetype';

const NEWS_CARD_HEIGHT = 174;
const NEWS_REPEAT_COUNT = 7;
const NEWS_REPEAT_MIDDLE = Math.floor(NEWS_REPEAT_COUNT / 2);
const EMPTY_NEWS: NewsItem[] = [];

type IconName = keyof typeof Ionicons.glyphMap;

export const HomeScreen: React.FC = () => {
  const userTeamId = useUserTeamId();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const newsWheelRef = React.useRef<ScrollView>(null);
  const [activeNewsIndex, setActiveNewsIndex] = React.useState(0);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', userTeamId],
    queryFn: () => api.dashboard(userTeamId!),
    enabled: !!userTeamId,
  });
  const dashboardNews = data?.news ?? EMPTY_NEWS;
  const repeatedNews = React.useMemo(
    () => (dashboardNews.length > 0 ? Array.from({ length: NEWS_REPEAT_COUNT }, () => dashboardNews).flat() : []),
    [dashboardNews],
  );

  // Auto-refetch on focus so next-match updates after a sim
  React.useEffect(() => {
    const unsub = navigation.addListener('focus', () => refetch());
    return unsub;
  }, [navigation, refetch]);

  React.useEffect(() => {
    setActiveNewsIndex(0);
    if (dashboardNews.length < 2) return;

    requestAnimationFrame(() => {
      newsWheelRef.current?.scrollTo({
        y: NEWS_REPEAT_MIDDLE * dashboardNews.length * NEWS_CARD_HEIGHT,
        animated: false,
      });
    });
  }, [dashboardNews]);

  const handleNewsMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (dashboardNews.length === 0) return;

    const rawIndex = Math.round(event.nativeEvent.contentOffset.y / NEWS_CARD_HEIGHT);
    const nextIndex = ((rawIndex % dashboardNews.length) + dashboardNews.length) % dashboardNews.length;
    setActiveNewsIndex(nextIndex);

    if (dashboardNews.length < 2) return;

    const lowerResetPoint = dashboardNews.length;
    const upperResetPoint = dashboardNews.length * (NEWS_REPEAT_COUNT - 1);
    if (rawIndex <= lowerResetPoint || rawIndex >= upperResetPoint) {
      newsWheelRef.current?.scrollTo({
        y: (NEWS_REPEAT_MIDDLE * dashboardNews.length + nextIndex) * NEWS_CARD_HEIGHT,
        animated: false,
      });
    }
  };

  if (!userTeamId || isLoading) {
    return (
      <ScreenContainer scroll={false} contentStyle={styles.fixedContent}>
        <ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing.xxxl }} />
      </ScreenContainer>
    );
  }

  if (error || !data) {
    return (
      <ScreenContainer scroll={false} contentStyle={styles.fixedContent}>
        <Text style={typography.body}>Failed to load dashboard. Is the backend running?</Text>
      </ScreenContainer>
    );
  }

  const { team, nextMatch, news } = data;

  return (
    <ScreenContainer scroll={false} contentStyle={styles.fixedContent}>
      {/* ── Team Banner ──────────────────────────────────── */}
      <View style={styles.bannerRow}>
        <View style={styles.teamBanner}>
          <Text style={styles.bannerTeamName} numberOfLines={1}>{team.name}</Text>
          <Text style={styles.bannerLeague} numberOfLines={1}>{team.leagueName}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => navigation.navigate('Settings')}
          style={({ pressed }) => [styles.settingsButton, pressed && styles.actionButtonPressed]}
        >
          <Ionicons name="settings-outline" size={22} color={colors.text.primary} />
        </Pressable>
      </View>

      {/* ── Primary Action: Next Match ───────────────────── */}
      {nextMatch ? (
        <Pressable
          onPress={() => navigation.navigate('MatchPreview', { matchId: nextMatch.id })}
          style={({ pressed }) => [styles.matchButton, pressed && styles.actionButtonPressed]}
        >
          <View style={styles.matchButtonTopRow}>
            <View style={styles.matchButtonMeta}>
              <Text style={styles.matchButtonLabel}>
                {`Week ${nextMatch.week} / ${nextMatch.totalWeeks}`}
              </Text>
            </View>
            <Text style={styles.actionArrowLight}>→</Text>
          </View>
          <View style={styles.matchButtonBody}>
            <View style={styles.opponentMark}>
              <Text style={styles.opponentInitial}>{nextMatch.opponent.name.slice(0, 1)}</Text>
            </View>
            <View style={styles.matchButtonCopy}>
              <Text style={styles.matchButtonVersus}>{nextMatch.isHome ? 'vs' : '@'} Opponent</Text>
              <Text style={styles.matchButtonOpponent} numberOfLines={1}>
                {nextMatch.opponent.name}
              </Text>
              <OpponentIdentity identity={nextMatch.opponent.identity} />
            </View>
          </View>
        </Pressable>
      ) : (
        <Card>
          <Text style={typography.body}>Season complete. No upcoming matches.</Text>
        </Card>
      )}

      {/* ── Nav Buttons ─────────────────────────────────── */}
      <View style={styles.actionGrid}>
        <NavButton label="Team" icon="shirt-outline" onPress={() => navigation.navigate('Team')} />
        <NavButton label="League" icon="trophy-outline" onPress={() => navigation.navigate('League')} />
        <NavButton label="Stadium" icon="business-outline" onPress={() => navigation.navigate('Stadium')} />
        <NavButton label="Friends" icon="people-outline" onPress={() => navigation.navigate('Friends')} />
      </View>

      {/* ── League News ─────────────────────────────────── */}
      {news && news.length > 0 && (
        <View style={styles.newsSection}>
          <View style={styles.newsHeaderRow}>
            <SectionLabel>Around the League</SectionLabel>
            <Text style={styles.newsCounter}>{activeNewsIndex + 1}/{news.length}</Text>
          </View>
          <View style={styles.newsWheel}>
            <ScrollView
              ref={newsWheelRef}
              pagingEnabled
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              snapToInterval={NEWS_CARD_HEIGHT}
              decelerationRate="fast"
              onMomentumScrollEnd={handleNewsMomentumEnd}
            >
              {(news.length > 1 ? repeatedNews : news).map((item, idx) => (
                <View key={`${item.headline}-${idx}`} style={styles.newsPage}>
                  <NewsStory item={item} />
                </View>
              ))}
            </ScrollView>
          </View>
          {news.length > 1 && (
            <View style={styles.newsDots}>
              {news.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.newsDot,
                    idx === activeNewsIndex && styles.newsDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </ScreenContainer>
  );
};

function NewsStory({ item }: { item: NewsItem }) {
  return (
    <Card style={styles.newsCard}>
      <View style={styles.newsRow}>
        <View style={[styles.newsCategoryDot, { backgroundColor: newsCategoryColor(item.category) }]} />
        <View style={styles.newsCopy}>
          <Text style={styles.newsHeadline} numberOfLines={2}>
            {item.headline}
          </Text>
          <Text style={styles.newsSummary} numberOfLines={3}>
            {item.summary}
          </Text>
          {(item.sourceName || item.leagueName) && (
            <Text style={styles.newsSource} numberOfLines={1}>
              {item.sourceName ?? item.leagueName}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
}

function OpponentIdentity({ identity }: { identity: TeamIdentity }) {
  return (
    <View style={styles.opponentIdentityRow}>
      <Text style={styles.opponentArchetype} numberOfLines={1}>
        {teamArchetypeLabel(identity)}
      </Text>
      <View style={styles.opponentIdentityIcons}>
        <IdentityIcon
          icon={offenseIdentityIcon(identity.offense)}
          color={offenseIdentityColor(identity.offense)}
        />
        <IdentityIcon
          icon={defenseIdentityIcon(identity.defense)}
          color={defenseIdentityColor(identity.defense)}
        />
      </View>
    </View>
  );
}

function IdentityIcon({ icon, color }: { icon: IconName; color: string }) {
  return (
    <View style={styles.identityIcon}>
      <Ionicons name={icon} size={13} color={color} />
    </View>
  );
}

function NavButton({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
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
        <View style={styles.actionIconWrap}>
          <Ionicons name={icon} size={20} color={colors.text.primary} />
        </View>
        <Text style={styles.actionArrow}>→</Text>
      </View>
      <Text style={[styles.actionLabel, styles.actionLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function offenseIdentityIcon(identity: TeamIdentity['offense']): IconName {
  switch (identity) {
    case 'VERTICAL':   return 'trending-up';
    case 'RUN_HEAVY':  return 'footsteps';
    case 'PASS_HEAVY': return 'paper-plane';
    case 'BALANCED':   return 'git-branch';
  }
}

function defenseIdentityIcon(identity: TeamIdentity['defense']): IconName {
  switch (identity) {
    case 'PRESSURE':   return 'flash';
    case 'MAN_HEAVY':  return 'person';
    case 'ZONE_HEAVY': return 'grid';
    case 'BALANCED':   return 'shield-checkmark';
  }
}

function offenseIdentityColor(identity: TeamIdentity['offense']): string {
  switch (identity) {
    case 'VERTICAL':
    case 'PASS_HEAVY':
      return colors.identity.pass;
    case 'RUN_HEAVY':
      return colors.identity.run;
    case 'BALANCED':
      return colors.identity.bal;
  }
}

function defenseIdentityColor(identity: TeamIdentity['defense']): string {
  switch (identity) {
    case 'PRESSURE':
      return colors.identity.agg;
    case 'MAN_HEAVY':
      return colors.identity.man;
    case 'ZONE_HEAVY':
      return colors.identity.zone;
    case 'BALANCED':
      return colors.identity.bal;
  }
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
  fixedContent: {
    paddingTop: spacing.lg,
    gap:        spacing.lg,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
  },
  teamBanner: {
    flex:              1,
    minHeight:         94,
    borderRadius:      radius.lg,
    backgroundColor:   colors.bg.elevated,
    borderWidth:       1,
    borderColor:       colors.border,
    paddingVertical:   spacing.lg,
    paddingHorizontal: spacing.lg,
    justifyContent:    'center',
  },
  bannerTeamName: {
    ...typography.title,
    color: colors.text.primary,
  },
  bannerLeague: {
    ...typography.label,
    color:     colors.text.secondary,
    marginTop: spacing.xs,
  },
  settingsButton: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: colors.bg.elevated,
    borderWidth:     1,
    borderColor:     colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  newsSection: {
    flex: 1,
    minHeight: 0,
  },
  newsHeaderRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   spacing.sm,
  },
  newsCounter: {
    ...typography.label,
    color: colors.text.secondary,
  },
  newsWheel: {
    height:        NEWS_CARD_HEIGHT,
    borderRadius: radius.lg,
    overflow:     'hidden',
  },
  newsPage: {
    height: NEWS_CARD_HEIGHT,
  },
  newsCard: {
    height:         NEWS_CARD_HEIGHT,
    justifyContent: 'center',
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
  newsCopy: {
    flex: 1,
  },
  newsHeadline: {
    ...typography.body,
    color:      colors.text.primary,
    fontWeight: '700',
  },
  newsSummary: {
    ...typography.caption,
    color:     colors.text.secondary,
    marginTop: spacing.xs,
  },
  newsSource: {
    ...typography.label,
    color:     colors.text.muted,
    fontSize:  10,
    marginTop: spacing.xs,
  },
  newsDots: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            spacing.xs,
    marginTop:      spacing.sm,
  },
  newsDot: {
    width:           5,
    height:          5,
    borderRadius:    3,
    backgroundColor: colors.text.muted,
  },
  newsDotActive: {
    width:           16,
    backgroundColor: colors.accent.primary,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.sm,
  },
  actionButton: {
    width:             '48.6%',
    minHeight:         72,
    borderRadius:      radius.md,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.md,
    gap:               spacing.xs,
    justifyContent:    'space-between',
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
  actionIconWrap: {
    width:           30,
    height:          30,
    borderRadius:    15,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  actionLabel: {
    fontSize:      16,
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
    minHeight:         156,
    gap:               spacing.md,
    justifyContent:    'space-between',
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
  matchButtonMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  matchButtonBody: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
  },
  opponentMark: {
    width:           60,
    height:          60,
    borderRadius:    18,
    backgroundColor: 'rgba(11,12,14,0.28)',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.18)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  opponentInitial: {
    fontSize:   28,
    fontWeight: '900',
    color:      colors.text.primary,
  },
  matchButtonCopy: {
    flex: 1,
  },
  matchButtonVersus: {
    ...typography.label,
    color:        'rgba(255,255,255,0.72)',
    marginBottom: spacing.xs,
  },
  matchButtonOpponent: {
    ...typography.title,
    color: colors.text.primary,
  },
  opponentIdentityRow: {
    flexDirection:   'row',
    alignItems:      'center',
    alignSelf:       'flex-start',
    maxWidth:        '100%',
    gap:             spacing.sm,
    marginTop:       spacing.sm,
    borderRadius:    radius.pill,
    backgroundColor: 'rgba(11,12,14,0.28)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  opponentArchetype: {
    ...typography.label,
    flexShrink: 1,
    color:      colors.text.primary,
    fontSize:   11,
  },
  opponentIdentityIcons: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  identityIcon: {
    width:          22,
    height:         22,
    borderRadius:   11,
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
