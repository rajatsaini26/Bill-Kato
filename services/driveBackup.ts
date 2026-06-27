import * as FileSystem from 'expo-file-system/legacy';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { db, reloadDatabase } from '../db/client';

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID!;

GoogleSignin.configure({
  scopes: ['https://www.googleapis.com/auth/drive.file'],
  webClientId: GOOGLE_CLIENT_ID,
});

export async function backupToDrive(accessToken: string): Promise<{ fileId: string }> {
  const docDir = FileSystem.documentDirectory ?? '';
  const DB_PATH = `${docDir}SQLite/billkato.db`;

  const dbContent = await FileSystem.readAsStringAsync(DB_PATH, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Safe file name format: BillKato_Backup_YYYY-MM-DD_HH-mm-ss.db
  const d = new Date();
  const timeStr = `${d.getHours()}-${d.getMinutes()}-${d.getSeconds()}`;
  const fileName = `BillKato_Backup_${d.toISOString().slice(0, 10)}_${timeStr}.db`;
  
  const boundary = 'bk_boundary_xyz';

  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify({ name: fileName }), // Removed parents: ['appDataFolder'] so it goes to root
    `--${boundary}`,
    'Content-Type: application/octet-stream',
    'Content-Transfer-Encoding: base64',
    '',
    dbContent,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  const json = await res.json();
  if (!res.ok) {
    db.runSync(`INSERT INTO backup_log (drive_file_id, status) VALUES (?, 'failed')`, ['']);
    throw new Error(json.error?.message ?? 'Drive upload failed');
  }

  db.runSync(`INSERT INTO backup_log (drive_file_id, status) VALUES (?, 'success')`, [json.id]);
  return { fileId: json.id };
}

export async function restoreFromDrive(accessToken: string): Promise<boolean> {
  const docDir = FileSystem.documentDirectory ?? '';
  const DB_PATH = `${docDir}SQLite/billkato.db`;

  // 1. Find the latest backup
  const q = encodeURIComponent(`name contains 'BillKato_Backup_' and trashed=false`);
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&pageSize=1`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  
  const listJson = await listRes.json();
  if (!listRes.ok) throw new Error(listJson.error?.message || 'Failed to list backups');
  
  if (!listJson.files || listJson.files.length === 0) {
    return false; // No backups found
  }

  const fileId = listJson.files[0].id;

  // Close the DB before overwriting the file
  try {
    db.closeSync();
  } catch (e) { }

  // 2. Download the file
  const fileData = await FileSystem.downloadAsync(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    DB_PATH,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  if (fileData.status !== 200) {
    reloadDatabase(); // ensure it reopens even if download failed
    throw new Error('Failed to download backup file');
  }

  reloadDatabase();
  return true;
}
