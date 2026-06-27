import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useAppStore } from '../store/useAppStore';
import { Colors, Spacing, FontSize } from '../constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { setIsLoggedIn, setDriveAccessToken } = useAppStore();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();
      
      if (tokens.accessToken) {
        setDriveAccessToken(tokens.accessToken);
        setIsLoggedIn(true);
        router.replace('/(tabs)');
      } else {
        throw new Error('No access token returned from Google');
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled the login flow
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // operation (e.g. sign in) is in progress already
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Google Play Services not available or outdated');
      } else {
        Alert.alert('Login Error', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bill Kato</Text>
      <Text style={styles.subtitle}>Sign in to manage your invoices</Text>

      <TouchableOpacity
        style={styles.googleBtn}
        onPress={handleGoogleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#374151" />
        ) : (
          <Text style={styles.googleBtnText}>Sign in with Google</Text>
        )}
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
