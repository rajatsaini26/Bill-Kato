import * as SQLite from 'expo-sqlite';

export function runMigrations(db: SQLite.SQLiteDatabase) {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS shop_profile (
      id              INTEGER PRIMARY KEY,
      name            TEXT NOT NULL DEFAULT 'My Shop',
      address         TEXT DEFAULT '',
      phone           TEXT DEFAULT '',
      gstin           TEXT DEFAULT '',
      currency        TEXT DEFAULT 'INR',
      bank_name       TEXT DEFAULT '',
      account_number  TEXT DEFAULT '',
      ifsc            TEXT DEFAULT '',
      upi_id          TEXT DEFAULT '',
      logo_uri        TEXT DEFAULT '',
      created_at      TEXT DEFAULT (datetime('now', 'localtime'))
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
      amount_paid     REAL NOT NULL DEFAULT 0,
      payment_status  TEXT DEFAULT 'Paid',
      invoice_type    TEXT DEFAULT 'sale',
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
      amount_paid     REAL NOT NULL DEFAULT 0,
      payment_status  TEXT DEFAULT 'Paid',
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

    CREATE TABLE IF NOT EXISTS inventory_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name       TEXT NOT NULL UNIQUE,
      unit            TEXT DEFAULT 'pcs',
      current_stock   REAL NOT NULL DEFAULT 0,
      default_price   REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS backup_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      backed_up_at  TEXT DEFAULT (datetime('now', 'localtime')),
      drive_file_id TEXT DEFAULT '',
      status        TEXT DEFAULT 'pending'
    );
  `);

  const columnsToAdd = [
    { table: 'shop_profile', col: 'bank_name TEXT DEFAULT ""' },
    { table: 'shop_profile', col: 'account_number TEXT DEFAULT ""' },
    { table: 'shop_profile', col: 'ifsc TEXT DEFAULT ""' },
    { table: 'shop_profile', col: 'upi_id TEXT DEFAULT ""' },
    { table: 'shop_profile', col: 'logo_uri TEXT DEFAULT ""' },
    { table: 'sale_invoices', col: 'amount_paid REAL NOT NULL DEFAULT 0' },
    { table: 'sale_invoices', col: 'payment_status TEXT DEFAULT "Paid"' },
    { table: 'sale_invoices', col: 'invoice_type TEXT DEFAULT "sale"' },
    { table: 'purchase_invoices', col: 'amount_paid REAL NOT NULL DEFAULT 0' },
    { table: 'purchase_invoices', col: 'payment_status TEXT DEFAULT "Paid"' }
  ];

  for (const { table, col } of columnsToAdd) {
    try {
      db.execSync(`ALTER TABLE ${table} ADD COLUMN ${col};`);
    } catch (e) {
      // Ignore if column already exists
    }
  }
}
