import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { updateSaleInvoicePdfUri } from '../db/queries/sales';
import { updatePurchaseInvoicePdfUri } from '../db/queries/purchases';

export async function generateAndShareSalePDF(
  html: string,
  invoiceId: number
): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (!uri) throw new Error('PDF generation failed. Try again.');
  updateSaleInvoicePdfUri(invoiceId, uri);
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share Invoice',
    UTI: 'com.adobe.pdf',
  });
}

export async function generateAndSharePurchasePDF(
  html: string,
  invoiceId: number
): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (!uri) throw new Error('PDF generation failed. Try again.');
  updatePurchaseInvoicePdfUri(invoiceId, uri);
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share Purchase Record',
    UTI: 'com.adobe.pdf',
  });
}

export async function generateAndShareBulkPDF(
  htmls: string[],
  prefix: string
): Promise<void> {
  const combinedHtml = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;margin:0;padding:0;">
        ${htmls.map((html, index) => {
          // Extract content inside body tag
          const bodyContentMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
          const content = bodyContentMatch ? bodyContentMatch[1] : html;
          
          return `
          <div style="padding:32px;">${content}</div>
          ${index < htmls.length - 1 ? '<div style="page-break-before: always;"></div>' : ''}
          `;
        }).join('')}
      </body>
    </html>
  `;
  const { uri } = await Print.printToFileAsync({ html: combinedHtml, base64: false });
  if (!uri) throw new Error('Bulk PDF generation failed.');
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Share ${prefix}s`,
    UTI: 'com.adobe.pdf',
  });
}
