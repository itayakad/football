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
import { CoachAward, LeagueAwards, LeagueAwardsPayload, PlayerAward } from '../api/types';

export const SeasonAwardsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route      = useRoute<RouteProp<RootStackParamList, 'SeasonAwards'>>();
  const offseason  = route.params.offseason;
  const userTeamId = route.params.userTeamId;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={typography.label}>Season {offseason.season}</Text>
        <Text style={typography.display}>Awards</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {[...offseason.awards].sort((a, b) => a.tier - b.tier).map((payload) => (
          <LeagueAwardSection key={payload.leagueId} payload={payload} />
        ))}
      </ScrollView>

      <Button
        label="See season transition"
        onPress={() => navigation.replace('SeasonTransition', { offseason, userTeamId })}
        style={styles.next}
      />
    </ScreenContainer>
  );
};

function LeagueAwardSection({ payload }: { payload: LeagueAwardsPayload }) {
  const a = payload.awards;
  return (
    <View style={styles.section}>
      <SectionLabel>{payload.leagueName}</SectionLabel>
      <AwardCard label="MVP"   subtitle="Most Valuable Player"           player={a.mvp}  />
      <AwardCard label="OPOY"  subtitle="Offensive Player of the Year"   player={a.opoy} />
      <AwardCard label="DPOY"  subtitle="Defensive Player of the Year"   player={a.dpoy} />
      <AwardCard label="ROTY"  subtitle="Rookie of the Year"             player={a.roty} />
      <CoachAwardCard label="HCOTY" subtitle="Head Coach of the Year"   coach={a.hcoty} />
    </View>
  );
}

function AwardCard({ label, subtitle, player }: { label: string; subtitle: string; player: PlayerAward | null }) {
  return (
    <Card style={styles.awardCard}>
      <View style={styles.awardRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>
        <View style={styles.awardMain}>
          <Text style={typography.caption}>{subtitle}</Text>
          {player ? (
            <>
              <Text style={styles.awardName} numberOfLines={1}>{player.playerName}</Text>
              <Text style={typography.caption} numberOfLines={1}>
                {player.position} / {player.teamName} / OVR {player.overall} / age {player.age}
              </Text>
            </>
          ) : (
            <Text style={[typography.body, styles.muted]}>—</Text>
          )}
        </View>
      </View>
    </Card>
  );
}

function CoachAwardCard({ label, subtitle, coach }: { label: string; subtitle: string; coach: CoachAward | null }) {
  return (
    <Card style={styles.awardCard}>
      <View style={styles.awardRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>
        <View style={styles.awardMain}>
          <Text style={typography.caption}>{subtitle}</Text>
          {coach ? (
            <>
              <Text style={styles.awardName} numberOfLines={1}>{coach.coachName}</Text>
              <Text style={typography.caption} numberOfLines={1}>
                {coach.teamName} / {coach.wins}-{coach.losses}
              </Text>
            </>
          ) : (
            <Text style={[typography.body, styles.muted]}>—</Text>
          )}
        </View>
      </View>
    </Card>
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
  awardCard: {
    marginBottom: spacing.sm,
  },
  awardRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
  },
  badge: {
    width:           58,
    minHeight:       58,
    borderRadius:    radius.md,
    backgroundColor: colors.bg.surface,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     colors.border,
  },
  badgeText: {
    color:      colors.accent.primary,
    fontSize:   13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  awardMain: {
    flex:     1,
    minWidth: 0,
    gap:      spacing.xs,
  },
  awardName: {
    ...typography.body,
    fontWeight: '800',
  },
  muted: {
    color: colors.text.muted,
  },
  next: {
    marginTop: spacing.md,
  },
});
