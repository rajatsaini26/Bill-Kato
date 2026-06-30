import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import { getSaleInvoiceById, deleteSaleInvoice, SaleInvoiceWithItems } from '../../../db/queries/sales';
import { getInvoicePnL, InvoicePnL } from '../../../db/queries/reports';
import { toDisplayDate } from '../../../utils/dateFormat';
import { buildSaleInvoiceHTML } from '../../../services/pdfTemplate';
import { generateAndShareSalePDF } from '../../../services/shareInvoice';
import { db } from '../../../db/client';

const STATUS_META: Record<string, { color: string; bg: string }> = {
  paid: { color: Colors.success, bg: Colors.successLight },
  unpaid: { color: Colors.danger, bg: Colors.dangerLight },
  partial: { color: Colors.warning, bg: Colors.warningLight },
};

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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

  const statusMeta = STATUS_META[invoice.payment_status?.toLowerCase()] || STATUS_META.paid;
  const isReturn = invoice.invoice_type === 'return';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.invoiceNo}>{invoice.invoice_number}{isReturn ? ' (Return)' : ''}</Text>
              <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.date}>{toDisplayDate(invoice.invoice_date)}</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
              <Text style={[styles.statusText, { color: statusMeta.color }]}>
                {invoice.payment_status?.toUpperCase() || 'PAID'}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <Text style={styles.fieldLabel}>Billed To</Text>
          <Text style={styles.fieldValue}>{invoice.customer_name || 'Walk-in Customer'}</Text>
          {invoice.customer_phone ? (
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.fieldSub}>{invoice.customer_phone}</Text>
            </View>
          ) : null}
        </View>

        {/* Items */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cart-outline" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Items ({invoice.items.length})</Text>
          </View>
          
          {invoice.items.map((item, i) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.item_name}</Text>
                <Text style={styles.itemSub}>
                  {item.quantity} {item.unit} × {fmt(item.unit_price)}
                  {item.discount_pct > 0 ? `  •  Disc: ${item.discount_pct}%` : ''}
                </Text>
              </View>
              <Text style={styles.itemTotal}>{fmt(item.line_total)}</Text>
            </View>
          ))}
          
          <View style={styles.totalsContainer}>
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{fmt(invoice.subtotal)}</Text>
            </View>
            {invoice.discount_amount > 0 && (
              <View style={styles.totalLine}>
                <Text style={styles.totalLabel}>Discount</Text>
                <Text style={[styles.totalValue, { color: Colors.danger }]}>- {fmt(invoice.discount_amount)}</Text>
              </View>
            )}
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Tax</Text>
              <Text style={styles.totalValue}>{fmt(invoice.tax_amount)}</Text>
            </View>
            <View style={[styles.totalLine, styles.grandLine]}>
              <Text style={styles.grandLabel}>Total Amount</Text>
              <Text style={styles.grandValue}>{fmt(invoice.total)}</Text>
            </View>
          </View>

          {invoice.payment_status !== 'Paid' && (
            <View style={styles.balanceContainer}>
              <View style={styles.totalLine}>
                <Text style={styles.totalLabel}>Amount Paid</Text>
                <Text style={[styles.totalValue, { color: Colors.success }]}>{fmt(invoice.amount_paid)}</Text>
              </View>
              <View style={styles.totalLine}>
                <Text style={styles.totalLabel}>Balance Due</Text>
                <Text style={[styles.totalValue, { color: Colors.danger }]}>{fmt(invoice.total - invoice.amount_paid)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* P&L Panel */}
        {pnl && (
          <View style={styles.pnlCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bar-chart-outline" size={18} color={Colors.primary} />
              <Text style={[styles.sectionTitle, { color: Colors.primary }]}>P&L Analysis</Text>
            </View>
            <View style={styles.pnlRow}>
              <Text style={styles.pnlLabel}>Revenue</Text>
              <Text style={styles.pnlValue}>{fmt(pnl.revenue)}</Text>
            </View>
            <View style={styles.pnlRow}>
              <Text style={styles.pnlLabel}>Cost of Goods</Text>
              <Text style={[styles.pnlValue, { color: Colors.danger }]}>{fmt(pnl.cogs)}</Text>
            </View>
            <View style={[styles.pnlRow, styles.pnlGrossRow]}>
              <Text style={styles.pnlGrossLabel}>Gross Profit</Text>
              <Text style={[styles.pnlGrossValue, { color: pnl.profit >= 0 ? Colors.success : Colors.danger }]}>
                {pnl.profit < 0 ? '- ' : ''}{fmt(pnl.profit)}
              </Text>
            </View>
            <View style={styles.pnlRow}>
              <Text style={styles.pnlLabel}>Margin</Text>
              <View style={[styles.marginBadge, { backgroundColor: pnl.marginPct >= 0 ? Colors.successLight : Colors.dangerLight }]}>
                <Text style={[styles.marginBadgeText, { color: pnl.marginPct >= 0 ? Colors.success : Colors.danger }]}>
                  {pnl.marginPct.toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>
        )}

        {invoice.notes ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.sectionTitle}>Notes</Text>
            </View>
            <Text style={styles.notes}>{invoice.notes}</Text>
          </View>
        ) : null}
        
      </ScrollView>

      {/* Floating Action Bar */}
      <View style={styles.fabBar}>
        <TouchableOpacity style={styles.btnAction} onPress={handleDelete} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={20} color={Colors.danger} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnAction} onPress={handleEdit} activeOpacity={0.7}>
          <Ionicons name="pencil-outline" size={20} color={Colors.warning} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnPrimary} onPress={handleShare} disabled={sharing} activeOpacity={0.8}>
          {sharing ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="share-social-outline" size={18} color="#fff" />
              <Text style={styles.btnPrimaryText}>Share PDF</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  headerCard: { backgroundColor: Colors.primary, margin: Spacing.md, borderRadius: Radius.lg, padding: Spacing.lg, ...Shadow.md },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  invoiceNo: { fontFamily: FontFamily.extraBold, fontSize: FontSize.xl, color: '#fff' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  date: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.8)' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill },
  statusText: { fontFamily: FontFamily.bold, fontSize: 11, letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: Spacing.md },
  fieldLabel: { fontFamily: FontFamily.semiBold, fontSize: 10, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  fieldValue: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#fff' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  fieldSub: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.9)' },
  
  section: { backgroundColor: Colors.surface, marginHorizontal: Spacing.md, marginBottom: Spacing.md, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
  sectionTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.textPrimary },
  
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemInfo: { flex: 1, paddingRight: Spacing.md },
  itemName: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  itemSub: { fontFamily: FontFamily.medium, fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  itemTotal: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textPrimary },
  
  totalsContainer: { paddingTop: Spacing.sm },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  totalValue: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textPrimary },
  grandLine: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 8, paddingTop: 10 },
  grandLabel: { fontFamily: FontFamily.extraBold, fontSize: FontSize.md, color: Colors.textPrimary },
  grandValue: { fontFamily: FontFamily.extraBold, fontSize: FontSize.lg, color: Colors.primary },
  
  balanceContainer: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, borderStyle: 'dashed' },
  
  pnlCard: { backgroundColor: Colors.primaryLight, marginHorizontal: Spacing.md, marginBottom: Spacing.md, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.primary + '30' },
  pnlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  pnlLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  pnlValue: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textPrimary },
  pnlGrossRow: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 6, paddingTop: 8 },
  pnlGrossLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.primary },
  pnlGrossValue: { fontFamily: FontFamily.extraBold, fontSize: FontSize.md },
  marginBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill },
  marginBadgeText: { fontFamily: FontFamily.bold, fontSize: 11 },
  
  notes: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 22 },
  
  fabBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: Colors.surface, padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, ...Shadow.lg, gap: Spacing.sm },
  btnAction: { width: 50, height: 50, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  btnPrimary: { flex: 1, flexDirection: 'row', gap: 8, height: 50, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },
});
