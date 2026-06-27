import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors, Spacing, FontSize } from '../../constants/theme';
import { getPurchaseInvoices, PurchaseInvoice } from '../../db/queries/purchases';
import { toShortDate, toMonthKey, toStorableDate } from '../../utils/dateFormat';

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
          style={[styles.filterChip, selected === item && { backgroundColor: Colors.success }]}
        >
          <Text style={[styles.filterChipText, selected === item && { color: '#fff' }]}>
            {item ? item : 'All'}
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

export default function PurchasesScreen() {
  const router = useRouter();
  const currentMonth = toMonthKey(toStorableDate());
  const [selectedMonth, setSelectedMonth] = useState<string | null>(currentMonth);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);

  useFocusEffect(
    useCallback(() => {
      try {
        setInvoices(getPurchaseInvoices(selectedMonth ? { month: selectedMonth } : undefined));
      } catch (e: any) {
        Alert.alert('Error', e.message);
      }
    }, [selectedMonth])
  );

  const renderItem = ({ item }: { item: PurchaseInvoice }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/invoice/purchase/${item.id}`)}
    >
      <View style={styles.cardLeft}>
        <Text style={styles.invNo}>{item.invoice_number}</Text>
        <Text style={styles.partyName}>{item.vendor_name || '—'}</Text>
        <Text style={styles.date}>{toShortDate(item.invoice_date)}</Text>
      </View>
      <Text style={styles.amount}>₹{item.total.toFixed(2)}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <MonthPicker selected={selectedMonth} onChange={(v) => {
        setSelectedMonth(v);
        try {
          setInvoices(getPurchaseInvoices(v ? { month: v } : undefined));
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
            <Text style={styles.emptyText}>No purchases found</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/invoice/purchase/create')}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>+ Add First Purchase</Text>
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
    borderLeftWidth: 4, borderLeftColor: Colors.success,
  },
  cardLeft: { flex: 1 },
  invNo: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.success },
  partyName: { fontSize: FontSize.md, color: Colors.textPrimary, marginTop: 2 },
  date: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  amount: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted },
  emptyBtn: { backgroundColor: Colors.success, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
});
