import * as SQLite from 'expo-sqlite';

export function runMigrations(db: SQLite.SQLiteDatabase) {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS shop_profile (
      id          INTEGER PRIMARY KEY,
      name        TEXT NOT NULL DEFAULT 'My Shop',
      address     TEXT DEFAULT '',
      phone       TEXT DEFAULT '',
      gstin       TEXT DEFAULT '',
      currency    TEXT DEFAULT 'INR',
      created_at  TEXT DEFAULT (datetime('now', 'localtime'))
    );

    INSERT OR IGNORE INTO shop_profile (id, name) VALUES (1, 'My Shop');

    CREATE TABLE IF NOT EXISTS sale_invoices (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number  TEXT NOT NULL UNIQUE,
      customer_name   TEXT DEFAULT '',
      customer_phone  TEXT DEFAULT '',
      invoice_date    TEXT NOT NULL,
      subtotal        REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      tax_amount      REAL NOT NULL DEFAULT 0,
      total           REAL NOT NULL DEFAULT 0,
      notes           TEXT DEFAULT '',
      pdf_uri         TEXT DEFAULT '',
      status          TEXT DEFAULT 'paid',
      created_at      TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS sale_invoice_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id      INTEGER NOT NULL REFERENCES sale_invoices(id) ON DELETE CASCADE,
      item_name       TEXT NOT NULL,
      quantity        REAL NOT NULL,
      unit            TEXT DEFAULT 'pcs',
      unit_price      REAL NOT NULL,
      discount_pct    REAL DEFAULT 0,
      line_total      REAL NOT NULL,
      cost_price      REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number  TEXT NOT NULL UNIQUE,
      vendor_name     TEXT DEFAULT '',
      vendor_phone    TEXT DEFAULT '',
      invoice_date    TEXT NOT NULL,
      subtotal        REAL NOT NULL DEFAULT 0,
      tax_amount      REAL NOT NULL DEFAULT 0,
      total           REAL NOT NULL DEFAULT 0,
      notes           TEXT DEFAULT '',
      pdf_uri         TEXT DEFAULT '',
      created_at      TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS purchase_invoice_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id      INTEGER NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
      item_name       TEXT NOT NULL,
      quantity        REAL NOT NULL,
      unit            TEXT DEFAULT 'pcs',
      unit_cost       REAL NOT NULL,
      line_total      REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backup_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      backed_up_at  TEXT DEFAULT (datetime('now', 'localtime')),
      drive_file_id TEXT DEFAULT '',
      status        TEXT DEFAULT 'pending'
    );
  `);
}
