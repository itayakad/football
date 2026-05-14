import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
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
  const [currentClock, setCurrentClock] = useState('15:00');
  const [fieldState, setFieldState] = useState<FeedEvent | null>(null);
  const [done, setDone] = useState(false);

  const scrollRef   = useRef<ScrollView | null>(null);
  const isNearBottom = useRef(true);

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
      setCurrentClock(ev.clock);
      if (ev.possessionTeam || ev.yardLine != null) setFieldState(ev);

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
    if (isNearBottom.current) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [visibleEvents.length]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    isNearBottom.current = distanceFromBottom < 80;
  };

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
            <Text style={styles.clockText}>{currentClock}</Text>
          </View>
          <View style={[styles.teamScore, { alignItems: 'flex-end' }]}>
            <Text style={typography.label} numberOfLines={1}>{result.awayTeamName}</Text>
            <Animated.View style={{ transform: [{ scale: awayPulse }] }}>
              <Text style={typography.score}>{currentScore.away}</Text>
            </Animated.View>
          </View>
        </View>
      </View>

      <FieldView
        event={fieldState}
        homeTeamName={result.homeTeamName}
        awayTeamName={result.awayTeamName}
      />

      {/* ── Live Feed ────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={100}
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

  const isMarker   = event.type === 'KICKOFF' || event.type === 'HALFTIME' || event.type === 'FINAL';
  const isScore    = event.type === 'SCORE';
  const isTurnover = event.type === 'TURNOVER';
  const isHomePossession = event.possessionTeam === 'home';
  const isAwayPossession = event.possessionTeam === 'away';
  const possessionTone = isHomePossession ? colors.identity.pass : isAwayPossession ? colors.identity.run : colors.text.muted;

  return (
    <Animated.View style={[
      styles.feedItem,
      { opacity },
      isHomePossession && styles.feedItemHome,
      isAwayPossession && styles.feedItemAway,
      isMarker   && styles.feedItemMarker,
      isScore    && styles.feedItemScore,
      isTurnover && styles.feedItemScore,
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
            (isScore || isTurnover) ? styles.dotScore : styles.dotPlay,
          ]} />
          <View style={{ flex: 1 }}>
            {!isScore && !isTurnover && (
              <Text style={styles.feedMeta}>
                {event.down && event.distance ? `${downLabel(event.down)} & ${event.distance}` : event.type} / {fieldLabel(event.yardLine ?? 25)}
              </Text>
            )}
            <Text style={[styles.feedText, (isScore || isTurnover) && styles.scoreText]}>{event.text}</Text>
            {(isScore || isTurnover) && event.detail && (
              <Text style={styles.feedDetail}>{event.detail}</Text>
            )}
          </View>
        </>
      )}
    </Animated.View>
  );
};

const FieldView: React.FC<{ event: FeedEvent | null; homeTeamName: string; awayTeamName: string }> = ({ event, homeTeamName, awayTeamName }) => {
  const possession = event?.possessionTeam;
  const teamName = possession === 'home' ? homeTeamName : possession === 'away' ? awayTeamName : 'Awaiting kickoff';
  const yardLine = Math.max(0, Math.min(100, event?.yardLine ?? 25));
  const downDistance = event?.down && event?.distance ? `${downLabel(event.down)} & ${event.distance}` : event?.type ?? 'Kickoff';
  return (
    <View style={styles.fieldWrap}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldPossession} numberOfLines={1}>{teamName} ball</Text>
        <Text style={styles.fieldInfo}>{downDistance} / {fieldLabel(yardLine)}</Text>
      </View>
      <View style={styles.field}>
        {[20, 40, 60, 80].map((mark) => (
          <View key={mark} style={[styles.fieldLine, { left: `${mark}%` as any }]} />
        ))}
        <View style={[styles.ball, { left: `${yardLine}%` as any }]} />
      </View>
      <View style={styles.fieldLabels}>
        <Text style={styles.fieldLabel}>OWN</Text>
        <Text style={styles.fieldLabel}>50</Text>
        <Text style={styles.fieldLabel}>GOAL</Text>
      </View>
    </View>
  );
};

function downLabel(down: number): string {
  return down === 1 ? '1st' : down === 2 ? '2nd' : down === 3 ? '3rd' : '4th';
}

function fieldLabel(yardLine: number): string {
  if (yardLine >= 100) return 'Goal line';
  if (yardLine === 50) return 'Midfield';
  return yardLine < 50 ? `Own ${yardLine}` : `Opp ${100 - yardLine}`;
}

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
  clockText: {
    ...typography.heading,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  fieldWrap: {
    backgroundColor: colors.bg.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  fieldPossession: {
    ...typography.heading,
    flex: 1,
    color: colors.text.primary,
  },
  fieldInfo: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '700',
  },
  field: {
    height: 78,
    borderRadius: radius.md,
    backgroundColor: '#1F7A3A',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  fieldLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  ball: {
    position: 'absolute',
    top: '50%',
    width: 14,
    height: 14,
    marginLeft: -7,
    marginTop: -7,
    borderRadius: 7,
    backgroundColor: '#8B4513',
    borderWidth: 2,
    borderColor: colors.text.primary,
  },
  fieldLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '800',
  },
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
    padding:         spacing.sm,
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
  feedDetail: {
    fontSize:   14,
    fontWeight: '400',
    color:      colors.text.primary,
    marginTop:  3,
  },
  feedMeta: {
    ...typography.caption,
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  feedText: {
    ...typography.body,
    fontSize: 14,
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
