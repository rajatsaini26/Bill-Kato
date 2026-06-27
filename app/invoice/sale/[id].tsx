import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, FontSize } from '../../../constants/theme';
import { getSaleInvoiceById, deleteSaleInvoice, SaleInvoiceWithItems } from '../../../db/queries/sales';
import { getInvoicePnL, InvoicePnL } from '../../../db/queries/reports';
import { toDisplayDate, toShortDate } from '../../../utils/dateFormat';
import { buildSaleInvoiceHTML } from '../../../services/pdfTemplate';
import { generateAndShareSalePDF } from '../../../services/shareInvoice';
import { db } from '../../../db/client';

const STATUS_COLOR: Record<string, string> = {
  paid: Colors.success,
  unpaid: Colors.danger,
  partial: Colors.warning,
};

export default function SaleInvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<SaleInvoiceWithItems | null>(null);
  const [pnl, setPnl] = useState<InvoicePnL | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    try {
      const inv = getSaleInvoiceById(Number(id));
      setInvoice(inv);
      if (inv) setPnl(getInvoicePnL(inv.id));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }, [id]);

  if (!invoice) return (
    <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
  );

  const getShop = () =>
    db.getFirstSync<any>(`SELECT * FROM shop_profile WHERE id = 1`) ?? {
      id: 1, name: 'My Shop', address: '', phone: '', gstin: '', currency: 'INR',
    };

  const handleShare = async () => {
    setSharing(true);
    try {
      const shop = getShop();
      const html = await buildSaleInvoiceHTML(invoice, shop);
      await generateAndShareSalePDF(html, invoice.id);
    } catch (e: any) {
      Alert.alert('PDF Error', e.message);
    } finally {
      setSharing(false);
    }
  };

  const handleEdit = () => {
    router.push(`/invoice/sale/create?editId=${invoice.id}`);
  };

  const handleDelete = () => {
    Alert.alert('Delete Invoice', `Delete ${invoice.invoice_number}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          try {
            deleteSaleInvoice(invoice.id);
            router.back();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.invoiceNo}>{invoice.invoice_number}</Text>
            <Text style={styles.date}>{toDisplayDate(invoice.invoice_date)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[invoice.payment_status?.toLowerCase()] || STATUS_COLOR.paid + '22' }]}>
            <Text style={[styles.statusText, { color: STATUS_COLOR[invoice.payment_status?.toLowerCase()] || STATUS_COLOR.paid }]}>
              {invoice.payment_status?.toUpperCase() || 'PAID'}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <Text style={styles.fieldLabel}>Customer</Text>
        <Text style={styles.fieldValue}>{invoice.customer_name || '—'}</Text>
        {invoice.customer_phone ? <Text style={styles.fieldSub}>📞 {invoice.customer_phone}</Text> : null}
      </View>

      {/* Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items</Text>
        {invoice.items.map((item, i) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.item_name}</Text>
              <Text style={styles.itemSub}>{item.quantity} {item.unit} × ₹{item.unit_price.toFixed(2)}{item.discount_pct > 0 ? ` (${item.discount_pct}% off)` : ''}</Text>
            </View>
            <Text style={styles.itemTotal}>₹{item.line_total.toFixed(2)}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.totalLine}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>₹{invoice.subtotal.toFixed(2)}</Text></View>
        <View style={styles.totalLine}><Text style={styles.totalLabel}>Discount</Text><Text style={[styles.totalValue, { color: Colors.danger }]}>- ₹{invoice.discount_amount.toFixed(2)}</Text></View>
        <View style={styles.totalLine}><Text style={styles.totalLabel}>Tax</Text><Text style={styles.totalValue}>₹{invoice.tax_amount.toFixed(2)}</Text></View>
        <View style={[styles.totalLine, styles.grandLine]}>
          <Text style={styles.grandLabel}>Total</Text>
          <Text style={styles.grandValue}>₹{invoice.total.toFixed(2)}</Text>
        </View>
        {invoice.payment_status !== 'Paid' && (
          <>
            <View style={[styles.totalLine, { marginTop: 4 }]}><Text style={styles.totalLabel}>Amount Paid</Text><Text style={[styles.totalValue, { color: Colors.success }]}>₹{invoice.amount_paid.toFixed(2)}</Text></View>
            <View style={styles.totalLine}><Text style={styles.totalLabel}>Balance Due</Text><Text style={[styles.totalValue, { color: Colors.danger }]}>₹{(invoice.total - invoice.amount_paid).toFixed(2)}</Text></View>
          </>
        )}
      </View>

      {/* P&L Panel */}
      {pnl && (
        <View style={styles.pnlCard}>
          <Text style={styles.sectionTitle}>P&L Analysis</Text>
          <View style={styles.pnlRow}><Text style={styles.pnlLabel}>Revenue</Text><Text style={styles.pnlValue}>₹{pnl.revenue.toFixed(2)}</Text></View>
          <View style={styles.pnlRow}><Text style={styles.pnlLabel}>Cost of Goods</Text><Text style={[styles.pnlValue, { color: Colors.danger }]}>₹{pnl.cogs.toFixed(2)}</Text></View>
          <View style={[styles.pnlRow, { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 6, paddingTop: 6 }]}>
            <Text style={[styles.pnlLabel, { fontWeight: '700' }]}>Gross Profit</Text>
            <Text style={[styles.pnlValue, { fontWeight: '800', color: pnl.profit >= 0 ? Colors.success : Colors.danger }]}>
              {pnl.profit < 0 ? '- ' : ''}₹{Math.abs(pnl.profit).toFixed(2)}
            </Text>
          </View>
          <View style={styles.pnlRow}>
            <Text style={styles.pnlLabel}>Margin</Text>
            <Text style={[styles.pnlValue, { color: pnl.marginPct >= 0 ? Colors.success : Colors.danger }]}>
              {pnl.marginPct.toFixed(1)}%
            </Text>
          </View>
        </View>
      )}

      {invoice.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notes}>{invoice.notes}</Text>
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.btnShare} onPress={handleShare} disabled={sharing}>
          {sharing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>📤 PDF</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btnShare, { backgroundColor: Colors.warning }]} onPress={handleEdit}>
          <Text style={styles.btnText}>✏️ Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnDelete} onPress={handleDelete}>
          <Text style={styles.btnText}>🗑 Delete</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerCard: { backgroundColor: Colors.primary, margin: Spacing.md, borderRadius: 14, padding: Spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  invoiceNo: { fontSize: FontSize.lg, fontWeight: '700', color: '#fff' },
  date: { fontSize: FontSize.xs, color: '#93C5FD', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, color: '#93C5FD', marginTop: 4 },
  fieldValue: { fontSize: FontSize.md, fontWeight: '600', color: '#fff' },
  fieldSub: { fontSize: FontSize.xs, color: '#93C5FD' },
  section: { backgroundColor: Colors.surface, margin: Spacing.md, borderRadius: 12, padding: Spacing.md, elevation: 1 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  itemSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  itemTotal: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  totalValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  grandLine: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4, paddingTop: 6 },
  grandLabel: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  grandValue: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.primary },
  pnlCard: { backgroundColor: '#EBF3FF', margin: Spacing.md, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.primaryLight },
  pnlRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  pnlLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  pnlValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  notes: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  btnRow: { flexDirection: 'row', gap: Spacing.sm, margin: Spacing.md },
  btnShare: { flex: 1, backgroundColor: Colors.primary, borderRadius: 10, padding: Spacing.md, alignItems: 'center' },
  btnDelete: { flex: 1, backgroundColor: Colors.danger, borderRadius: 10, padding: Spacing.md, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
});
