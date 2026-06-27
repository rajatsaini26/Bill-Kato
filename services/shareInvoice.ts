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
