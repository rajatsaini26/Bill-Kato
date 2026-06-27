import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors, Spacing, FontSize } from '../../constants/theme';
import { getSaleInvoices, SaleInvoice } from '../../db/queries/sales';
import { toShortDate, toMonthKey, toStorableDate } from '../../utils/dateFormat';

const STATUS_COLOR: Record<string, string> = {
  paid: Colors.success,
  unpaid: Colors.danger,
  partial: Colors.warning,
};

function MonthPicker({ selected, onChange }: { selected: string | null; onChange: (v: string | null) => void }) {
  const options = [null, ...Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })];

  return (
    <FlatList
      horizontal
      data={options}
      keyExtractor={(item) => item ?? 'all'}
      showsHorizontalScrollIndicator={false}
      style={{ maxHeight: 40, marginBottom: Spacing.sm }}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => onChange(item)}
          style={[
            styles.filterChip,
            selected === item && { backgroundColor: Colors.primary },
          ]}
        >
          <Text style={[styles.filterChipText, selected === item && { color: '#fff' }]}>
            {item ? item : 'All'}
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

export default function SalesScreen() {
  const router = useRouter();
  const currentMonth = toMonthKey(toStorableDate());
  const [selectedMonth, setSelectedMonth] = useState<string | null>(currentMonth);
  const [invoices, setInvoices] = useState<SaleInvoice[]>([]);

  useFocusEffect(
    useCallback(() => {
      try {
        setInvoices(getSaleInvoices(selectedMonth ? { month: selectedMonth } : undefined));
      } catch (e: any) {
        Alert.alert('Error', e.message);
      }
    }, [selectedMonth])
  );

  const renderItem = ({ item }: { item: SaleInvoice }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/invoice/sale/${item.id}`)}
    >
      <View style={styles.cardLeft}>
        <Text style={styles.invNo}>{item.invoice_number}</Text>
        <Text style={styles.partyName}>{item.customer_name || '—'}</Text>
        <Text style={styles.date}>{toShortDate(item.invoice_date)}</Text>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.amount}>₹{item.total.toFixed(2)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + '22' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <MonthPicker selected={selectedMonth} onChange={(v) => {
        setSelectedMonth(v);
        try {
          setInvoices(getSaleInvoices(v ? { month: v } : undefined));
        } catch (e: any) {
          Alert.alert('Error', e.message);
        }
      }} />
      <FlatList
        data={invoices}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No invoices found</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/invoice/sale/create')}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>+ Create First Invoice</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8,
    backgroundColor: Colors.border,
  },
  filterChipText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  card: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md,
    marginBottom: Spacing.sm, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    borderLeftWidth: 4, borderLeftColor: Colors.primary,
  },
  cardLeft: { flex: 1 },
  invNo: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  partyName: { fontSize: FontSize.md, color: Colors.textPrimary, marginTop: 2 },
  date: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  amount: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  statusBadge: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted },
  emptyBtn: { backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
});
