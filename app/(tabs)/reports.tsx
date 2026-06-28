import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors, Spacing, FontSize } from '../../constants/theme';
import { getMonthlyPnL, getQuarterlyPnL, MonthlyPnL, QuarterlyPnL } from '../../db/queries/reports';
import DateTimePicker from '@react-native-community/datetimepicker';
import { toShortDate, toStorableDate } from '../../utils/dateFormat';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { db } from '../../db/client';

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
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [showPickerFor, setShowPickerFor] = useState<'start' | 'end' | null>(null);

  useFocusEffect(
    useCallback(() => {
      try {
        setMonthly(getMonthlyPnL(startDate, endDate));
        setQuarterly(getQuarterlyPnL(startDate, endDate));
      } catch (e: any) {
        Alert.alert('Error', e.message);
      }
    }, [startDate, endDate])
  );

  const getShop = () => db.getFirstSync<any>(`SELECT * FROM shop_profile WHERE id = 1`) ?? { name: 'My Shop', currency: 'INR' };

  const exportCSV = async () => {
    try {
      let csv = "Period,Revenue,Purchases,Profit\n";
      const data = tab === 'monthly' ? monthly : quarterly;
      data.forEach(row => {
        const period = 'month' in row ? row.month : `${row.year} ${row.quarter}`;
        csv += `${period},${row.revenue},${row.purchases},${row.net_profit}\n`;
      });
      const path = FileSystem.documentDirectory + 'Report.csv';
      await FileSystem.writeAsStringAsync(path, csv);
      await Sharing.shareAsync(path, { mimeType: 'text/csv' });
    } catch (e: any) {
      Alert.alert('Export Error', e.message);
    }
  };

  const exportPDF = async () => {
    try {
      const shop = getShop();
      const data = tab === 'monthly' ? monthly : quarterly;
      let rows = '';
      data.forEach(r => {
        const period = 'month' in r ? r.month : `${r.year} ${r.quarter}`;
        rows += `<tr><td>${period}</td><td>${r.revenue.toFixed(2)}</td><td>${r.purchases.toFixed(2)}</td><td>${r.net_profit.toFixed(2)}</td></tr>`;
      });
      const html = `
        <html><head><style>table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:8px;text-align:left;}</style></head>
        <body style="font-family:sans-serif;"><h2>${shop.name} - ${tab === 'monthly' ? 'Monthly' : 'Quarterly'} P&L Report</h2>
        <table><tr><th>Period</th><th>Revenue</th><th>Purchases</th><th>Profit</th></tr>${rows}</table></body></html>
      `;
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Report' });
    } catch (e: any) {
      Alert.alert('Export Error', e.message);
    }
  };

  const totalRevenue = monthly.reduce((s, r) => s + r.revenue, 0);
  const totalPurchases = monthly.reduce((s, r) => s + r.purchases, 0);
  const totalProfit = totalRevenue - totalPurchases;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Filters & Export */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={() => setShowPickerFor('start')} style={[styles.filterChip, startDate ? { backgroundColor: Colors.primary } : {}]}>
            <Text style={[styles.filterChipText, startDate ? { color: '#fff' } : {}]}>
              {startDate ? `Start: ${toShortDate(startDate)}` : 'Start Date'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowPickerFor('end')} style={[styles.filterChip, endDate ? { backgroundColor: Colors.primary } : {}]}>
            <Text style={[styles.filterChipText, endDate ? { color: '#fff' } : {}]}>
              {endDate ? `End: ${toShortDate(endDate)}` : 'End Date'}
            </Text>
          </TouchableOpacity>
          {(startDate || endDate) && (
            <TouchableOpacity onPress={() => { setStartDate(null); setEndDate(null); }} style={styles.filterChip}>
              <Text style={styles.filterChipText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={exportCSV} style={styles.exportBtn}>
            <Text style={styles.exportBtnText}>CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={exportPDF} style={styles.exportBtn}>
            <Text style={styles.exportBtnText}>PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showPickerFor && (
        <DateTimePicker
          value={showPickerFor === 'start' ? (startDate ? new Date(startDate) : new Date()) : (endDate ? new Date(endDate) : new Date())}
          mode="date"
          display="default"
          onValueChange={(event, date) => {
            const pickerMode = showPickerFor;
            setShowPickerFor(null);
            if (date) {
              const formatted = toStorableDate(date).split('T')[0];
              if (pickerMode === 'start') setStartDate(formatted);
              else setEndDate(formatted);
            }
          }}
          onDismiss={() => setShowPickerFor(null)}
        />
      )}

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
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: Colors.border, justifyContent: 'center'
  },
  filterChipText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  exportBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    backgroundColor: Colors.primary, justifyContent: 'center'
  },
  exportBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: '#fff' },
});
