import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import { api } from '../api/client';
import { RosterResponse } from '../api/types';
import { OpponentPanel } from '../components/pixel/OpponentPanel';
import { PixelButton } from '../components/pixel/PixelButton';
import { PixelImageFrame } from '../components/pixel/PixelImageFrame';
import { TeamBus } from '../components/pixel/TeamBus';
import { pixelAssets } from '../components/pixel/assets';
import { useUserTeamId } from '../state/userTeam';
import { RootStackParamList } from '../navigation/types';
import { pixelTypography } from '../theme';

export const HomeScreen: React.FC = () => {
  const userTeamId = useUserTeamId();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const contentWidth = Math.max(0, screenWidth - 24);
  const logoSize = fitImage(contentWidth * 0.78, 1798 / 579, 500, 161);
  const panelSize = fitImage(contentWidth * 0.86, 1432 / 455, 548, 174);
  const busSize = fitImage(contentWidth * 0.86, 1247 / 442, 548, 194);
  const menuWidth = Math.min(contentWidth * 0.87, 568);

  const { data: dashboard, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', userTeamId],
    queryFn: () => api.dashboard(userTeamId!),
    enabled: !!userTeamId,
  });
  const { data: roster } = useQuery({
    queryKey: ['roster', userTeamId],
    queryFn: () => api.roster(userTeamId!),
    enabled: !!userTeamId,
  });

  React.useEffect(() => navigation.addListener('focus', () => refetch()), [navigation, refetch]);

  const occupantCount = occupantCountFor(roster);

  return (
    <View style={styles.root}>
      <Image
        source={pixelAssets.background}
        resizeMode="cover"
        style={[
          styles.backgroundImage,
          {
            transform: [
              { scale: 1.35 },
              { translateY: -screenHeight * 0.12 },
            ],
          },
        ]}
      />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => navigation.navigate('Settings')}
            style={({ pressed }) => [styles.settings, pressed && styles.pressed]}
          >
            <Image source={pixelAssets.settings} resizeMode="contain" style={styles.settingsImage} />
          </Pressable>

          <PixelImageFrame
            source={pixelAssets.gameLogo}
            aspectRatio={1798 / 579}
            style={[styles.gameLogo, logoSize]}
          />

          {dashboard ? (
            <>
              <TeamLeagueRow teamName={dashboard.team.name} leagueName={dashboard.team.leagueName} />

              <View style={[styles.panelWrap, panelSize]}>
                {dashboard.nextMatch ? (
                <OpponentPanel
                  week={dashboard.nextMatch.week}
                  totalWeeks={dashboard.nextMatch.totalWeeks}
                  opponentName={dashboard.nextMatch.opponent.name}
                  identity={dashboard.nextMatch.opponent.identity}
                  onPress={() => navigation.navigate('MatchPreview', { matchId: dashboard.nextMatch!.id })}
                />
                ) : (
                  <View style={styles.emptyPanel}>
                    <Text style={pixelTypography.body}>SEASON COMPLETE</Text>
                  </View>
                )}
              </View>
            </>
          ) : isLoading || !userTeamId ? (
            <ActivityIndicator color="#DCEBFF" style={styles.loader} />
          ) : (
            <View style={styles.emptyPanel}>
              <Text style={pixelTypography.caption}>
                {error ? 'FAILED TO LOAD DASHBOARD' : 'NO DASHBOARD DATA'}
              </Text>
            </View>
          )}

          <View style={[styles.busWrap, busSize]}>
            <TeamBus occupants={occupantCount} />
          </View>

          <View style={[styles.menuGrid, { width: menuWidth }]}>
            <View style={styles.menuRow}>
              <PixelButton
                label="League"
                tint="#116BBD"
                icon={pixelAssets.trophy}
                onPress={() => navigation.navigate('League')}
              />
              <PixelButton
                label="Stadium"
                tint="#4B9A1C"
                icon={pixelAssets.stadium}
                onPress={() => navigation.navigate('Stadium')}
              />
            </View>
            <View style={styles.menuRow}>
              <PixelButton
                label="Friends"
                tint="#62439B"
                icon={pixelAssets.friends}
                onPress={() => navigation.navigate('Friends')}
              />
              <PixelButton
                label="Team"
                tint="#D47A08"
                icon={pixelAssets.team}
                onPress={() => navigation.navigate('Team')}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

function TeamLeagueRow({ teamName, leagueName }: { teamName: string; leagueName: string }) {
  return (
    <View style={styles.teamLeagueRow}>
      <Image source={pixelAssets.helmet} resizeMode="contain" style={styles.teamMark} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.teamName}>{teamName}</Text>
      <View style={styles.divider} />
      <Image source={pixelAssets.league} resizeMode="contain" style={styles.leagueMark} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.leagueName}>{leagueName}</Text>
    </View>
  );
}

function occupantCountFor(roster?: RosterResponse) {
  if (!roster) return 6;
  const playerCount = roster.groups.reduce((count, group) => count + group.players.length, 0);
  const coachCount = roster.team.coaches.length;
  return Math.max(1, Math.min(6, playerCount + coachCount));
}

function fitImage(preferredWidth: number, aspectRatio: number, maxWidth: number, maxHeight: number) {
  const width = Math.min(preferredWidth, maxWidth, maxHeight * aspectRatio);
  return { width, height: width / aspectRatio };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2E8617' },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  safe: { flex: 1, backgroundColor: 'transparent' },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  settings: {
    width: 34,
    height: 34,
    alignSelf: 'flex-end',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsImage: { width: 27, height: 27 },
  pressed: { opacity: 0.72 },
  gameLogo: { alignSelf: 'center' },
  teamLeagueRow: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  teamMark: { width: 42, height: 35 },
  leagueMark: { width: 38, height: 35 },
  teamName: { ...pixelTypography.caption, color: '#B6C7E3', fontSize: 8, maxWidth: '30%' },
  leagueName: { ...pixelTypography.caption, color: '#B6C7E3', fontSize: 8, maxWidth: '34%' },
  divider: { width: 2, height: 28, backgroundColor: 'rgba(129, 190, 247, .36)', marginHorizontal: 5 },
  panelWrap: { alignSelf: 'center' },
  busWrap: { alignSelf: 'center' },
  emptyPanel: {
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0B1F38',
    backgroundColor: 'rgba(5, 34, 70, .82)',
  },
  loader: { minHeight: 112 },
  menuGrid: { alignSelf: 'center', gap: 10 },
  menuRow: { flexDirection: 'row', gap: 12 },
});
