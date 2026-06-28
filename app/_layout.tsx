import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAppStore } from '../store/useAppStore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import '../db/client';

GoogleSignin.configure({
  scopes: ['https://www.googleapis.com/auth/drive.file'],
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
});

export default function RootLayout() {
  const { isLoggedIn } = useAppStore();
  const segments = useSegments();
  const router = useRouter();

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
            .then(({ accessToken }) => {
              if (accessToken) {
                const { backupToDrive } = require('../services/driveBackup');
                return backupToDrive(accessToken);
              }
            })
            .then(() => console.log('Auto-backup successful'))
            .catch(e => console.log('Auto-backup skipped/failed:', e));
        }
      } catch (e) {
        console.log('Error checking backup', e);
      }
    }
  }, [isLoggedIn]);

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
            headerStyle: { backgroundColor: '#1A56DB' },
            headerTintColor: '#fff',
          }}
        />
        <Stack.Screen
          name="invoice/sale/[id]"
          options={{
            headerShown: true,
            title: 'Sale Invoice',
            headerStyle: { backgroundColor: '#1A56DB' },
            headerTintColor: '#fff',
          }}
        />
        <Stack.Screen
          name="invoice/purchase/create"
          options={{
            headerShown: true,
            title: 'New Purchase Invoice',
            headerStyle: { backgroundColor: '#0E9F6E' },
            headerTintColor: '#fff',
          }}
        />
        <Stack.Screen
          name="invoice/purchase/[id]"
          options={{
            headerShown: true,
            title: 'Purchase Invoice',
            headerStyle: { backgroundColor: '#0E9F6E' },
            headerTintColor: '#fff',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: true,
            title: 'Settings',
            headerStyle: { backgroundColor: '#1A56DB' },
            headerTintColor: '#fff',
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
