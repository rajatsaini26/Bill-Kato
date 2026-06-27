import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors, Spacing, FontSize } from '../../constants/theme';
import { getMonthlyPnL, getQuarterlyPnL, MonthlyPnL, QuarterlyPnL } from '../../db/queries/reports';

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function ProfitCell({ value }: { value: number }) {
  return (
    <Text style={[styles.tableCell, { color: value >= 0 ? Colors.success : Colors.danger, fontWeight: '700' }]}>
      {value < 0 ? '- ' : ''}{fmt(value)}
    </Text>
  );
}

export default function ReportsScreen() {
  const [tab, setTab] = useState<'monthly' | 'quarterly'>('monthly');
  const [monthly, setMonthly] = useState<MonthlyPnL[]>([]);
  const [quarterly, setQuarterly] = useState<QuarterlyPnL[]>([]);

  useFocusEffect(
    useCallback(() => {
      try {
        setMonthly(getMonthlyPnL());
        setQuarterly(getQuarterlyPnL());
      } catch (e: any) {
        Alert.alert('Error', e.message);
      }
    }, [])
  );

  const totalRevenue = monthly.reduce((s, r) => s + r.revenue, 0);
  const totalPurchases = monthly.reduce((s, r) => s + r.purchases, 0);
  const totalProfit = totalRevenue - totalPurchases;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Toggle */}
      <View style={styles.toggleRow}>
        {(['monthly', 'quarterly'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[styles.toggleBtn, tab === t && styles.toggleActive]}
          >
            <Text style={[styles.toggleText, tab === t && { color: '#fff' }]}>
              {t === 'monthly' ? 'Monthly' : 'Quarterly'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeadCell, { flex: 2 }]}>
          {tab === 'monthly' ? 'Month' : 'Period'}
        </Text>
        <Text style={styles.tableHeadCell}>Sales</Text>
        <Text style={styles.tableHeadCell}>Purchases</Text>
        <Text style={styles.tableHeadCell}>Profit</Text>
      </View>

      {tab === 'monthly' && (
        monthly.length === 0 ? (
          <Text style={styles.empty}>No data yet</Text>
        ) : (
          monthly.map((row, i) => (
            <View key={row.month} style={[styles.tableRow, i % 2 === 1 && { backgroundColor: '#F3F4F6' }]}>
              <Text style={[styles.tableCell, { flex: 2 }]}>{row.month}</Text>
              <Text style={styles.tableCell}>{fmt(row.revenue)}</Text>
              <Text style={styles.tableCell}>{fmt(row.purchases)}</Text>
              <ProfitCell value={row.net_profit} />
            </View>
          ))
        )
      )}

      {tab === 'quarterly' && (
        quarterly.length === 0 ? (
          <Text style={styles.empty}>No data yet</Text>
        ) : (
          quarterly.map((row, i) => (
            <View key={`${row.year}-${row.quarter}`} style={[styles.tableRow, i % 2 === 1 && { backgroundColor: '#F3F4F6' }]}>
              <Text style={[styles.tableCell, { flex: 2 }]}>{row.year} {row.quarter}</Text>
              <Text style={styles.tableCell}>{fmt(row.revenue)}</Text>
              <Text style={styles.tableCell}>{fmt(row.purchases)}</Text>
              <ProfitCell value={row.net_profit} />
            </View>
          ))
        )
      )}

      {/* Overall Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Overall Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Revenue</Text>
          <Text style={styles.summaryValue}>{fmt(totalRevenue)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Purchases</Text>
          <Text style={styles.summaryValue}>{fmt(totalPurchases)}</Text>
        </View>
        <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 8, paddingTop: 8 }]}>
          <Text style={[styles.summaryLabel, { fontWeight: '700' }]}>Net Profit</Text>
          <Text style={[styles.summaryValue, {
            fontSize: FontSize.xl, fontWeight: '800',
            color: totalProfit >= 0 ? Colors.success : Colors.danger,
          }]}>
            {totalProfit < 0 ? '- ' : ''}{fmt(totalProfit)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  toggleRow: { flexDirection: 'row', backgroundColor: Colors.border, borderRadius: 10, padding: 4, marginBottom: Spacing.md },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  toggleActive: { backgroundColor: Colors.primary },
  toggleText: { fontWeight: '600', fontSize: FontSize.sm, color: Colors.textSecondary },
  tableHeader: {
    flexDirection: 'row', backgroundColor: Colors.primary, borderRadius: 8,
    padding: Spacing.sm, marginBottom: 2,
  },
  tableHeadCell: { flex: 1, color: '#fff', fontSize: FontSize.xs, fontWeight: '700', textAlign: 'right' },
  tableRow: {
    flexDirection: 'row', backgroundColor: Colors.surface, padding: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tableCell: { flex: 1, fontSize: FontSize.xs, color: Colors.textPrimary, textAlign: 'right' },
  empty: { textAlign: 'center', color: Colors.textMuted, marginTop: 40, fontSize: FontSize.md },
  summaryCard: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md,
    marginTop: Spacing.lg, elevation: 3,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  summaryTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  summaryValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
});
