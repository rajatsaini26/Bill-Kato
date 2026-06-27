import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors, Spacing, FontSize } from '../../constants/theme';
import { getDashboardStats } from '../../db/queries/reports';
import { getRecentSaleInvoices, SaleInvoice } from '../../db/queries/sales';
import { getRecentPurchaseInvoices, PurchaseInvoice } from '../../db/queries/purchases';
import { toShortDate } from '../../utils/dateFormat';

interface DashboardStats {
  todaySales: number;
  todayPurchases: number;
  monthSales: number;
  monthPurchases: number;
  monthProfit: number;
}

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0, todayPurchases: 0, monthSales: 0, monthPurchases: 0, monthProfit: 0,
  });
  const [recentSales, setRecentSales] = useState<SaleInvoice[]>([]);
  const [recentPurchases, setRecentPurchases] = useState<PurchaseInvoice[]>([]);

  useFocusEffect(
    useCallback(() => {
      try {
        setStats(getDashboardStats());
        setRecentSales(getRecentSaleInvoices(5));
        setRecentPurchases(getRecentPurchaseInvoices(5));
      } catch (e: any) {
        Alert.alert('Error', e.message);
      }
    }, [])
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Stats Grid */}
      <View style={styles.gridRow}>
        {[
          { value: fmt(stats.todaySales), sub: "Today's Sales", color: Colors.primary },
          { value: fmt(stats.todayPurchases), sub: "Today's Purchases", color: Colors.warning },
        ].map((card, i) => (
          <View key={i} style={[styles.statCard, { borderTopColor: card.color }]}>
            <Text style={[styles.statValue, { color: card.color }]}>{card.value}</Text>
            <Text style={styles.statLabel}>{card.sub}</Text>
          </View>
        ))}
      </View>
      <View style={styles.gridRow}>
        {[
          { value: fmt(stats.monthSales), sub: 'Month Sales', color: Colors.primary },
          {
            value: fmt(stats.monthProfit),
            sub: 'Month Profit',
            color: stats.monthProfit >= 0 ? Colors.success : Colors.danger,
          },
        ].map((card, i) => (
          <View key={i} style={[styles.statCard, { borderTopColor: card.color }]}>
            <Text style={[styles.statValue, { color: card.color }]}>{card.value}</Text>
            <Text style={styles.statLabel}>{card.sub}</Text>
          </View>
        ))}
      </View>

      {/* Recent Lists */}
      <View style={styles.listsRow}>
        {/* Recent Sales */}
        <View style={styles.listColumn}>
          <Text style={styles.sectionTitle}>Recent Sales</Text>
          {recentSales.length === 0 ? (
            <Text style={styles.emptyText}>No sales yet</Text>
          ) : (
            recentSales.map((inv) => (
              <TouchableOpacity
                key={inv.id}
                style={styles.miniCard}
                onPress={() => router.push(`/invoice/sale/${inv.id}`)}
              >
                <Text style={styles.miniInvNo}>{inv.invoice_number}</Text>
                <Text style={styles.miniParty} numberOfLines={1}>{inv.customer_name || '—'}</Text>
                <Text style={styles.miniAmount}>₹{inv.total.toFixed(2)}</Text>
                <Text style={styles.miniDate}>{toShortDate(inv.invoice_date)}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Recent Purchases */}
        <View style={styles.listColumn}>
          <Text style={styles.sectionTitle}>Recent Purchases</Text>
          {recentPurchases.length === 0 ? (
            <Text style={styles.emptyText}>No purchases yet</Text>
          ) : (
            recentPurchases.map((inv) => (
              <TouchableOpacity
                key={inv.id}
                style={[styles.miniCard, { borderLeftColor: Colors.success }]}
                onPress={() => router.push(`/invoice/purchase/${inv.id}`)}
              >
                <Text style={styles.miniInvNo}>{inv.invoice_number}</Text>
                <Text style={styles.miniParty} numberOfLines={1}>{inv.vendor_name || '—'}</Text>
                <Text style={[styles.miniAmount, { color: Colors.success }]}>₹{inv.total.toFixed(2)}</Text>
                <Text style={styles.miniDate}>{toShortDate(inv.invoice_date)}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* FAB Buttons */}
      <View style={styles.fabRow}>
        <TouchableOpacity
          style={styles.fabPrimary}
          onPress={() => router.push('/invoice/sale/create')}
        >
          <Text style={styles.fabText}>＋ Sale</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fabOutlined}
          onPress={() => router.push('/invoice/purchase/create')}
        >
          <Text style={[styles.fabText, { color: Colors.success }]}>＋ Purchase</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  gridRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    borderTopWidth: 3,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  statValue: { fontSize: FontSize.lg, fontWeight: '700' },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },
  listsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  listColumn: { flex: 1 },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  miniCard: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    elevation: 1,
  },
  miniInvNo: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  miniParty: { fontSize: 11, color: Colors.textPrimary, marginTop: 1 },
  miniAmount: { fontSize: 12, fontWeight: '700', color: Colors.primary, marginTop: 2 },
  miniDate: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.md },
  fabRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  fabPrimary: {
    flex: 1, backgroundColor: Colors.primary, borderRadius: 10,
    padding: Spacing.md, alignItems: 'center', elevation: 3,
  },
  fabOutlined: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 10,
    padding: Spacing.md, alignItems: 'center', borderWidth: 2,
    borderColor: Colors.success, elevation: 2,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
});
