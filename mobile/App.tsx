import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { palette } from './src/ui';
import { clearTokens, getTokens, loadUser, type StoredUser } from './src/api';
import { initDb } from './src/db';
import AuthScreen from './src/screens/AuthScreen';
import OrchardsScreen from './src/screens/OrchardsScreen';
import OrchardScreen from './src/screens/OrchardScreen';
import TreeScreen from './src/screens/TreeScreen';
import SprayScreen from './src/screens/SprayScreen';
import SurveyScreen from './src/screens/SurveyScreen';
import AdviceScreen from './src/screens/AdviceScreen';
import SettingsScreen from './src/screens/SettingsScreen';

interface AuthCtx {
  user: StoredUser | null;
  signedIn: boolean;
  signIn: (u: StoredUser) => void;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(AuthContext);

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: palette.green700 },
        headerTintColor: '#fff',
        tabBarActiveTintColor: palette.green700,
        tabBarInactiveTintColor: palette.textDim,
        tabBarStyle: { height: 58, paddingBottom: 6 },
        tabBarIcon: ({ color, size, focused }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Orchards: 'leaf-outline',
            Spray: 'water-outline',
            Survey: 'clipboard-outline',
            Advice: 'book-outline',
            Settings: 'settings-outline',
          };
          const name = icons[route.name] ?? 'ellipse-outline';
          return <Ionicons name={focused ? (name.replace('-outline', '') as any) : name} size={size - 2} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Orchards" component={OrchardsScreen} options={{ title: 'My Orchards' }} />
      <Tabs.Screen name="Spray" component={SprayScreen} options={{ title: 'Spray Calendar' }} />
      <Tabs.Screen name="Survey" component={SurveyScreen} options={{ title: 'Field Survey' }} />
      <Tabs.Screen name="Advice" component={AdviceScreen} options={{ title: 'Advice' }} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    (async () => {
      await initDb();
      const { access } = await getTokens();
      if (access) setUser(await loadUser());
      setBooting(false);
    })();
  }, []);

  const auth = useMemo<AuthCtx>(
    () => ({
      user,
      signedIn: user != null,
      signIn: (u) => setUser(u),
      signOut: async () => {
        await clearTokens();
        setUser(null);
      },
    }),
    [user],
  );

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.bg }}>
        <ActivityIndicator size="large" color={palette.green700} />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      <StatusBar style="light" />
      <NavigationContainer>
        {auth.signedIn ? (
          <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: palette.green700 }, headerTintColor: '#fff' }}>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Orchard" component={OrchardScreen} options={({ route }) => ({ title: (route.params as any)?.name ?? 'Orchard' })} />
            <Stack.Screen name="Tree" component={TreeScreen} options={({ route }) => ({ title: (route.params as any)?.code ?? 'Tree' })} />
          </Stack.Navigator>
        ) : (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Auth" component={AuthScreen} />
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </AuthContext.Provider>
  );
}

export { SecureStore };
