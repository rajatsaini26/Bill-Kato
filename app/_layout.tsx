import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAppStore } from '../store/useAppStore';
import '../db/client';

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
