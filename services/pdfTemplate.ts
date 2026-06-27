import { SaleInvoiceWithItems } from '../db/queries/sales';
import { PurchaseInvoiceWithItems } from '../db/queries/purchases';
import { toDisplayDate } from '../utils/dateFormat';

export interface ShopProfile {
  id: number;
  name: string;
  address: string;
  phone: string;
  gstin: string;
  currency: string;
}

function currencySymbol(currency: string): string {
  const symbols: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  return symbols[currency] ?? currency;
}

function fmt(amount: number, currency: string): string {
  return `${currencySymbol(currency)}${amount.toFixed(2)}`;
}

export function buildSaleInvoiceHTML(invoice: SaleInvoiceWithItems, shop: ShopProfile): string {
  const sym = currencySymbol(shop.currency);
  const itemRows = invoice.items.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9f9f9'}">
      <td style="padding:6px 8px;border:1px solid #e0e0e0;">${i + 1}</td>
      <td style="padding:6px 8px;border:1px solid #e0e0e0;">${item.item_name}</td>
      <td style="padding:6px 8px;border:1px solid #e0e0e0;text-align:center;">${item.quantity}</td>
      <td style="padding:6px 8px;border:1px solid #e0e0e0;text-align:center;">${item.unit}</td>
      <td style="padding:6px 8px;border:1px solid #e0e0e0;text-align:right;">${sym}${item.unit_price.toFixed(2)}</td>
      <td style="padding:6px 8px;border:1px solid #e0e0e0;text-align:center;">${item.discount_pct}%</td>
      <td style="padding:6px 8px;border:1px solid #e0e0e0;text-align:right;font-weight:600;">${sym}${item.line_total.toFixed(2)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invoice ${invoice.invoice_number}</title></head>
<body style="font-family:Arial,sans-serif;font-size:13px;padding:32px;color:#1a1a1a;margin:0;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
    <div>
      <div style="font-size:22px;font-weight:700;color:#1A56DB;">${shop.name}</div>
      ${shop.address ? `<div style="margin-top:4px;color:#555;">${shop.address}</div>` : ''}
      ${shop.phone ? `<div style="color:#555;">Ph: ${shop.phone}</div>` : ''}
      ${shop.gstin ? `<div style="color:#555;">GSTIN: ${shop.gstin}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="font-size:16px;font-weight:700;color:#1A56DB;letter-spacing:1px;">TAX INVOICE</div>
      <div style="margin-top:4px;color:#555;">Invoice No: <strong>${invoice.invoice_number}</strong></div>
      <div style="color:#555;">Date: ${toDisplayDate(invoice.invoice_date)}</div>
      <div style="margin-top:4px;display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;
        background:${invoice.status === 'paid' ? '#d1fae5' : invoice.status === 'unpaid' ? '#fee2e2' : '#fef3c7'};
        color:${invoice.status === 'paid' ? '#065f46' : invoice.status === 'unpaid' ? '#991b1b' : '#92400e'};">
        ${invoice.status.toUpperCase()}
      </div>
    </div>
  </div>
  <hr style="border:none;border-top:2px solid #1A56DB;margin:16px 0;">
  <div style="margin-bottom:16px;padding:10px;background:#f0f4ff;border-radius:6px;">
    <strong>Customer:</strong> ${invoice.customer_name || '—'} ${invoice.customer_phone ? `| ${invoice.customer_phone}` : ''}
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <thead>
      <tr style="background:#1A56DB;color:#fff;">
        <th style="padding:8px;border:1px solid #1A56DB;text-align:left;">#</th>
        <th style="padding:8px;border:1px solid #1A56DB;text-align:left;">Item</th>
        <th style="padding:8px;border:1px solid #1A56DB;text-align:center;">Qty</th>
        <th style="padding:8px;border:1px solid #1A56DB;text-align:center;">Unit</th>
        <th style="padding:8px;border:1px solid #1A56DB;text-align:right;">Rate (${sym})</th>
        <th style="padding:8px;border:1px solid #1A56DB;text-align:center;">Disc%</th>
        <th style="padding:8px;border:1px solid #1A56DB;text-align:right;">Amount (${sym})</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end;margin-bottom:24px;">
    <div style="width:260px;">
      <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #e5e7eb;">
        <span style="color:#555;">Subtotal</span><span>${fmt(invoice.subtotal, shop.currency)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #e5e7eb;">
        <span style="color:#555;">Discount</span><span style="color:#e02424;">-${fmt(invoice.discount_amount, shop.currency)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #e5e7eb;">
        <span style="color:#555;">Tax</span><span>${fmt(invoice.tax_amount, shop.currency)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;margin-top:4px;background:#1A56DB;color:#fff;padding:8px 12px;border-radius:6px;">
        <span style="font-weight:700;font-size:15px;">TOTAL</span>
        <span style="font-weight:700;font-size:15px;">${fmt(invoice.total, shop.currency)}</span>
      </div>
    </div>
  </div>
  ${invoice.notes ? `<div style="margin-bottom:16px;padding:10px;background:#f9fafb;border-radius:6px;border-left:3px solid #1A56DB;"><strong>Notes:</strong> ${invoice.notes}</div>` : ''}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin-top:24px;">
  <div style="text-align:center;color:#9ca3af;font-size:11px;margin-top:8px;">
    Generated by Bill Kato • ${new Date().toLocaleString()}
  </div>
</body>
</html>`;
}

export function buildPurchaseInvoiceHTML(invoice: PurchaseInvoiceWithItems, shop: ShopProfile): string {
  const sym = currencySymbol(shop.currency);
  const itemRows = invoice.items.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9f9f9'}">
      <td style="padding:6px 8px;border:1px solid #e0e0e0;">${i + 1}</td>
      <td style="padding:6px 8px;border:1px solid #e0e0e0;">${item.item_name}</td>
      <td style="padding:6px 8px;border:1px solid #e0e0e0;text-align:center;">${item.quantity}</td>
      <td style="padding:6px 8px;border:1px solid #e0e0e0;text-align:center;">${item.unit}</td>
      <td style="padding:6px 8px;border:1px solid #e0e0e0;text-align:right;">${sym}${item.unit_cost.toFixed(2)}</td>
      <td style="padding:6px 8px;border:1px solid #e0e0e0;text-align:right;font-weight:600;">${sym}${item.line_total.toFixed(2)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Purchase ${invoice.invoice_number}</title></head>
<body style="font-family:Arial,sans-serif;font-size:13px;padding:32px;color:#1a1a1a;margin:0;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
    <div>
      <div style="font-size:22px;font-weight:700;color:#0E9F6E;">${shop.name}</div>
      ${shop.address ? `<div style="margin-top:4px;color:#555;">${shop.address}</div>` : ''}
      ${shop.phone ? `<div style="color:#555;">Ph: ${shop.phone}</div>` : ''}
      ${shop.gstin ? `<div style="color:#555;">GSTIN: ${shop.gstin}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="font-size:16px;font-weight:700;color:#0E9F6E;letter-spacing:1px;">PURCHASE RECORD</div>
      <div style="margin-top:4px;color:#555;">Invoice No: <strong>${invoice.invoice_number}</strong></div>
      <div style="color:#555;">Date: ${toDisplayDate(invoice.invoice_date)}</div>
    </div>
  </div>
  <hr style="border:none;border-top:2px solid #0E9F6E;margin:16px 0;">
  <div style="margin-bottom:16px;padding:10px;background:#f0fff8;border-radius:6px;">
    <strong>Vendor:</strong> ${invoice.vendor_name || '—'} ${invoice.vendor_phone ? `| ${invoice.vendor_phone}` : ''}
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <thead>
      <tr style="background:#0E9F6E;color:#fff;">
        <th style="padding:8px;border:1px solid #0E9F6E;text-align:left;">#</th>
        <th style="padding:8px;border:1px solid #0E9F6E;text-align:left;">Item</th>
        <th style="padding:8px;border:1px solid #0E9F6E;text-align:center;">Qty</th>
        <th style="padding:8px;border:1px solid #0E9F6E;text-align:center;">Unit</th>
        <th style="padding:8px;border:1px solid #0E9F6E;text-align:right;">Cost (${sym})</th>
        <th style="padding:8px;border:1px solid #0E9F6E;text-align:right;">Amount (${sym})</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end;margin-bottom:24px;">
    <div style="width:260px;">
      <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #e5e7eb;">
        <span style="color:#555;">Subtotal</span><span>${fmt(invoice.subtotal, shop.currency)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #e5e7eb;">
        <span style="color:#555;">Tax</span><span>${fmt(invoice.tax_amount, shop.currency)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;background:#0E9F6E;color:#fff;padding:8px 12px;border-radius:6px;margin-top:4px;">
        <span style="font-weight:700;font-size:15px;">TOTAL</span>
        <span style="font-weight:700;font-size:15px;">${fmt(invoice.total, shop.currency)}</span>
      </div>
    </div>
  </div>
  ${invoice.notes ? `<div style="margin-bottom:16px;padding:10px;background:#f9fafb;border-radius:6px;border-left:3px solid #0E9F6E;"><strong>Notes:</strong> ${invoice.notes}</div>` : ''}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin-top:24px;">
  <div style="text-align:center;color:#9ca3af;font-size:11px;margin-top:8px;">
    Generated by Bill Kato • ${new Date().toLocaleString()}
  </div>
</body>
</html>`;
}
