import { db } from '../client';

export interface SaleInvoiceItem {
  id: number;
  invoice_id: number;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_pct: number;
  line_total: number;
  cost_price: number;
}

export interface SaleInvoice {
  id: number;
  invoice_number: string;
  customer_name: string;
  customer_phone: string;
  invoice_date: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  notes: string;
  pdf_uri: string;
  status: string;
  created_at: string;
}

export type SaleInvoiceWithItems = SaleInvoice & { items: SaleInvoiceItem[] };

export interface CreateSaleInvoiceInput {
  invoice_number: string;
  customer_name: string;
  customer_phone: string;
  invoice_date: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  notes: string;
  status: string;
  items: Omit<SaleInvoiceItem, 'id' | 'invoice_id'>[];
}

export function createSaleInvoice(data: CreateSaleInvoiceInput): number {
  const result = db.runSync(
    `INSERT INTO sale_invoices (invoice_number, customer_name, customer_phone, invoice_date, subtotal, discount_amount, tax_amount, total, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.invoice_number,
      data.customer_name,
      data.customer_phone,
      data.invoice_date,
      data.subtotal,
      data.discount_amount,
      data.tax_amount,
      data.total,
      data.notes,
      data.status,
    ]
  );
  const invoiceId = result.lastInsertRowId;
  for (const item of data.items) {
    db.runSync(
      `INSERT INTO sale_invoice_items (invoice_id, item_name, quantity, unit, unit_price, discount_pct, line_total, cost_price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoiceId, item.item_name, item.quantity, item.unit, item.unit_price, item.discount_pct, item.line_total, item.cost_price]
    );
    db.runSync(
      `INSERT INTO inventory_items (item_name, unit, current_stock, default_price)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(item_name) DO UPDATE SET current_stock = current_stock - ?`,
      [item.item_name, item.unit, -item.quantity, item.unit_price, item.quantity]
    );
  }
  return invoiceId as number;
}

export function getSaleInvoices(filters?: { month?: string; quarter?: string }): SaleInvoice[] {
  let query = `SELECT * FROM sale_invoices`;
  const params: string[] = [];
  if (filters?.month) {
    query += ` WHERE strftime('%Y-%m', invoice_date) = ?`;
    params.push(filters.month);
  }
  query += ` ORDER BY created_at DESC`;
  return db.getAllSync<SaleInvoice>(query, params);
}

export function getRecentSaleInvoices(limit = 5): SaleInvoice[] {
  return db.getAllSync<SaleInvoice>(
    `SELECT * FROM sale_invoices ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
}

export function getSaleInvoiceById(id: number): SaleInvoiceWithItems | null {
  const invoice = db.getFirstSync<SaleInvoice>(
    `SELECT * FROM sale_invoices WHERE id = ?`,
    [id]
  );
  if (!invoice) return null;
  const items = db.getAllSync<SaleInvoiceItem>(
    `SELECT * FROM sale_invoice_items WHERE invoice_id = ?`,
    [id]
  );
  return { ...invoice, items };
}

export function updateSaleInvoicePdfUri(id: number, uri: string): void {
  db.runSync(`UPDATE sale_invoices SET pdf_uri = ? WHERE id = ?`, [uri, id]);
}

export function deleteSaleInvoice(id: number): void {
  db.runSync(`DELETE FROM sale_invoices WHERE id = ?`, [id]);
}
