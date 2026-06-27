import { db } from '../db/client';

export function nextInvoiceNumber(type: 'SALE' | 'PUR'): string {
  const prefix = type === 'SALE' ? 'SALE' : 'PUR';
  const year = new Date().getFullYear();
  const table = type === 'SALE' ? 'sale_invoices' : 'purchase_invoices';

  const result = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM ${table} WHERE invoice_number LIKE ?`,
    [`${prefix}-${year}-%`]
  );

  const seq = String((result?.count ?? 0) + 1).padStart(4, '0');
  return `${prefix}-${year}-${seq}`;
}
