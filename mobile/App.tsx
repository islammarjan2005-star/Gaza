import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import SearchScreen from './src/screens/SearchScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import TransparencyScreen from './src/screens/TransparencyScreen';
import ImpactScreen from './src/screens/ImpactScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { TabBarIcon } from './src/components/TabBarIcon';
import { useSessionStore } from './src/store/sessionStore';
import { Colors } from './src/utils/colors';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function SearchStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: Colors.white,
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen
        name="SearchHome"
        component={SearchScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Results"
        component={ResultsScreen}
        options={({ route }) => ({
          title: (route.params as any)?.query || 'Results',
        })}
      />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.lightGray,
          paddingTop: 5,
          paddingBottom: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: Colors.white,
      }}
    >
      <Tab.Screen
        name="Search"
        component={SearchStack}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="search" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Impact"
        component={ImpactScreen}
        options={{
          title: 'Your Impact',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="heart" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Transparency"
        component={TransparencyScreen}
        options={{
          title: 'Transparency',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="chart" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="settings" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const initSession = useSessionStore((state) => state.initSession);

  useEffect(() => {
    initSession();
  }, [initSession]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <MainTabs />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
