import * as FileSystem from 'expo-file-system/legacy';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { db } from '../db/client';

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID!;

GoogleSignin.configure({
  scopes: ['https://www.googleapis.com/auth/drive.appdata'],
  webClientId: GOOGLE_CLIENT_ID,
});

export async function backupToDrive(accessToken: string): Promise<{ fileId: string }> {
  const docDir = FileSystem.documentDirectory ?? '';
  const DB_PATH = `${docDir}SQLite/billkato.db`;

  const dbContent = await FileSystem.readAsStringAsync(DB_PATH, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const fileName = `billkato_backup_${new Date().toISOString().slice(0, 10)}.db`;
  const boundary = 'bk_boundary_xyz';

  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify({ name: fileName, parents: ['appDataFolder'] }),
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
    db.runSync(
      `INSERT INTO backup_log (drive_file_id, status) VALUES (?, 'failed')`,
      ['']
    );
    throw new Error(json.error?.message ?? 'Drive upload failed');
  }

  db.runSync(
    `INSERT INTO backup_log (drive_file_id, status) VALUES (?, 'success')`,
    [json.id]
  );

  return { fileId: json.id };
}
