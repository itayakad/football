import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList, TabParamList } from './types';
import { colors, spacing } from '../theme';

import { HomeScreen } from '../screens/HomeScreen';
import { MatchPreviewScreen } from '../screens/MatchPreviewScreen';
import { MatchSimScreen } from '../screens/MatchSimScreen';
import { PostgameScreen } from '../screens/PostgameScreen';
import { TeamScreen } from '../screens/TeamScreen';
import { LeagueScreen } from '../screens/LeagueScreen';
import { SeasonAwardsScreen } from '../screens/SeasonAwardsScreen';
import { SeasonTransitionScreen } from '../screens/SeasonTransitionScreen';
import { PlayoffBracketScreen } from '../screens/PlayoffBracketScreen';
import { ChooseSchemeScreen } from '../screens/ChooseSchemeScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<TabParamList>();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IoniconName; focused: boolean }) {
  return (
    <View style={styles.tabIcon}>
      <Ionicons
        name={name}
        size={26}
        color={focused ? colors.text.primary : colors.text.muted}
      />
    </View>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor:   colors.bg.elevated,
          borderTopWidth:    0,
          height:            72,
          paddingBottom:     spacing.md,
          paddingTop:        spacing.sm,
        },
        tabBarShowLabel:   false,
        tabBarActiveTintColor:   colors.text.primary,
        tabBarInactiveTintColor: colors.text.muted,
      }}
    >
      <Tab.Screen
        name="Team"
        component={TeamScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'people' : 'people-outline'} focused={focused} /> }}
      />
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} /> }}
      />
      <Tab.Screen
        name="League"
        component={LeagueScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'trophy' : 'trophy-outline'} focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle:        { backgroundColor: colors.bg.base },
        headerTintColor:    colors.text.primary,
        headerTitleStyle:   { fontSize: 18, fontWeight: '600', color: colors.text.primary },
        headerShadowVisible: false,
        contentStyle:       { backgroundColor: colors.bg.base },
      }}
    >
      <Stack.Screen
        name="Tabs"
        component={Tabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MatchPreview"
        component={MatchPreviewScreen}
        options={{ title: 'Match Preview' }}
      />
      <Stack.Screen
        name="ChooseScheme"
        component={ChooseSchemeScreen}
        options={{ title: 'Choose Scheme' }}
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

const styles = StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
