import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useGoogleAuth } from '../services/driveBackup';
import { useAppStore } from '../store/useAppStore';
import { Colors, Spacing, FontSize } from '../constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { request, response, promptAsync } = useGoogleAuth();
  const { setIsLoggedIn } = useAppStore();

  useEffect(() => {
    if (response?.type === 'success') {
      const token = (response as any).params?.access_token ?? null;
      if (token) {
        setIsLoggedIn(true);
        router.replace('/(tabs)');
      }
    }
  }, [response]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bill Kato</Text>
      <Text style={styles.subtitle}>Sign in to manage your invoices</Text>

      <TouchableOpacity
        style={styles.googleBtn}
        onPress={() => promptAsync()}
        disabled={!request}
      >
        <Text style={styles.googleBtnText}>Sign in with Google</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: 48,
    textAlign: 'center',
  },
  googleBtn: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    width: '100%',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  googleBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: '#374151',
  },
});
