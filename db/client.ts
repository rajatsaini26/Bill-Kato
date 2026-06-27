import * as SQLite from 'expo-sqlite';
import { runMigrations } from './schema';

const db = SQLite.openDatabaseSync('billkato.db');
db.execSync('PRAGMA foreign_keys = ON;');
runMigrations(db);

export { db };
