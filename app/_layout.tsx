import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAppStore } from '../store/useAppStore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import '../db/client';
import { Colors } from '../constants/theme';

SplashScreen.preventAutoHideAsync();

GoogleSignin.configure({
  scopes: ['https://www.googleapis.com/auth/drive.file'],
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
});

export default function RootLayout() {
  const { isLoggedIn } = useAppStore();
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    const inAuthGroup = segments[0] === '(tabs)' || segments[0] === 'invoice' || segments[0] === 'settings';
    if (!isLoggedIn && inAuthGroup) {
      router.replace('/login');
    } else if (isLoggedIn && segments[0] === 'login') {
      router.replace('/(tabs)');
    }
  }, [isLoggedIn, segments]);

  // Auto-backup in the background once a day
  useEffect(() => {
    if (isLoggedIn) {
      const today = new Date().toISOString().slice(0, 10);
      try {
        const { db } = require('../db/client');
        const lastBackup = db.getFirstSync(
          `SELECT backed_up_at FROM backup_log WHERE status = 'success' ORDER BY backed_up_at DESC LIMIT 1`
        );
        if (!lastBackup || !lastBackup.backed_up_at.startsWith(today)) {
          GoogleSignin.signInSilently()
            .then(() => GoogleSignin.getTokens())
            .then(({ accessToken }: { accessToken: string }) => {
              if (accessToken) {
                const { backupToDrive } = require('../services/driveBackup');
                return backupToDrive(accessToken);
              }
            })
            .then(() => console.log('Auto-backup successful'))
            .catch((e: any) => console.log('Auto-backup skipped/failed:', e));
        }
      } catch (e) {
        console.log('Error checking backup', e);
      }
    }
  }, [isLoggedIn]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="invoice/sale/create"
          options={{
            headerShown: true,
            title: 'New Sale Invoice',
            headerStyle: { backgroundColor: Colors.primary },
            headerTintColor: '#fff',
            headerTitleStyle: { fontFamily: 'Inter_700Bold' },
          }}
        />
        <Stack.Screen
          name="invoice/sale/[id]"
          options={{
            headerShown: true,
            title: 'Sale Invoice',
            headerStyle: { backgroundColor: Colors.primary },
            headerTintColor: '#fff',
            headerTitleStyle: { fontFamily: 'Inter_700Bold' },
          }}
        />
        <Stack.Screen
          name="invoice/purchase/create"
          options={{
            headerShown: true,
            title: 'New Purchase Invoice',
            headerStyle: { backgroundColor: Colors.success },
            headerTintColor: '#fff',
            headerTitleStyle: { fontFamily: 'Inter_700Bold' },
          }}
        />
        <Stack.Screen
          name="invoice/purchase/[id]"
          options={{
            headerShown: true,
            title: 'Purchase Invoice',
            headerStyle: { backgroundColor: Colors.success },
            headerTintColor: '#fff',
            headerTitleStyle: { fontFamily: 'Inter_700Bold' },
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: true,
            title: 'Settings',
            headerStyle: { backgroundColor: Colors.primary },
            headerTintColor: '#fff',
            headerTitleStyle: { fontFamily: 'Inter_700Bold' },
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
