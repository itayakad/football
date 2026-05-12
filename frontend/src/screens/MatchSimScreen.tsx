import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button } from '../components/Button';
import { lastSim } from '../state/lastSim';
import { colors, spacing, typography, radius } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { FeedEvent } from '../api/types';

const REVEAL_INTERVAL_MS = 1400;
const HALFTIME_PAUSE_MS  = 2200;

export const MatchSimScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route      = useRoute<RouteProp<RootStackParamList, 'MatchSim'>>();
  const result     = lastSim.get();

  const [visibleEvents, setVisibleEvents] = useState<FeedEvent[]>([]);
  const [currentScore, setCurrentScore] = useState({ home: 0, away: 0 });
  const [currentQuarter, setCurrentQuarter] = useState(1);
  const [done, setDone] = useState(false);

  const scrollRef = useRef<ScrollView | null>(null);

  // Pulse animations on the scoreboard when scores change
  const homePulse = useRef(new Animated.Value(1)).current;
  const awayPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!result) {
      navigation.goBack();
      return;
    }

    let cancelled = false;
    let i = 0;
    let prevHome = 0, prevAway = 0;

    const reveal = () => {
      if (cancelled) return;
      if (i >= result.events.length) {
        setDone(true);
        return;
      }
      const ev = result.events[i];
      setVisibleEvents((prev) => [...prev, ev]);
      setCurrentScore({ home: ev.homeScore, away: ev.awayScore });
      setCurrentQuarter(ev.quarter);

      // Trigger pulse on whichever side scored
      if (ev.homeScore !== prevHome) pulse(homePulse);
      if (ev.awayScore !== prevAway) pulse(awayPulse);
      prevHome = ev.homeScore;
      prevAway = ev.awayScore;

      const isHalftime = ev.type === 'HALFTIME';
      const delay = isHalftime ? HALFTIME_PAUSE_MS : REVEAL_INTERVAL_MS;

      i++;
      setTimeout(reveal, delay);
    };

    const startTimer = setTimeout(reveal, 600);
    return () => { cancelled = true; clearTimeout(startTimer); };
  }, [result, navigation]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [visibleEvents.length]);

  if (!result) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* ── Sticky Scoreboard ────────────────────────────── */}
      <View style={styles.scoreboard}>
        <View style={styles.scoreRow}>
          <View style={styles.teamScore}>
            <Text style={typography.label} numberOfLines={1}>{result.homeTeamName}</Text>
            <Animated.View style={{ transform: [{ scale: homePulse }] }}>
              <Text style={typography.score}>{currentScore.home}</Text>
            </Animated.View>
          </View>
          <View style={styles.center}>
            <Text style={[typography.label, { color: colors.accent.primary, fontWeight: '700' }]}>
              {currentQuarter <= 4 ? `Q${currentQuarter}` : 'FINAL'}
            </Text>
          </View>
          <View style={[styles.teamScore, { alignItems: 'flex-end' }]}>
            <Text style={typography.label} numberOfLines={1}>{result.awayTeamName}</Text>
            <Animated.View style={{ transform: [{ scale: awayPulse }] }}>
              <Text style={typography.score}>{currentScore.away}</Text>
            </Animated.View>
          </View>
        </View>
      </View>

      {/* ── Live Feed ────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
      >
        {visibleEvents.map((ev, idx) => {
          const prev = idx > 0 ? visibleEvents[idx - 1] : null;
          const showQuarterDivider =
            prev != null &&
            ev.quarter > prev.quarter &&
            ev.type !== 'HALFTIME' &&
            ev.type !== 'FINAL';
          return (
            <React.Fragment key={idx}>
              {showQuarterDivider && <QuarterDivider quarter={ev.quarter} />}
              <FeedItem event={ev} />
            </React.Fragment>
          );
        })}
      </ScrollView>

      {done && (
        <View style={styles.cta}>
          <Button
            label="View Recap →"
            onPress={() => navigation.replace('Postgame', { result, userTeamId: route.params.userTeamId })}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

// ─── Helpers ────────────────────────────────────────────

function pulse(value: Animated.Value) {
  Animated.sequence([
    Animated.timing(value, { toValue: 1.15, duration: 140, useNativeDriver: true }),
    Animated.timing(value, { toValue: 1.0,  duration: 280, useNativeDriver: true }),
  ]).start();
}

const QuarterDivider: React.FC<{ quarter: number }> = ({ quarter }) => (
  <View style={styles.quarterDivider}>
    <View style={styles.dividerLine} />
    <Text style={styles.quarterDividerText}>Q{quarter} BEGINS</Text>
    <View style={styles.dividerLine} />
  </View>
);

// ─── FeedItem ─────────────────────────────────────────────
const FeedItem: React.FC<{ event: FeedEvent }> = ({ event }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const isMarker = event.type === 'KICKOFF' || event.type === 'HALFTIME' || event.type === 'FINAL';
  const isScore  = event.type === 'SCORE';
  const isHomePossession = event.possessionTeam === 'home';
  const isAwayPossession = event.possessionTeam === 'away';
  const possessionTone = isHomePossession ? colors.identity.pass : isAwayPossession ? colors.identity.run : colors.text.muted;

  return (
    <Animated.View style={[
      styles.feedItem,
      { opacity },
      isHomePossession && styles.feedItemHome,
      isAwayPossession && styles.feedItemAway,
      isMarker && styles.feedItemMarker,
      isScore  && styles.feedItemScore,
    ]}>
      {isMarker ? (
        <Text style={[typography.heading, { color: colors.accent.primary, textAlign: 'center' }]}>
          {event.text}
        </Text>
      ) : (
        <>
          <View style={[
            styles.dot,
            { backgroundColor: possessionTone },
            isScore  ? styles.dotScore : styles.dotPlay,
          ]} />
          <Text style={[
            typography.body,
            { flex: 1 },
            isScore && styles.scoreText,
          ]}>
            {event.text}
          </Text>
        </>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  scoreboard: {
    backgroundColor:   colors.bg.elevated,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.lg,
  },
  scoreRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  teamScore: { flex: 1 },
  center:    { alignItems: 'center', paddingHorizontal: spacing.md },
  feed: {
    flex: 1,
  },
  feedContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.lg,
    gap:               spacing.md,
  },
  feedItem: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius:    radius.md,
    padding:         spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.text.muted,
  },
  feedItemHome: {
    borderLeftColor: colors.identity.pass,
    backgroundColor: 'rgba(91, 168, 255, 0.08)',
  },
  feedItemAway: {
    borderLeftColor: colors.identity.run,
    backgroundColor: 'rgba(230, 142, 60, 0.08)',
  },
  feedItemMarker: {
    backgroundColor: 'transparent',
    borderLeftWidth: 0,
    paddingVertical: spacing.lg,
  },
  feedItemScore: {
    backgroundColor: 'rgba(61, 111, 217, 0.12)',
    paddingVertical: spacing.lg,
  },
  scoreText: {
    fontSize:   17,
    fontWeight: '700',
    color:      colors.text.primary,
  },
  dot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    marginTop:    7,
  },
  dotPlay:  {},
  dotScore: { backgroundColor: colors.success, width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  quarterDivider: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex:            1,
    height:          1,
    backgroundColor: colors.divider,
  },
  quarterDividerText: {
    ...typography.label,
    color:    colors.text.secondary,
    fontSize: 11,
  },
  cta: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.lg,
    paddingBottom:     spacing.xl,
    backgroundColor:   colors.bg.base,
  },
});
