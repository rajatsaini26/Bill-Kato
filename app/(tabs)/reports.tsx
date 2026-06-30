import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import { getMonthlyPnL, getQuarterlyPnL, MonthlyPnL, QuarterlyPnL } from '../../db/queries/reports';
import DateTimePicker from '@react-native-community/datetimepicker';
import { toShortDate, toStorableDate } from '../../utils/dateFormat';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { db } from '../../db/client';

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ProfitCell({ value }: { value: number }) {
  return (
    <Text style={[styles.tableCell, { color: value >= 0 ? Colors.success : Colors.danger, fontFamily: FontFamily.bold }]}>
      {value < 0 ? '- ' : ''}{fmt(value)}
    </Text>
  );
}

function MarginCell({ revenue, profit }: { revenue: number, profit: number }) {
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  return (
    <View style={styles.marginCell}>
      <Text style={[styles.marginText, { color: margin >= 0 ? Colors.success : Colors.danger }]}>
        {margin.toFixed(1)}%
      </Text>
    </View>
  );
}

function BarChart({ data, maxValue }: { data: { label: string; value: number }[]; maxValue: number }) {
  if (data.length === 0 || maxValue === 0) return null;
  return (
    <View style={styles.chartContainer}>
      {data.map((d, i) => {
        const widthPct = Math.max(0, Math.min(100, (d.value / maxValue) * 100));
        return (
          <View key={i} style={styles.chartRow}>
            <Text style={styles.chartLabel} numberOfLines={1}>{d.label}</Text>
            <View style={styles.chartBarBg}>
              <View style={[styles.chartBarFill, { width: `${widthPct}%` as any }]} />
            </View>
            <Text style={styles.chartValue}>{fmt(d.value)}</Text>
          </View>
        );
      })}
    </View>
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

  const currentData = tab === 'monthly' ? monthly : quarterly;
  const totalRevenue = currentData.reduce((s, r) => s + r.revenue, 0);
  const totalPurchases = currentData.reduce((s, r) => s + r.purchases, 0);
  const totalProfit = totalRevenue - totalPurchases;
  
  // Prepare chart data (top 6 periods by revenue to keep it clean)
  const chartData = currentData.slice(0, 6).map(r => ({
    label: 'month' in r ? r.month : `${r.year} ${r.quarter}`,
    value: r.revenue
  })).reverse(); // Oldest first for chart
  
  const maxChartValue = Math.max(...chartData.map(d => d.value), 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      
      {/* Date Filters */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity onPress={() => setShowPickerFor('start')} style={[styles.chip, startDate && styles.chipActive]}>
            <Ionicons name="calendar-outline" size={14} color={startDate ? '#fff' : Colors.textSecondary} />
            <Text style={[styles.chipText, startDate && styles.chipTextActive]}>
              {startDate ? toShortDate(startDate) : 'Start Date'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowPickerFor('end')} style={[styles.chip, endDate && styles.chipActive]}>
            <Ionicons name="calendar-outline" size={14} color={endDate ? '#fff' : Colors.textSecondary} />
            <Text style={[styles.chipText, endDate && styles.chipTextActive]}>
              {endDate ? toShortDate(endDate) : 'End Date'}
            </Text>
          </TouchableOpacity>
          {(startDate || endDate) && (
            <TouchableOpacity onPress={() => { setStartDate(null); setEndDate(null); }} style={styles.clearChip}>
              <Ionicons name="close-outline" size={16} color={Colors.danger} />
              <Text style={styles.clearChipText}>Clear</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {showPickerFor && (
        <DateTimePicker
          value={showPickerFor === 'start' ? (startDate ? new Date(startDate) : new Date()) : (endDate ? new Date(endDate) : new Date())}
          mode="date" display="default"
          onValueChange={(event, date) => {
            const m = showPickerFor; setShowPickerFor(null);
            if (date) {
              const f = toStorableDate(date).split('T')[0];
              m === 'start' ? setStartDate(f) : setEndDate(f);
            }
          }}
          onDismiss={() => setShowPickerFor(null)}
        />
      )}

      {/* Overview Cards */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderTopColor: Colors.primary }]}>
            <Text style={styles.summaryLabel}>Total Revenue</Text>
            <Text style={[styles.summaryValue, { color: Colors.primary }]}>{fmt(totalRevenue)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderTopColor: Colors.warning }]}>
            <Text style={styles.summaryLabel}>Total Cost</Text>
            <Text style={[styles.summaryValue, { color: Colors.warning }]}>{fmt(totalPurchases)}</Text>
          </View>
        </View>
        <View style={[styles.summaryCard, styles.fullWidthCard, { borderTopColor: totalProfit >= 0 ? Colors.success : Colors.danger }]}>
          <View>
            <Text style={styles.summaryLabel}>Net Profit</Text>
            <Text style={[styles.summaryValue, { fontSize: FontSize.xxl, color: totalProfit >= 0 ? Colors.success : Colors.danger }]}>
              {totalProfit < 0 ? '- ' : ''}{fmt(totalProfit)}
            </Text>
          </View>
          <View style={styles.marginBadge}>
             <Text style={styles.marginBadgeText}>
               Margin: {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0'}%
             </Text>
          </View>
        </View>
      </View>

      {/* Actions & Toggles */}
      <View style={styles.controlsRow}>
        <View style={styles.toggleGroup}>
          {(['monthly', 'quarterly'] as const).map((t) => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.toggleBtn, tab === t && styles.toggleActive]}>
              <Text style={[styles.toggleText, tab === t && styles.toggleTextActive]}>
                {t === 'monthly' ? 'Monthly' : 'Quarterly'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.exportGroup}>
          <TouchableOpacity onPress={exportCSV} style={styles.exportBtn}>
            <Ionicons name="document-text-outline" size={14} color={Colors.textPrimary} />
            <Text style={styles.exportBtnText}>CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={exportPDF} style={styles.exportBtn}>
            <Ionicons name="print-outline" size={14} color={Colors.textPrimary} />
            <Text style={styles.exportBtnText}>PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chart Section */}
      {chartData.length > 0 && (
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>Revenue Trend</Text>
          <BarChart data={chartData} maxValue={maxChartValue} />
        </View>
      )}

      {/* Data Table */}
      <View style={styles.tableSection}>
        <Text style={styles.sectionTitle}>Detailed Breakdown</Text>
        <View style={styles.tableCard}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeadCell, { flex: 1.5, textAlign: 'left' }]}>
              {tab === 'monthly' ? 'Month' : 'Period'}
            </Text>
            <Text style={styles.tableHeadCell}>Rev/Cost</Text>
            <Text style={styles.tableHeadCell}>Profit (Margin)</Text>
          </View>

          {currentData.length === 0 ? (
            <View style={styles.emptyTable}>
              <Ionicons name="bar-chart-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No data for selected period</Text>
            </View>
          ) : (
            currentData.map((row, i) => (
              <View key={'month' in row ? row.month : `${row.year}-${row.quarter}`} style={[styles.tableRow, i % 2 === 1 && { backgroundColor: Colors.surfaceAlt }]}>
                <View style={[styles.tableCellCol, { flex: 1.5, alignItems: 'flex-start' }]}>
                  <Text style={styles.cellTitle}>{'month' in row ? row.month : `${row.year} ${row.quarter}`}</Text>
                </View>
                <View style={styles.tableCellCol}>
                  <Text style={styles.cellValPrimary}>{fmt(row.revenue)}</Text>
                  <Text style={styles.cellValSecondary}>{fmt(row.purchases)}</Text>
                </View>
                <View style={[styles.tableCellCol, { alignItems: 'flex-end' }]}>
                  <ProfitCell value={row.net_profit} />
                  <MarginCell revenue={row.revenue} profit={row.net_profit} />
                </View>
              </View>
            ))
          )}
        </View>
      </View>
      
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  
  filterBar: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    ...Shadow.sm,
  },
  filterScroll: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },
  clearChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10 },
  clearChipText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.xs, color: Colors.danger },

  summaryGrid: { padding: Spacing.md, gap: Spacing.sm },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm },
  summaryCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, borderTopWidth: 4, ...Shadow.md,
  },
  fullWidthCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontFamily: FontFamily.semiBold, fontSize: FontSize.xs, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontFamily: FontFamily.extraBold, fontSize: FontSize.lg, marginTop: 4 },
  marginBadge: { backgroundColor: Colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill },
  marginBadgeText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textPrimary },

  controlsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, marginBottom: Spacing.lg,
  },
  toggleGroup: { flexDirection: 'row', backgroundColor: Colors.border, borderRadius: Radius.md, padding: 4 },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.sm },
  toggleActive: { backgroundColor: Colors.surface, ...Shadow.sm },
  toggleText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.xs, color: Colors.textSecondary },
  toggleTextActive: { color: Colors.textPrimary, fontFamily: FontFamily.bold },
  exportGroup: { flexDirection: 'row', gap: Spacing.sm },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },
  exportBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textPrimary },

  chartSection: { marginHorizontal: Spacing.md, marginBottom: Spacing.xl },
  sectionTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: Spacing.sm },
  chartContainer: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.md, gap: 12 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  chartLabel: { width: 70, fontFamily: FontFamily.medium, fontSize: 10, color: Colors.textSecondary, textAlign: 'right' },
  chartBarBg: { flex: 1, height: 12, backgroundColor: Colors.primaryLight, borderRadius: Radius.pill, overflow: 'hidden' },
  chartBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: Radius.pill },
  chartValue: { width: 60, fontFamily: FontFamily.bold, fontSize: 10, color: Colors.textPrimary },

  tableSection: { marginHorizontal: Spacing.md },
  tableCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.md },
  tableHeader: {
    flexDirection: 'row', backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
  },
  tableHeadCell: { flex: 1, color: '#fff', fontSize: 11, fontFamily: FontFamily.bold, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tableCellCol: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
  cellTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textPrimary },
  cellValPrimary: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textPrimary },
  cellValSecondary: { fontFamily: FontFamily.medium, fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  tableCell: { fontSize: FontSize.sm },
  marginCell: { marginTop: 4, backgroundColor: Colors.surfaceAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.sm },
  marginText: { fontFamily: FontFamily.bold, fontSize: 10 },
  
  emptyTable: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textMuted },
});
