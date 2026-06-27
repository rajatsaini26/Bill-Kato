import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, FontSize } from '../../../constants/theme';
import { getPurchaseInvoiceById, deletePurchaseInvoice, PurchaseInvoiceWithItems } from '../../../db/queries/purchases';
import { toDisplayDate } from '../../../utils/dateFormat';
import { buildPurchaseInvoiceHTML } from '../../../services/pdfTemplate';
import { generateAndSharePurchasePDF } from '../../../services/shareInvoice';
import { db } from '../../../db/client';

export default function PurchaseInvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<PurchaseInvoiceWithItems | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    try {
      setInvoice(getPurchaseInvoiceById(Number(id)));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }, [id]);

  if (!invoice) return (
    <View style={styles.center}><ActivityIndicator color={Colors.success} size="large" /></View>
  );

  const getShop = () =>
    db.getFirstSync<any>(`SELECT * FROM shop_profile WHERE id = 1`) ?? {
      id: 1, name: 'My Shop', address: '', phone: '', gstin: '', currency: 'INR',
    };

  const handleShare = async () => {
    setSharing(true);
    try {
      const shop = getShop();
      const html = buildPurchaseInvoiceHTML(invoice, shop);
      await generateAndSharePurchasePDF(html, invoice.id);
    } catch (e: any) {
      Alert.alert('PDF Error', e.message);
    } finally {
      setSharing(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Invoice', `Delete ${invoice.invoice_number}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          try {
            deletePurchaseInvoice(invoice.id);
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
      <View style={styles.headerCard}>
        <Text style={styles.invoiceNo}>{invoice.invoice_number}</Text>
        <Text style={styles.date}>{toDisplayDate(invoice.invoice_date)}</Text>
        <View style={styles.divider} />
        <Text style={styles.fieldLabel}>Vendor</Text>
        <Text style={styles.fieldValue}>{invoice.vendor_name || '—'}</Text>
        {invoice.vendor_phone ? <Text style={styles.fieldSub}>📞 {invoice.vendor_phone}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items</Text>
        {invoice.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.item_name}</Text>
              <Text style={styles.itemSub}>{item.quantity} {item.unit} × ₹{item.unit_cost.toFixed(2)}</Text>
            </View>
            <Text style={styles.itemTotal}>₹{item.line_total.toFixed(2)}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.totalLine}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>₹{invoice.subtotal.toFixed(2)}</Text></View>
        <View style={styles.totalLine}><Text style={styles.totalLabel}>Tax</Text><Text style={styles.totalValue}>₹{invoice.tax_amount.toFixed(2)}</Text></View>
        <View style={[styles.totalLine, styles.grandLine]}>
          <Text style={styles.grandLabel}>Total</Text>
          <Text style={[styles.grandValue, { color: Colors.success }]}>₹{invoice.total.toFixed(2)}</Text>
        </View>
      </View>

      {invoice.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notes}>{invoice.notes}</Text>
        </View>
      ) : null}

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.btnShare} onPress={handleShare} disabled={sharing}>
          {sharing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>📤 Share PDF</Text>}
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
  headerCard: { backgroundColor: Colors.success, margin: Spacing.md, borderRadius: 14, padding: Spacing.md },
  invoiceNo: { fontSize: FontSize.lg, fontWeight: '700', color: '#fff' },
  date: { fontSize: FontSize.xs, color: '#A7F3D0', marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, color: '#A7F3D0', marginTop: 4 },
  fieldValue: { fontSize: FontSize.md, fontWeight: '600', color: '#fff' },
  fieldSub: { fontSize: FontSize.xs, color: '#A7F3D0' },
  section: { backgroundColor: Colors.surface, margin: Spacing.md, borderRadius: 12, padding: Spacing.md, elevation: 1 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  itemSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  itemTotal: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.success },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  totalValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  grandLine: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4, paddingTop: 6 },
  grandLabel: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  grandValue: { fontSize: FontSize.lg, fontWeight: '800' },
  notes: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  btnRow: { flexDirection: 'row', gap: Spacing.sm, margin: Spacing.md },
  btnShare: { flex: 1, backgroundColor: Colors.success, borderRadius: 10, padding: Spacing.md, alignItems: 'center' },
  btnDelete: { flex: 1, backgroundColor: Colors.danger, borderRadius: 10, padding: Spacing.md, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
});
