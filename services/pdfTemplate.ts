import * as FileSystem from 'expo-file-system/legacy';
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
  bank_name?: string;
  account_number?: string;
  ifsc?: string;
  upi_id?: string;
  logo_uri?: string;
}

function currencySymbol(currency: string): string {
  const symbols: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  return symbols[currency] ?? currency;
}

function fmt(amount: number, currency: string): string {
  const sym = currencySymbol(currency);
  return `${sym}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function getBase64Image(uri?: string): Promise<string> {
  if (!uri) return '';
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/jpeg;base64,${base64}`;
  } catch {
    return uri;
  }
}

const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 13px;
    color: #111827;
    background: #ffffff;
    padding: 0;
    margin: 0;
  }
  .page { padding: 36px 40px; max-width: 800px; margin: 0 auto; }

  /* ── Header ── */
  .header-bar {
    height: 6px;
    border-radius: 0 0 4px 4px;
    margin-bottom: 28px;
  }
  .header-body {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
  }
  .shop-logo {
    width: 72px; height: 72px;
    object-fit: contain;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
    margin-right: 16px;
  }
  .shop-name {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.5px;
  }
  .shop-meta { color: #6b7280; font-size: 12px; margin-top: 4px; line-height: 1.7; }
  .invoice-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 4px 12px;
    border-radius: 4px;
    margin-bottom: 10px;
    display: inline-block;
  }
  .invoice-meta { text-align: right; }
  .invoice-meta p { color: #6b7280; font-size: 12px; margin-top: 4px; }
  .invoice-meta strong { color: #111827; }
  .status-pill {
    display: inline-block;
    margin-top: 8px;
    padding: 3px 12px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  /* ── Divider ── */
  .divider { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }
  .divider-accent { border: none; border-top: 2px solid; margin: 20px 0; }

  /* ── Party Card (Customer / Vendor) ── */
  .party-card {
    border-radius: 10px;
    padding: 14px 18px;
    margin-bottom: 24px;
    border: 1px solid #e5e7eb;
  }
  .party-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .party-name { font-size: 15px; font-weight: 700; color: #111827; }
  .party-phone { font-size: 12px; color: #6b7280; margin-top: 2px; }

  /* ── Items Table ── */
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead tr { color: #fff; }
  thead th {
    padding: 10px 10px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  tbody tr { border-bottom: 1px solid #f3f4f6; }
  tbody tr:last-child { border-bottom: none; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  tbody td { padding: 9px 10px; font-size: 13px; vertical-align: middle; }
  tbody td.item-name { font-weight: 600; color: #111827; }
  tbody td.num { text-align: right; }
  tbody td.ctr { text-align: center; }
  tbody td.amount { font-weight: 700; text-align: right; }

  /* ── Totals ── */
  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 28px; }
  .totals-box { width: 280px; }
  .totals-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 0;
    font-size: 13px;
    border-bottom: 1px solid #f3f4f6;
  }
  .totals-row:last-child { border-bottom: none; }
  .totals-label { color: #6b7280; }
  .totals-value { font-weight: 600; color: #111827; }
  .total-grand {
    display: flex; justify-content: space-between; align-items: center;
    padding: 11px 16px;
    border-radius: 8px;
    color: #fff;
    margin: 8px 0;
  }
  .total-grand span { font-size: 15px; font-weight: 800; }
  .balance-due { color: #dc2626; font-weight: 700; }
  .balance-ok { color: #059669; font-weight: 700; }

  /* ── Notes ── */
  .notes-box {
    padding: 12px 16px;
    background: #f9fafb;
    border-radius: 8px;
    border-left: 3px solid;
    margin-bottom: 24px;
    font-size: 12px;
    color: #374151;
    line-height: 1.6;
  }
  .notes-box strong { display: block; margin-bottom: 4px; color: #111827; }

  /* ── Bank Details ── */
  .bank-box {
    display: flex; justify-content: space-between; align-items: center;
    padding: 16px 20px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    margin-bottom: 28px;
    background: #f9fafb;
  }
  .bank-title { font-size: 12px; font-weight: 700; color: #374151; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  .bank-row { font-size: 12px; color: #6b7280; margin-bottom: 3px; }
  .bank-row strong { color: #111827; }
  .qr-img { width: 90px; height: 90px; border-radius: 6px; border: 1px solid #e5e7eb; }
  .qr-caption { font-size: 9px; color: #9ca3af; text-align: center; margin-top: 4px; }

  /* ── Footer ── */
  .footer-divider { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0 14px; }
  .footer-shop { text-align: center; font-size: 13px; font-weight: 600; color: #374151; }
  .footer-addr { text-align: center; font-size: 11px; color: #9ca3af; margin-top: 3px; }
  .footer-generated { text-align: center; font-size: 10px; color: #d1d5db; margin-top: 10px; }
`;

function getHeader(
  shop: ShopProfile,
  logoBase64: string,
  invoiceNumber: string,
  date: string,
  type: 'SALE' | 'PURCHASE' | 'RETURN',
  status?: string,
) {
  const title = type === 'SALE' ? 'ESTIMATE' : type === 'RETURN' ? 'RETURN BILL' : 'PURCHASE RECORD';
  const color = type === 'SALE' ? '#1A56DB' : type === 'RETURN' ? '#dc2626' : '#0E9F6E';
  const labelBg = type === 'SALE' ? '#EEF2FF' : type === 'RETURN' ? '#FEE2E2' : '#D1FAE5';

  let statusHtml = '';
  if (status) {
    const s = status.toLowerCase();
    const sBg = s === 'paid' ? '#D1FAE5' : s === 'unpaid' ? '#FEE2E2' : '#FEF3C7';
    const sColor = s === 'paid' ? '#065F46' : s === 'unpaid' ? '#991B1B' : '#92400E';
    statusHtml = `<span class="status-pill" style="background:${sBg};color:${sColor};">${s.toUpperCase()}</span>`;
  }

  return `
  <div class="header-bar" style="background:linear-gradient(90deg,${color},${color}cc);"></div>
  <div class="header-body">
    <div style="display:flex;align-items:flex-start;">
      ${logoBase64 ? `<img src="${logoBase64}" class="shop-logo" />` : ''}
      <div>
        <div class="shop-name" style="color:${color};">${shop.name}</div>
        <div class="shop-meta">
          ${shop.address ? `${shop.address}<br>` : ''}
          ${shop.phone ? `📞 ${shop.phone}<br>` : ''}
          ${shop.gstin ? `GSTIN: ${shop.gstin}` : ''}
        </div>
      </div>
    </div>
    <div class="invoice-meta">
      <span class="invoice-label" style="background:${labelBg};color:${color};">${title}</span>
      <p>Invoice No: <strong>${invoiceNumber}</strong></p>
      <p>Date: <strong>${toDisplayDate(date)}</strong></p>
      ${statusHtml}
    </div>
  </div>
  <hr class="divider-accent" style="border-color:${color}20;">`;
}

function getBankDetails(shop: ShopProfile) {
  if (!shop.bank_name && !shop.account_number && !shop.upi_id) return '';
  const upiLink = shop.upi_id ? `upi://pay?pa=${shop.upi_id}&pn=${encodeURIComponent(shop.name)}` : '';
  const qrUrl = upiLink ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(upiLink)}` : '';

  return `
  <div class="bank-box">
    <div>
      <div class="bank-title">Bank &amp; Payment Details</div>
      ${shop.bank_name ? `<div class="bank-row"><strong>Bank:</strong> ${shop.bank_name}</div>` : ''}
      ${shop.account_number ? `<div class="bank-row"><strong>Account No:</strong> ${shop.account_number}</div>` : ''}
      ${shop.ifsc ? `<div class="bank-row"><strong>IFSC:</strong> ${shop.ifsc}</div>` : ''}
      ${shop.upi_id ? `<div class="bank-row"><strong>UPI ID:</strong> ${shop.upi_id}</div>` : ''}
    </div>
    ${qrUrl ? `<div><img src="${qrUrl}" class="qr-img"/><div class="qr-caption">Scan to Pay</div></div>` : ''}
  </div>`;
}

function getFooter(shop: ShopProfile) {
  return `
  <hr class="footer-divider">
  <div class="footer-shop">${shop.name}</div>
  ${shop.address ? `<div class="footer-addr">${shop.address}${shop.phone ? ` · ${shop.phone}` : ''}</div>` : ''}
  <div class="footer-generated">Generated by Bill Kato · ${new Date().toLocaleString('en-IN')}</div>`;
}

export async function buildSaleInvoiceHTML(invoice: SaleInvoiceWithItems, shop: ShopProfile): Promise<string> {
  const sym = currencySymbol(shop.currency);
  const logoBase64 = await getBase64Image(shop.logo_uri);
  const color = invoice.invoice_type === 'return' ? '#dc2626' : '#1A56DB';

  const itemRows = invoice.items.map((item, i) => `
    <tr>
      <td class="ctr" style="color:#9ca3af;">${i + 1}</td>
      <td class="item-name">${item.item_name}</td>
      <td class="ctr">${item.quantity}</td>
      <td class="ctr" style="color:#6b7280;">${item.unit}</td>
      <td class="num">${sym}${item.unit_price.toFixed(2)}</td>
      <td class="ctr" style="color:${item.discount_pct > 0 ? '#dc2626' : '#9ca3af'};">${item.discount_pct}%</td>
      <td class="amount" style="color:${color};">${sym}${item.line_total.toFixed(2)}</td>
    </tr>
  `).join('');

  const balanceDue = invoice.total - (invoice.amount_paid ?? invoice.total);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Estimate ${invoice.invoice_number}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
<div class="page">

  ${getHeader(shop, logoBase64, invoice.invoice_number, invoice.invoice_date, invoice.invoice_type === 'return' ? 'RETURN' : 'SALE', invoice.payment_status)}

  <div class="party-card" style="background:#EEF2FF20;">
    <div class="party-label" style="color:${color};">Bill To</div>
    <div class="party-name">${invoice.customer_name || 'Walk-in Customer'}</div>
    ${invoice.customer_phone ? `<div class="party-phone">📞 ${invoice.customer_phone}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr style="background:${color};">
        <th class="ctr" style="width:32px;">#</th>
        <th style="text-align:left;">Item</th>
        <th class="ctr">Qty</th>
        <th class="ctr">Unit</th>
        <th style="text-align:right;">Rate (${sym})</th>
        <th class="ctr">Disc%</th>
        <th style="text-align:right;">Amount (${sym})</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals-box">
      <div class="totals-row">
        <span class="totals-label">Subtotal</span>
        <span class="totals-value">${fmt(invoice.subtotal, shop.currency)}</span>
      </div>
      ${invoice.discount_amount > 0 ? `
      <div class="totals-row">
        <span class="totals-label">Discount</span>
        <span style="color:#dc2626;font-weight:600;">- ${fmt(invoice.discount_amount, shop.currency)}</span>
      </div>` : ''}
      <div class="totals-row">
        <span class="totals-label">Tax</span>
        <span class="totals-value">${fmt(invoice.tax_amount, shop.currency)}</span>
      </div>
      <div class="total-grand" style="background:${color};">
        <span>TOTAL</span>
        <span>${fmt(invoice.total, shop.currency)}</span>
      </div>
      <div class="totals-row">
        <span class="totals-label">Amount Paid</span>
        <span style="color:#059669;font-weight:600;">${fmt(invoice.amount_paid ?? invoice.total, shop.currency)}</span>
      </div>
      <div class="totals-row">
        <span class="totals-label" style="font-weight:700;">Balance Due</span>
        <span class="${balanceDue > 0 ? 'balance-due' : 'balance-ok'}">${fmt(balanceDue, shop.currency)}</span>
      </div>
    </div>
  </div>

  ${invoice.notes ? `
  <div class="notes-box" style="border-color:${color};">
    <strong>Notes</strong>${invoice.notes}
  </div>` : ''}

  ${getBankDetails(shop)}
  ${getFooter(shop)}

</div>
</body>
</html>`;
}

export async function buildPurchaseInvoiceHTML(invoice: PurchaseInvoiceWithItems, shop: ShopProfile): Promise<string> {
  const sym = currencySymbol(shop.currency);
  const logoBase64 = await getBase64Image(shop.logo_uri);
  const color = '#0E9F6E';

  const itemRows = invoice.items.map((item, i) => `
    <tr>
      <td class="ctr" style="color:#9ca3af;">${i + 1}</td>
      <td class="item-name">${item.item_name}</td>
      <td class="ctr">${item.quantity}</td>
      <td class="ctr" style="color:#6b7280;">${item.unit}</td>
      <td class="num">${sym}${item.unit_cost.toFixed(2)}</td>
      <td class="amount" style="color:${color};">${sym}${item.line_total.toFixed(2)}</td>
    </tr>
  `).join('');

  const balanceDue = invoice.total - (invoice.amount_paid ?? invoice.total);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Purchase ${invoice.invoice_number}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
<div class="page">

  ${getHeader(shop, logoBase64, invoice.invoice_number, invoice.invoice_date, 'PURCHASE', invoice.payment_status)}

  <div class="party-card" style="background:#F0FDF420;">
    <div class="party-label" style="color:${color};">Vendor</div>
    <div class="party-name">${invoice.vendor_name || '—'}</div>
    ${invoice.vendor_phone ? `<div class="party-phone">📞 ${invoice.vendor_phone}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr style="background:${color};">
        <th class="ctr" style="width:32px;">#</th>
        <th style="text-align:left;">Item</th>
        <th class="ctr">Qty</th>
        <th class="ctr">Unit</th>
        <th style="text-align:right;">Cost (${sym})</th>
        <th style="text-align:right;">Amount (${sym})</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals-box">
      <div class="totals-row">
        <span class="totals-label">Subtotal</span>
        <span class="totals-value">${fmt(invoice.subtotal, shop.currency)}</span>
      </div>
      <div class="totals-row">
        <span class="totals-label">Tax</span>
        <span class="totals-value">${fmt(invoice.tax_amount, shop.currency)}</span>
      </div>
      <div class="total-grand" style="background:${color};">
        <span>TOTAL</span>
        <span>${fmt(invoice.total, shop.currency)}</span>
      </div>
      <div class="totals-row">
        <span class="totals-label">Amount Paid</span>
        <span style="color:#059669;font-weight:600;">${fmt(invoice.amount_paid ?? invoice.total, shop.currency)}</span>
      </div>
      <div class="totals-row">
        <span class="totals-label" style="font-weight:700;">Balance Due</span>
        <span class="${balanceDue > 0 ? 'balance-due' : 'balance-ok'}">${fmt(balanceDue, shop.currency)}</span>
      </div>
    </div>
  </div>

  ${invoice.notes ? `
  <div class="notes-box" style="border-color:${color};">
    <strong>Notes</strong>${invoice.notes}
  </div>` : ''}

  ${getFooter(shop)}

</div>
</body>
</html>`;
}
