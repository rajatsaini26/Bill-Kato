import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
// Initialize DB on app start
import '../db/client';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
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
