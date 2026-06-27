import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, FontSize } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';
import { backupToDrive } from '../services/driveBackup';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { db } from '../db/client';

interface ShopProfile {
  name: string;
  address: string;
  phone: string;
  gstin: string;
  currency: string;
  bank_name: string;
  account_number: string;
  ifsc: string;
  upi_id: string;
  logo_uri: string;
}

interface BackupLog {
  id: number;
  backed_up_at: string;
  drive_file_id: string;
  status: string;
}

export default function SettingsScreen() {
  const { setShopName, setDriveAccessToken, driveAccessToken, setIsLoggedIn } = useAppStore();
  const [profile, setProfile] = useState<ShopProfile>({
    name: 'My Shop', address: '', phone: '', gstin: '', currency: 'INR',
    bank_name: '', account_number: '', ifsc: '', upi_id: '', logo_uri: ''
  });
  const [backupLogs, setBackupLogs] = useState<BackupLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    loadProfile();
    loadBackupLogs();
  }, []);

  const connectGoogleDrive = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();
      
      if (tokens.accessToken) {
        setDriveAccessToken(tokens.accessToken);
        Alert.alert('Success', 'Google Drive connected!');
      }
    } catch (error: any) {
      if (error.code !== statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Connection Failed', error.message);
      }
    }
  };

  const loadProfile = () => {
    try {
      const row = db.getFirstSync<ShopProfile>(`SELECT name, address, phone, gstin, currency, bank_name, account_number, ifsc, upi_id, logo_uri FROM shop_profile WHERE id = 1`);
      if (row) {
        setProfile(row);
        setShopName(row.name);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const loadBackupLogs = () => {
    try {
      const logs = db.getAllSync<BackupLog>(`SELECT * FROM backup_log ORDER BY backed_up_at DESC LIMIT 10`);
      setBackupLogs(logs);
    } catch (e: any) {
      console.log('No backup logs table or error:', e.message);
    }
  };

  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setProfile({ ...profile, logo_uri: result.assets[0].uri });
    }
  };

  const saveProfile = async () => {
    if (!profile.name.trim()) { Alert.alert('Error', 'Shop name is required'); return; }
    setSaving(true);
    try {
      db.runSync(
        `UPDATE shop_profile SET name = ?, address = ?, phone = ?, gstin = ?, currency = ?, bank_name = ?, account_number = ?, ifsc = ?, upi_id = ?, logo_uri = ? WHERE id = 1`,
        [profile.name, profile.address, profile.phone, profile.gstin, profile.currency, profile.bank_name, profile.account_number, profile.ifsc, profile.upi_id, profile.logo_uri]
      );
      setShopName(profile.name);
      Alert.alert('Saved', 'Shop profile updated');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    if (!driveAccessToken) { Alert.alert('Error', 'Connect Google Drive first'); return; }
    setBackingUp(true);
    try {
      const { fileId } = await backupToDrive(driveAccessToken);
      Alert.alert('Backup Successful', `File ID: ${fileId}`);
      loadBackupLogs();
    } catch (e: any) {
      Alert.alert('Backup Failed', e.message);
      loadBackupLogs();
    } finally {
      setBackingUp(false);
    }
  };

  const lastSuccess = backupLogs.find((l) => l.status === 'success');

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Shop Profile */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏪 Shop Profile</Text>

        <Text style={styles.label}>Shop Logo</Text>
        <TouchableOpacity style={styles.logoPicker} onPress={pickLogo}>
          {profile.logo_uri ? (
            <Image source={{ uri: profile.logo_uri }} style={styles.logoImage} />
          ) : (
            <Text style={styles.logoPlaceholderText}>Select Logo</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Shop Name *</Text>
        <TextInput style={styles.input} value={profile.name} onChangeText={(v) => setProfile({ ...profile, name: v })} placeholder="My Shop" />
        <Text style={styles.label}>Address</Text>
        <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]} value={profile.address} onChangeText={(v) => setProfile({ ...profile, address: v })} placeholder="Shop Address" multiline />
        <Text style={styles.label}>Phone</Text>
        <TextInput style={styles.input} value={profile.phone} onChangeText={(v) => setProfile({ ...profile, phone: v })} placeholder="Phone Number" keyboardType="phone-pad" />
        <Text style={styles.label}>GSTIN</Text>
        <TextInput style={styles.input} value={profile.gstin} onChangeText={(v) => setProfile({ ...profile, gstin: v })} placeholder="GST Number" autoCapitalize="characters" />
        
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>🏦 Bank & UPI Details</Text>
        <Text style={styles.label}>Bank Name</Text>
        <TextInput style={styles.input} value={profile.bank_name} onChangeText={(v) => setProfile({ ...profile, bank_name: v })} placeholder="e.g. HDFC Bank" />
        <Text style={styles.label}>Account Number</Text>
        <TextInput style={styles.input} value={profile.account_number} onChangeText={(v) => setProfile({ ...profile, account_number: v })} placeholder="Account No." keyboardType="numeric" />
        <Text style={styles.label}>IFSC Code</Text>
        <TextInput style={styles.input} value={profile.ifsc} onChangeText={(v) => setProfile({ ...profile, ifsc: v })} placeholder="IFSC Code" autoCapitalize="characters" />
        <Text style={styles.label}>UPI ID (for QR Scanner)</Text>
        <TextInput style={styles.input} value={profile.upi_id} onChangeText={(v) => setProfile({ ...profile, upi_id: v })} placeholder="example@upi" />

        <View style={styles.divider} />
        <Text style={styles.label}>Currency</Text>
        <View style={styles.currencyRow}>
          {['INR', 'USD', 'EUR', 'GBP'].map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setProfile({ ...profile, currency: c })}
              style={[styles.currencyBtn, profile.currency === c && styles.currencyBtnActive]}
            >
              <Text style={[styles.currencyText, profile.currency === c && { color: '#fff' }]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Profile</Text>}
        </TouchableOpacity>
      </View>

      {/* Google Drive Backup */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>☁️ Google Drive Backup</Text>
        {lastSuccess ? (
          <Text style={styles.lastBackup}>Last backup: {lastSuccess.backed_up_at}</Text>
        ) : (
          <Text style={styles.lastBackup}>No backup yet</Text>
        )}
        <TouchableOpacity
          style={[styles.driveBtn, driveAccessToken && styles.driveBtnConnected]}
          onPress={connectGoogleDrive}
        >
          <Text style={styles.driveBtnText}>
            {driveAccessToken ? '✓ Google Drive Connected' : '🔗 Connect Google Drive'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.backupBtn, !driveAccessToken && { opacity: 0.4 }]}
          onPress={handleBackup}
          disabled={!driveAccessToken || backingUp}
        >
          {backingUp ? <ActivityIndicator color="#fff" /> : <Text style={styles.backupBtnText}>☁ Backup Now</Text>}
        </TouchableOpacity>

        {backupLogs.length > 0 && (
          <>
            <Text style={[styles.label, { marginTop: Spacing.md }]}>Backup History</Text>
            {backupLogs.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <View style={[styles.logDot, { backgroundColor: log.status === 'success' ? Colors.success : Colors.danger }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.logDate}>{log.backed_up_at}</Text>
                  <Text style={[styles.logStatus, { color: log.status === 'success' ? Colors.success : Colors.danger }]}>
                    {log.status}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
      </View>

      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => setIsLoggedIn(false)}
      >
        <Text style={styles.logoutBtnText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  section: { backgroundColor: Colors.surface, margin: Spacing.md, borderRadius: 12, padding: Spacing.md, elevation: 1 },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  label: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 10,
    fontSize: FontSize.sm, color: Colors.textPrimary, backgroundColor: Colors.background, marginBottom: Spacing.sm,
  },
  logoPicker: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#e5e7eb',
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md, overflow: 'hidden'
  },
  logoImage: { width: '100%', height: '100%' },
  logoPlaceholderText: { fontSize: 10, color: '#6b7280', textAlign: 'center' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  currencyRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  currencyBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border },
  currencyBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  currencyText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 10, padding: Spacing.md, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
  lastBackup: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.sm },
  driveBtn: { backgroundColor: Colors.border, borderRadius: 10, padding: Spacing.md, alignItems: 'center', marginBottom: Spacing.sm },
  driveBtnConnected: { backgroundColor: Colors.success },
  driveBtnText: { color: Colors.textPrimary, fontWeight: '700', fontSize: FontSize.sm },
  backupBtn: { backgroundColor: Colors.primary, borderRadius: 10, padding: Spacing.md, alignItems: 'center' },
  backupBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  logDot: { width: 8, height: 8, borderRadius: 4 },
  logDate: { fontSize: FontSize.xs, color: Colors.textSecondary },
  logStatus: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'capitalize' },
  logoutBtn: { margin: Spacing.md, padding: Spacing.md, alignItems: 'center' },
  logoutBtnText: { color: Colors.danger, fontWeight: '700', fontSize: FontSize.md },
});
