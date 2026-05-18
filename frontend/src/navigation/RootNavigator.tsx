import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RootStackParamList } from './types';
import { colors } from '../theme';

import { HomeScreen } from '../screens/HomeScreen';
import { MatchPreviewScreen } from '../screens/MatchPreviewScreen';
import { MatchSimScreen } from '../screens/MatchSimScreen';
import { PostgameScreen } from '../screens/PostgameScreen';
import { TeamScreen } from '../screens/TeamScreen';
import { StadiumScreen } from '../screens/StadiumScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { LeagueScreen } from '../screens/LeagueScreen';
import { SeasonAwardsScreen } from '../screens/SeasonAwardsScreen';
import { SeasonTransitionScreen } from '../screens/SeasonTransitionScreen';
import { PlayoffBracketScreen } from '../screens/PlayoffBracketScreen';
import { ChooseSchemeScreen } from '../screens/ChooseSchemeScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle:        { backgroundColor: colors.bg.base },
        headerTintColor:    colors.text.primary,
        headerTitleStyle:   { fontSize: 18, fontWeight: '600', color: colors.text.primary },
        headerShadowVisible: false,
        contentStyle:       { backgroundColor: colors.bg.base },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Team"
        component={TeamScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Stadium"
        component={StadiumScreen}
        options={{ title: 'Stadium' }}
      />
      <Stack.Screen
        name="Friends"
        component={FriendsScreen}
        options={{ title: 'Friends' }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="League"
        component={LeagueScreen}
        options={{ title: 'League' }}
      />
      <Stack.Screen
        name="MatchPreview"
        component={MatchPreviewScreen}
        options={{ title: 'Match Preview' }}
      />
      <Stack.Screen
        name="ChooseScheme"
        component={ChooseSchemeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MatchSim"
        component={MatchSimScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="Postgame"
        component={PostgameScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="SeasonAwards"
        component={SeasonAwardsScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="SeasonTransition"
        component={SeasonTransitionScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="PlayoffBracket"
        component={PlayoffBracketScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}
