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
  items: Omit<PurchaseInvoiceItem, 'id' | 'invoice_id'>[];
}

export function createPurchaseInvoice(data: CreatePurchaseInvoiceInput): number {
  const result = db.runSync(
    `INSERT INTO purchase_invoices (invoice_number, vendor_name, vendor_phone, invoice_date, subtotal, tax_amount, total, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.invoice_number,
      data.vendor_name,
      data.vendor_phone,
      data.invoice_date,
      data.subtotal,
      data.tax_amount,
      data.total,
      data.notes,
    ]
  );
  const invoiceId = result.lastInsertRowId;
  for (const item of data.items) {
    db.runSync(
      `INSERT INTO purchase_invoice_items (invoice_id, item_name, quantity, unit, unit_cost, line_total)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [invoiceId, item.item_name, item.quantity, item.unit, item.unit_cost, item.line_total]
    );
  }
  return invoiceId as number;
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

export function updatePurchaseInvoicePdfUri(id: number, uri: string): void {
  db.runSync(`UPDATE purchase_invoices SET pdf_uri = ? WHERE id = ?`, [uri, id]);
}

export function deletePurchaseInvoice(id: number): void {
  db.runSync(`DELETE FROM purchase_invoices WHERE id = ?`, [id]);
}
