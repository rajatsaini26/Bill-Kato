import { db } from '../client';

export interface PurchaseInvoiceItem {
  id: number;
  invoice_id: number;
  item_name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  line_total: number;
}

export interface PurchaseInvoice {
  id: number;
  invoice_number: string;
  vendor_name: string;
  vendor_phone: string;
  invoice_date: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes: string;
  pdf_uri: string;
  amount_paid: number;
  payment_status: string;
  created_at: string;
}

export type PurchaseInvoiceWithItems = PurchaseInvoice & { items: PurchaseInvoiceItem[] };

export interface CreatePurchaseInvoiceInput {
  invoice_number: string;
  vendor_name: string;
  vendor_phone: string;
  invoice_date: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes: string;
  amount_paid: number;
  payment_status: string;
  items: Omit<PurchaseInvoiceItem, 'id' | 'invoice_id'>[];
}

export function createPurchaseInvoice(data: CreatePurchaseInvoiceInput): number {
  const result = db.runSync(
    `INSERT INTO purchase_invoices (invoice_number, vendor_name, vendor_phone, invoice_date, subtotal, tax_amount, total, notes, amount_paid, payment_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.invoice_number,
      data.vendor_name,
      data.vendor_phone,
      data.invoice_date,
      data.subtotal,
      data.tax_amount,
      data.total,
      data.notes,
      data.amount_paid,
      data.payment_status,
    ]
  );
  const invoiceId = result.lastInsertRowId;
  for (const item of data.items) {
    db.runSync(
      `INSERT INTO purchase_invoice_items (invoice_id, item_name, quantity, unit, unit_cost, line_total)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [invoiceId, item.item_name, item.quantity, item.unit, item.unit_cost, item.line_total]
    );
    db.runSync(
      `INSERT INTO inventory_items (item_name, unit, current_stock, default_price)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(item_name) DO UPDATE SET current_stock = current_stock + ?`,
      [item.item_name, item.unit, item.quantity, item.unit_cost, item.quantity]
    );
  }
  return invoiceId as number;
}

export function updatePurchaseInvoice(id: number, data: CreatePurchaseInvoiceInput): void {
  // 1. Revert old stock (Purchases ADD stock, so we SUBTRACT to revert)
  const oldItems = db.getAllSync<PurchaseInvoiceItem>(`SELECT * FROM purchase_invoice_items WHERE invoice_id = ?`, [id]);
  for (const old of oldItems) {
    db.runSync(
      `UPDATE inventory_items SET current_stock = current_stock - ? WHERE item_name = ?`,
      [old.quantity, old.item_name]
    );
  }

  // 2. Update Invoice
  db.runSync(
    `UPDATE purchase_invoices 
     SET invoice_number = ?, vendor_name = ?, vendor_phone = ?, invoice_date = ?, subtotal = ?, tax_amount = ?, total = ?, notes = ?, amount_paid = ?, payment_status = ?
     WHERE id = ?`,
    [data.invoice_number, data.vendor_name, data.vendor_phone, data.invoice_date, data.subtotal, data.tax_amount, data.total, data.notes, data.amount_paid, data.payment_status, id]
  );

  // 3. Delete old items and insert new ones
  db.runSync(`DELETE FROM purchase_invoice_items WHERE invoice_id = ?`, [id]);
  for (const item of data.items) {
    db.runSync(
      `INSERT INTO purchase_invoice_items (invoice_id, item_name, quantity, unit, unit_cost, line_total)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, item.item_name, item.quantity, item.unit, item.unit_cost, item.line_total]
    );
    db.runSync(
      `INSERT INTO inventory_items (item_name, unit, current_stock, default_price)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(item_name) DO UPDATE SET current_stock = current_stock + ?`,
      [item.item_name, item.unit, item.quantity, item.unit_cost, item.quantity]
    );
  }
}

export function getPurchaseInvoices(filters?: { month?: string; quarter?: string }): PurchaseInvoice[] {
  let query = `SELECT * FROM purchase_invoices`;
  const params: string[] = [];
  if (filters?.month) {
    query += ` WHERE strftime('%Y-%m', invoice_date) = ?`;
    params.push(filters.month);
  }
  query += ` ORDER BY created_at DESC`;
  return db.getAllSync<PurchaseInvoice>(query, params);
}

export function getRecentPurchaseInvoices(limit = 5): PurchaseInvoice[] {
  return db.getAllSync<PurchaseInvoice>(
    `SELECT * FROM purchase_invoices ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
}

export function getPurchaseInvoiceById(id: number): PurchaseInvoiceWithItems | null {
  const invoice = db.getFirstSync<PurchaseInvoice>(
    `SELECT * FROM purchase_invoices WHERE id = ?`,
    [id]
  );
  if (!invoice) return null;
  const items = db.getAllSync<PurchaseInvoiceItem>(
    `SELECT * FROM purchase_invoice_items WHERE invoice_id = ?`,
    [id]
  );
  return { ...invoice, items };
}

export function getVendorSuggestions(query: string): string[] {
  if (!query) return [];
  const rows = db.getAllSync<{ vendor_name: string }>(
    `SELECT DISTINCT vendor_name FROM purchase_invoices WHERE vendor_name LIKE ? LIMIT 10`,
    [`%${query}%`]
  );
  return rows.map((r) => r.vendor_name).filter(Boolean);
}

export function updatePurchaseInvoicePdfUri(id: number, uri: string): void {
  db.runSync(`UPDATE purchase_invoices SET pdf_uri = ? WHERE id = ?`, [uri, id]);
}

export function deletePurchaseInvoice(id: number): void {
  // Revert stock before deleting (Subtracting stock since it was a purchase)
  const items = db.getAllSync<PurchaseInvoiceItem>(`SELECT * FROM purchase_invoice_items WHERE invoice_id = ?`, [id]);
  for (const item of items) {
    db.runSync(`UPDATE inventory_items SET current_stock = current_stock - ? WHERE item_name = ?`, [item.quantity, item.item_name]);
  }
  db.runSync(`DELETE FROM purchase_invoices WHERE id = ?`, [id]);
}
