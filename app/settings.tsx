import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Radius, Shadow, Spacing } from '../constants/theme';
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

function Section({ title, icon, children }: { title: string; icon: React.ComponentProps<typeof Ionicons>['name']; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconWrap}>
          <Ionicons name={icon} size={18} color={Colors.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function InputField({ label, value, onChange, placeholder, multiline = false, keyboardType = 'default', autoCapitalize = 'none' }: any) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
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
      const logs = db.getAllSync<BackupLog>(`SELECT * FROM backup_log ORDER BY backed_up_at DESC LIMIT 5`);
      setBackupLogs(logs);
    } catch (e: any) {
      console.log('No backup logs table or error:', e.message);
    }
  };

  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
      Alert.alert('Saved', 'Shop profile updated successfully');
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
      Alert.alert('Backup Successful', `Data secured to Google Drive.`);
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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
      
      {/* Premium Profile Card */}
      <View style={styles.profileHero}>
        <TouchableOpacity style={styles.logoPicker} onPress={pickLogo} activeOpacity={0.8}>
          {profile.logo_uri ? (
            <Image source={{ uri: profile.logo_uri }} style={styles.logoImage} />
          ) : (
            <View style={styles.logoFallback}>
              <Ionicons name="camera" size={32} color={Colors.textMuted} />
              <Text style={styles.logoPlaceholderText}>Add Logo</Text>
            </View>
          )}
          <View style={styles.editIconBadge}>
            <Ionicons name="pencil" size={12} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.shopNamePreview}>{profile.name || 'Your Shop Name'}</Text>
        <Text style={styles.shopGstinPreview}>{profile.gstin ? `GSTIN: ${profile.gstin}` : 'Setup your business details below'}</Text>
      </View>

      <View style={{ paddingHorizontal: Spacing.md }}>
        <Section title="Business Details" icon="business-outline">
          <InputField label="Shop Name *" value={profile.name} onChange={(v: string) => setProfile({ ...profile, name: v })} placeholder="My Shop" />
          <InputField label="Address" value={profile.address} onChange={(v: string) => setProfile({ ...profile, address: v })} placeholder="Shop Address" multiline />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <InputField label="Phone" value={profile.phone} onChange={(v: string) => setProfile({ ...profile, phone: v })} placeholder="Phone Number" keyboardType="phone-pad" />
            </View>
            <View style={{ width: Spacing.sm }} />
            <View style={{ flex: 1 }}>
              <InputField label="GSTIN" value={profile.gstin} onChange={(v: string) => setProfile({ ...profile, gstin: v })} placeholder="GST Number" autoCapitalize="characters" />
            </View>
          </View>

          <Text style={styles.label}>Default Currency</Text>
          <View style={styles.currencyRow}>
            {['INR', 'USD', 'EUR', 'GBP'].map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setProfile({ ...profile, currency: c })}
                style={[styles.currencyBtn, profile.currency === c && styles.currencyBtnActive]}
              >
                <Text style={[styles.currencyText, profile.currency === c && { color: Colors.primary }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        <Section title="Bank & Payment Details" icon="card-outline">
          <InputField label="Bank Name" value={profile.bank_name} onChange={(v: string) => setProfile({ ...profile, bank_name: v })} placeholder="e.g. HDFC Bank" />
          <View style={styles.row}>
            <View style={{ flex: 1.5 }}>
              <InputField label="Account Number" value={profile.account_number} onChange={(v: string) => setProfile({ ...profile, account_number: v })} placeholder="Account No." keyboardType="numeric" />
            </View>
            <View style={{ width: Spacing.sm }} />
            <View style={{ flex: 1 }}>
              <InputField label="IFSC Code" value={profile.ifsc} onChange={(v: string) => setProfile({ ...profile, ifsc: v })} placeholder="IFSC Code" autoCapitalize="characters" />
            </View>
          </View>
          <InputField label="UPI ID (for QR)" value={profile.upi_id} onChange={(v: string) => setProfile({ ...profile, upi_id: v })} placeholder="example@upi" />
        </Section>

        <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={saving} activeOpacity={0.8}>
          {saving ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>Save Profile Settings</Text>
            </>
          )}
        </TouchableOpacity>

        <Section title="Data & Backup" icon="cloud-done-outline">
          <View style={styles.backupHeader}>
            <View style={styles.backupStatusRow}>
              <View style={[styles.statusDot, { backgroundColor: driveAccessToken ? Colors.success : Colors.textMuted }]} />
              <Text style={styles.backupStatusText}>{driveAccessToken ? 'Connected to Google Drive' : 'Drive not connected'}</Text>
            </View>
            <Text style={styles.lastBackupText}>
              {lastSuccess ? `Last backed up: ${toShortDate(lastSuccess.backed_up_at.split('T')[0])}` : 'No backups yet'}
            </Text>
          </View>

          <View style={styles.backupActions}>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline, driveAccessToken && styles.actionBtnConnected]} onPress={connectGoogleDrive}>
              <Ionicons name={driveAccessToken ? "checkmark" : "logo-google"} size={16} color={driveAccessToken ? Colors.success : Colors.textPrimary} />
              <Text style={[styles.actionBtnTextOutline, driveAccessToken && { color: Colors.success }]}>
                {driveAccessToken ? 'Connected' : 'Connect Drive'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary, !driveAccessToken && { opacity: 0.5 }]}
              onPress={handleBackup}
              disabled={!driveAccessToken || backingUp}
            >
              {backingUp ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
                  <Text style={styles.actionBtnTextPrimary}>Backup Now</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {backupLogs.length > 0 && (
            <View style={styles.logContainer}>
              <Text style={styles.logTitle}>Recent Backups</Text>
              {backupLogs.map((log) => (
                <View key={log.id} style={styles.logRow}>
                  <Ionicons name={log.status === 'success' ? 'checkmark-circle' : 'close-circle'} size={14} color={log.status === 'success' ? Colors.success : Colors.danger} />
                  <Text style={styles.logDate}>{log.backed_up_at.replace('T', ' ').split('.')[0]}</Text>
                  <Text style={[styles.logStatus, { color: log.status === 'success' ? Colors.success : Colors.danger }]}>{log.status}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>

        <TouchableOpacity
          style={styles.dangerZoneBtn}
          onPress={async () => {
            try {
              await GoogleSignin.revokeAccess();
              await GoogleSignin.signOut();
            } catch (e) {}
            setDriveAccessToken('');
            setIsLoggedIn(false);
          }}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={styles.dangerZoneBtnText}>Sign Out & Revoke Access</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  row: { flexDirection: 'row' },
  
  profileHero: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    marginBottom: Spacing.md,
  },
  logoPicker: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 2, borderColor: Colors.border,
    ...Shadow.md, marginBottom: Spacing.md,
  },
  logoImage: { width: '100%', height: '100%', borderRadius: 45 },
  logoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  logoPlaceholderText: { fontFamily: FontFamily.semiBold, fontSize: 10, color: Colors.textMuted },
  editIconBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: Colors.primary, width: 26, height: 26,
    borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.surface,
  },
  shopNamePreview: { fontFamily: FontFamily.extraBold, fontSize: FontSize.lg, color: Colors.textPrimary },
  shopGstinPreview: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 4 },

  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  sectionIconWrap: {
    width: 32, height: 32, borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.textPrimary },

  inputWrap: { marginBottom: Spacing.md },
  label: { fontFamily: FontFamily.semiBold, fontSize: 11, color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: FontSize.md, fontFamily: FontFamily.regular, color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },

  currencyRow: { flexDirection: 'row', gap: Spacing.sm },
  currencyBtn: {
    flex: 1, paddingVertical: 10, borderRadius: Radius.md,
    alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  currencyBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  currencyText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textSecondary },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md, paddingVertical: 16,
    marginBottom: Spacing.lg, ...Shadow.md,
  },
  saveBtnText: { color: '#fff', fontFamily: FontFamily.bold, fontSize: FontSize.md },

  backupHeader: { marginBottom: Spacing.md },
  backupStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  backupStatusText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  lastBackupText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textMuted, marginLeft: 14 },

  backupActions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: Radius.md },
  actionBtnOutline: { borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background },
  actionBtnConnected: { borderColor: Colors.success, backgroundColor: Colors.successLight },
  actionBtnPrimary: { backgroundColor: Colors.primary },
  actionBtnTextOutline: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textPrimary },
  actionBtnTextPrimary: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },

  logContainer: { marginTop: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  logTitle: { fontFamily: FontFamily.semiBold, fontSize: 11, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  logDate: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary, marginLeft: 8 },
  logStatus: { fontFamily: FontFamily.bold, fontSize: 10, textTransform: 'uppercase' },

  dangerZoneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, marginTop: Spacing.md,
  },
  dangerZoneBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.danger },
});

function toShortDate(dateStr: string) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
