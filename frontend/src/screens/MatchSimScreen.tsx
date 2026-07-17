import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery } from '@tanstack/react-query';

import { api } from '../api/client';
import { LiveMatchResponse, LivePlayLog, LiveSpecialAction, PlayTemplate } from '../api/types';
import { Button } from '../components/Button';
import { lastSim } from '../state/lastSim';
import { usePlayCatalog } from '../state/playCatalog';
import { colors, radius, spacing, typography } from '../theme';
import { RootStackParamList } from '../navigation/types';

export const MatchSimScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'MatchSim'>>();
  const { matchId, userTeamId } = route.params;
  const { playById } = usePlayCatalog();
  const query = useQuery({
    queryKey: ['liveMatch', matchId, userTeamId],
    queryFn: () => api.liveMatch(matchId, userTeamId),
  });
  const [live, setLive] = useState<LiveMatchResponse | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showSnapLog, setShowSnapLog] = useState(false);
  const submittedRevision = useRef<number | null>(null);
  const navigatedToPostgame = useRef(false);

  useEffect(() => {
    if (query.data) setLive(query.data);
  }, [query.data]);

  const decision = useMutation({
    mutationFn: (action?: string) => {
      if (!live) throw new Error('Live match is not ready');
      submittedRevision.current = live.revision;
      return api.liveDecision(matchId, userTeamId, live.revision, action);
    },
    onSuccess: (next) => {
      submittedRevision.current = null;
      setLive(next);
    },
    onError: () => {
      submittedRevision.current = null;
      query.refetch();
    },
  });

  const automation = useMutation({
    mutationFn: (enabled: boolean) => api.liveSettings(matchId, userTeamId, enabled),
    onSuccess: setLive,
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  const secondsLeft = live?.deadlineAt
    ? Math.max(0, Math.ceil((new Date(live.deadlineAt).getTime() - now) / 1000))
    : 0;

  const submitDecision = (action?: string) => {
    if (!live || live.status === 'FINAL' || decision.isPending || submittedRevision.current === live.revision) return;
    decision.mutate(action);
  };

  useEffect(() => {
    if (!live || live.status === 'FINAL' || live.automate || decision.isPending) return;
    if (secondsLeft > 0 || submittedRevision.current === live.revision) return;
    submitDecision();
  }, [live?.deadlineAt, live?.revision, live?.automate, live?.status, secondsLeft, decision.isPending]);

  useEffect(() => {
    if (!live || live.status === 'FINAL' || !live.automate || decision.isPending) return;
    if (submittedRevision.current === live.revision) return;
    const timer = setTimeout(() => submitDecision(), 850);
    return () => clearTimeout(timer);
  }, [live?.revision, live?.automate, live?.status, decision.isPending]);

  useEffect(() => {
    if (!live?.finalResult || navigatedToPostgame.current) return;
    navigatedToPostgame.current = true;
    lastSim.set(live.finalResult);
    const timer = setTimeout(() => {
      navigation.replace('Postgame', { result: live.finalResult!, userTeamId });
    }, 900);
    return () => clearTimeout(timer);
  }, [live?.finalResult, navigation, userTeamId]);

  const lastPlay = live?.lastPlay ?? null;
  const userSelectedId = lastPlay
    ? lastPlay.offenseSide === live?.userSide ? lastPlay.offensePlayId : lastPlay.defensePlayId
    : null;
  const opponentSelectedId = lastPlay
    ? lastPlay.offenseSide === live?.userSide ? lastPlay.defensePlayId : lastPlay.offensePlayId
    : null;

  if (query.error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorBox}>
          <Text style={typography.heading}>Live match unavailable</Text>
          <Text style={typography.caption}>{String(query.error)}</Text>
          <Button label="Retry" onPress={() => query.refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  if (query.isLoading || !live) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.accent.primary} style={styles.loader} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.scoreboard}>
        <View style={styles.scoreRow}>
          <TeamScore name={live.homeTeamName} score={live.homeScore} align="left" />
          <View style={styles.clockBlock}>
            <Text style={[typography.label, { color: colors.accent.primary }]}>Q{live.quarter}</Text>
            <Text style={styles.clock}>{live.clock}</Text>
          </View>
          <TeamScore name={live.awayTeamName} score={live.awayScore} align="right" />
        </View>
        <View style={styles.situationRow}>
          <Text style={styles.situation}>{live.possession === live.userSide ? 'YOUR BALL' : 'OPPONENT BALL'}</Text>
          <Text style={styles.situation}>{downLabel(live.down)} & {live.distance}</Text>
          <Text style={styles.situation}>{fieldLabel(live.yardLine)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FieldView live={live} />

        <View style={styles.controlRow}>
          <View style={styles.timerInline}>
            <Text style={[styles.timer, secondsLeft <= 5 && styles.timerHot]}>{live.automate ? 'HC' : `${secondsLeft}s`}</Text>
            <Text style={styles.timerLabel}>{live.automate ? 'AUTO' : 'CLOCK'}</Text>
          </View>
          <View style={styles.automationInline}>
            <Text style={styles.automationTitle}>Automate play call</Text>
            <Switch
              value={live.automate}
              onValueChange={(value) => automation.mutate(value)}
              disabled={automation.isPending || decision.isPending}
              trackColor={{ false: colors.bg.surface, true: colors.accent.primary }}
              thumbColor={colors.text.primary}
            />
          </View>
        </View>

        {lastPlay && (
          <ResolvedCall
            play={lastPlay}
            userSide={live.userSide}
            userPlay={playById(userSelectedId ?? '')}
            opponentPlay={playById(opponentSelectedId ?? '')}
            expanded={showSnapLog}
            onPress={() => setShowSnapLog((value) => !value)}
          />
        )}

        {showSnapLog && live.log.length > 1 && (
          <View style={styles.logList}>
            {live.log.slice(-5, -1).reverse().map((entry) => (
              <LogRow key={entry.sequence} entry={entry} userSide={live.userSide} playById={playById} />
            ))}
          </View>
        )}

        {!live.automate && (
          <View style={styles.playGrid}>
            {live.plays.map((play) => (
              <PlayCard
                key={play.id}
                play={play}
                selected={play.id === userSelectedId}
                disabled={decision.isPending}
                onPress={() => submitDecision(play.id)}
              />
            ))}
            {live.specialActions.map((action) => (
              <SpecialCard
                key={action}
                action={action}
                disabled={decision.isPending}
                onPress={() => submitDecision(action)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const TeamScore: React.FC<{ name: string; score: number; align: 'left' | 'right' }> = ({ name, score, align }) => (
  <View style={[styles.teamScore, align === 'right' && { alignItems: 'flex-end' }]}>
    <Text style={typography.label} numberOfLines={1}>{name}</Text>
    <Text style={typography.score}>{score}</Text>
  </View>
);

const FieldView: React.FC<{ live: LiveMatchResponse }> = ({ live }) => (
  <View style={styles.fieldWrap}>
    <View style={styles.fieldHeader}>
      <Text style={styles.fieldPossession} numberOfLines={1}>
        {live.possession === live.userSide ? 'Your offense' : 'Opponent offense'}
      </Text>
      <Text style={styles.fieldInfo}>{downLabel(live.down)} & {live.distance} · {fieldLabel(live.yardLine)}</Text>
    </View>
    <View style={styles.field}>
      {[20, 40, 60, 80].map((mark) => <View key={mark} style={[styles.fieldLine, { left: `${mark}%` as any }]} />)}
      <View style={[styles.ball, { left: `${Math.max(0, Math.min(100, live.yardLine))}%` as any }]} />
    </View>
    <View style={styles.fieldLabels}>
      <Text style={styles.fieldLabel}>OWN</Text>
      <Text style={styles.fieldLabel}>50</Text>
      <Text style={styles.fieldLabel}>GOAL</Text>
    </View>
  </View>
);

const PlayCard: React.FC<{ play: PlayTemplate; selected: boolean; disabled: boolean; onPress: () => void }> = ({ play, selected, disabled, onPress }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      styles.playCard,
      { borderColor: play.categoryColor },
      selected && styles.selectedPlay,
      pressed && styles.pressedCard,
      disabled && styles.disabledCard,
    ]}
  >
    <View style={styles.playSketch}>
      <View style={[styles.routeLine, { backgroundColor: play.categoryColor, transform: [{ rotate: play.unit === 'offense' ? '-18deg' : '18deg' }] }]} />
      <View style={[styles.routeDot, { backgroundColor: play.categoryColor }]} />
    </View>
    <Text style={styles.playName} numberOfLines={2}>{play.name}</Text>
    <Text style={[styles.playCategory, { color: play.categoryColor }]}>{play.categoryLabel}</Text>
    <Text style={styles.playSlots} numberOfLines={1}>{play.keySlots.join(' · ')}</Text>
    {selected && <Text style={styles.selectedLabel}>YOUR CALL</Text>}
  </Pressable>
);

const SpecialCard: React.FC<{ action: LiveSpecialAction; disabled: boolean; onPress: () => void }> = ({ action, disabled, onPress }) => (
  <Pressable onPress={onPress} disabled={disabled} style={[styles.specialCard, disabled && styles.disabledCard]}>
    <Text style={styles.specialIcon}>{action === 'PUNT' ? '↗' : action === 'FIELD_GOAL' ? '◉' : '→'}</Text>
    <Text style={styles.playName}>{specialLabel(action)}</Text>
    <Text style={styles.playCategory}>FOURTH DOWN</Text>
  </Pressable>
);

const ResolvedCall: React.FC<{ play: LivePlayLog; userSide: 'home' | 'away'; userPlay?: PlayTemplate; opponentPlay?: PlayTemplate; expanded: boolean; onPress: () => void }> = ({ play, userPlay, opponentPlay, expanded, onPress }) => (
  <Pressable onPress={onPress} style={styles.resolvedBox}>
    <View style={styles.resolvedHeader}>
      <Text style={typography.label}>Last snap · {downLabel(play.down)} & {play.distance}</Text>
      <View style={styles.resolvedRight}>
        <Text style={styles.resultYards}>{play.yards > 0 ? `+${play.yards}` : play.yards} yds</Text>
        <Text style={styles.expandIcon}>{expanded ? '⌃' : '⌄'}</Text>
      </View>
    </View>
    <Text style={styles.resultText}>{resultText(play)}</Text>
    <View style={styles.callPair}>
      <CallChip label="YOUR CALL" play={userPlay} selected />
      <CallChip label="OPPONENT" play={opponentPlay} selected />
    </View>
  </Pressable>
);

const CallChip: React.FC<{ label: string; play?: PlayTemplate; selected: boolean }> = ({ label, play }) => (
  <View style={[styles.callChip, play && { borderColor: play.categoryColor }]}>
    <Text style={styles.callChipLabel}>{label}</Text>
    <Text style={styles.callChipName} numberOfLines={1}>{play?.name ?? 'Special teams'}</Text>
    <Text style={styles.callChipCategory}>{play?.categoryLabel ?? 'Automatic action'}</Text>
  </View>
);

const LogRow: React.FC<{ entry: LivePlayLog; userSide: 'home' | 'away'; playById: (id: string) => PlayTemplate | undefined }> = ({ entry, userSide, playById }) => {
  const userPlay = playById(entry.offenseSide === userSide ? entry.offensePlayId : entry.defensePlayId);
  const opponentPlay = playById(entry.offenseSide === userSide ? entry.defensePlayId : entry.offensePlayId);
  return (
    <View style={styles.logRow}>
      <View style={styles.logTop}>
        <Text style={styles.logSituation}>Q{entry.quarter} {entry.clock} · {downLabel(entry.down)} & {entry.distance}</Text>
        <Text style={styles.logScore}>{entry.homeScore}-{entry.awayScore}</Text>
      </View>
      <Text style={styles.logText}>{resultText(entry)}</Text>
      <Text style={styles.logCalls}>{userPlay?.name ?? 'Special teams'} vs {opponentPlay?.name ?? 'Special teams'}</Text>
    </View>
  );
};

function resultText(play: LivePlayLog): string {
  if (play.scoringEvent === 'TD') return 'Touchdown. The offense breaks through.';
  if (play.scoringEvent === 'DEFENSIVE_TD') return 'Pick six. The defense takes it all the way.';
  if (play.scoringEvent === 'FG_GOOD') return 'Field goal is good.';
  if (play.scoringEvent === 'FG_MISS') return 'Field goal is no good.';
  if (play.scoringEvent === 'PUNT') return 'Punt and flip the field.';
  if (play.scoringEvent === 'SAFETY') return 'Safety. The defense gets two.';
  if (play.scoringEvent === 'INT' || play.scoringEvent === 'FUMBLE') return 'Turnover. The defense wins the exchange.';
  if (play.scoringEvent === 'TURNOVER_ON_DOWNS') return 'Turnover on downs.';
  if (play.highlightPlayer) return `${play.highlightPlayer.name} ${play.yards >= 0 ? 'makes the play' : 'gets stopped'} for ${Math.abs(play.yards)} yards.`;
  return `${play.resultLabel.replaceAll('_', ' ').toLowerCase()} for ${Math.abs(play.yards)} yards.`;
}

function specialLabel(action: LiveSpecialAction): string {
  return action === 'FIELD_GOAL' ? 'Field goal' : action === 'GO_FOR_IT' ? 'Go for it' : 'Punt';
}

function downLabel(down: number): string {
  return down === 1 ? '1st' : down === 2 ? '2nd' : down === 3 ? '3rd' : '4th';
}

function fieldLabel(yardLine: number): string {
  if (yardLine === 50) return 'Midfield';
  return yardLine < 50 ? `Own ${yardLine}` : `Opp ${100 - yardLine}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },
  loader: { flex: 1 },
  errorBox: { flex: 1, justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  scoreboard: { backgroundColor: colors.bg.elevated, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teamScore: { flex: 1 },
  clockBlock: { alignItems: 'center', paddingHorizontal: spacing.md },
  clock: { color: colors.text.primary, fontSize: 20, fontWeight: '800', marginTop: 2 },
  situationRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.divider, marginTop: spacing.xs, paddingTop: spacing.sm },
  situation: { ...typography.label, color: colors.text.secondary },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  fieldWrap: { backgroundColor: colors.bg.elevated, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  fieldPossession: { ...typography.body, fontWeight: '700', flex: 1 },
  fieldInfo: { ...typography.caption, textAlign: 'right' },
  field: { height: 48, borderRadius: radius.sm, backgroundColor: '#173B2B', overflow: 'hidden', position: 'relative' },
  fieldLine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  ball: { position: 'absolute', top: 17, width: 14, height: 14, marginLeft: -7, borderRadius: 8, backgroundColor: colors.warn, borderWidth: 2, borderColor: colors.text.primary },
  fieldLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  fieldLabel: { ...typography.label, fontSize: 9 },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bg.elevated, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginBottom: spacing.md },
  timerInline: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  timer: { color: colors.accent.primary, fontSize: 21, fontWeight: '800' },
  timerHot: { color: colors.danger },
  timerLabel: { ...typography.label, fontSize: 9 },
  automationInline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  automationTitle: { ...typography.body, fontWeight: '700' },
  automationDetail: { ...typography.caption, marginTop: 2 },
  playGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.lg },
  playCard: { width: '31.8%', minHeight: 146, backgroundColor: colors.bg.elevated, borderWidth: 1.5, borderRadius: radius.md, padding: spacing.sm },
  selectedPlay: { borderWidth: 2.5, backgroundColor: colors.bg.surface },
  pressedCard: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  disabledCard: { opacity: 0.5 },
  playSketch: { height: 42, backgroundColor: colors.bg.surface, borderRadius: radius.sm, marginBottom: spacing.xs, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  routeLine: { width: 42, height: 2, position: 'absolute' },
  routeDot: { width: 7, height: 7, borderRadius: 5, position: 'absolute', right: 18, top: 10 },
  playName: { color: colors.text.primary, fontSize: 12, fontWeight: '700', lineHeight: 15 },
  playCategory: { ...typography.label, fontSize: 8, marginTop: 4 },
  playSlots: { color: colors.text.muted, fontSize: 9, marginTop: 5 },
  selectedLabel: { color: colors.accent.primary, fontSize: 8, fontWeight: '800', marginTop: 5 },
  specialCard: { width: '31.8%', minHeight: 100, backgroundColor: colors.bg.surface, borderColor: colors.warn, borderWidth: 1, borderRadius: radius.md, padding: spacing.sm },
  specialIcon: { color: colors.warn, fontSize: 24, fontWeight: '700', marginBottom: spacing.xs },
  resolvedBox: { backgroundColor: colors.bg.elevated, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  resolvedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resolvedRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  expandIcon: { color: colors.text.secondary, fontSize: 18, fontWeight: '700' },
  resultYards: { color: colors.success, fontWeight: '800' },
  resultText: { ...typography.body, fontWeight: '700', marginTop: spacing.xs },
  callPair: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  callChip: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm, backgroundColor: colors.bg.surface },
  callChipLabel: { ...typography.label, fontSize: 8 },
  callChipName: { color: colors.text.primary, fontSize: 12, fontWeight: '700', marginTop: 3 },
  callChipCategory: { color: colors.text.secondary, fontSize: 10, marginTop: 2 },
  logList: { marginTop: -spacing.sm, marginBottom: spacing.md },
  logRow: { backgroundColor: colors.bg.elevated, borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.xs },
  logTop: { flexDirection: 'row', justifyContent: 'space-between' },
  logSituation: { ...typography.label, fontSize: 9 },
  logScore: { color: colors.text.primary, fontSize: 11, fontWeight: '800' },
  logText: { color: colors.text.primary, fontSize: 13, fontWeight: '600', marginTop: 4 },
  logCalls: { color: colors.text.secondary, fontSize: 11, marginTop: 3 },
});
