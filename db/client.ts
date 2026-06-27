import * as SQLite from 'expo-sqlite';
import { runMigrations } from './schema';

let db = SQLite.openDatabaseSync('billkato.db');
db.execSync('PRAGMA foreign_keys = ON;');
runMigrations(db);

export function reloadDatabase() {
  try {
    db.closeSync();
  } catch (e) {
    console.log('Error closing DB', e);
  }
  db = SQLite.openDatabaseSync('billkato.db');
  db.execSync('PRAGMA foreign_keys = ON;');
  runMigrations(db);
}

export { db };
