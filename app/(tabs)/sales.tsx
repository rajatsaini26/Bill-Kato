import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput, ActivityIndicator
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors, Spacing, FontSize } from '../../constants/theme';
import { getSaleInvoices, SaleInvoice, getSaleInvoiceById, deleteMultipleSaleInvoices } from '../../db/queries/sales';
import { toShortDate, toMonthKey, toStorableDate } from '../../utils/dateFormat';
import { buildSaleInvoiceHTML } from '../../services/pdfTemplate';
import { generateAndShareBulkPDF } from '../../services/shareInvoice';
import { db } from '../../db/client';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [invoices, setInvoices] = useState<SaleInvoice[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const loadInvoices = useCallback(() => {
    try {
      setInvoices(getSaleInvoices({
        month: selectedMonth ?? undefined,
        searchQuery: searchQuery || undefined,
      }));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }, [selectedMonth, searchQuery]);

  useFocusEffect(useCallback(() => { loadInvoices(); }, [loadInvoices]));

  const toggleSelection = (id: number) => {
    const newSel = new Set(selectedIds);
    if (newSel.has(id)) newSel.delete(id);
    else newSel.add(id);
    setSelectedIds(newSel);
  };

  const handleBulkDelete = () => {
    Alert.alert('Delete Invoices', `Are you sure you want to delete ${selectedIds.size} invoices?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
          try {
            deleteMultipleSaleInvoices(Array.from(selectedIds));
            setSelectedIds(new Set());
            loadInvoices();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        }
      }
    ]);
  };

  const handleBulkShare = async () => {
    setIsProcessing(true);
    try {
      const shop = db.getFirstSync<any>(`SELECT * FROM shop_profile WHERE id = 1`) ?? {
        id: 1, name: 'My Shop', address: '', phone: '', gstin: '', currency: 'INR',
      };
      const htmls: string[] = [];
      for (const id of Array.from(selectedIds)) {
        const inv = getSaleInvoiceById(id);
        if (inv) {
          htmls.push(await buildSaleInvoiceHTML(inv as any, shop));
        }
      }
      await generateAndShareBulkPDF(htmls, 'Sales_Invoices');
      setSelectedIds(new Set());
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderItem = ({ item }: { item: SaleInvoice }) => {
    const isSelected = selectedIds.has(item.id);
    const selectionMode = selectedIds.size > 0;
    
    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => {
          if (selectionMode) toggleSelection(item.id);
          else router.push(`/invoice/sale/${item.id}`);
        }}
        onLongPress={() => toggleSelection(item.id)}
      >
        <View style={styles.cardLeft}>
          <Text style={styles.invNo}>{item.invoice_number}</Text>
          <Text style={styles.partyName}>{item.customer_name || '—'} {item.invoice_type === 'return' ? '(Return)' : ''}</Text>
          <Text style={styles.date}>{toShortDate(item.invoice_date)}</Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.amount, item.invoice_type === 'return' && { color: Colors.danger }]}>
            {item.invoice_type === 'return' ? '-' : ''}₹{item.total.toFixed(2)}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + '22' }]}>
            <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {selectedIds.size > 0 ? (
        <View style={styles.bulkActionBar}>
          <Text style={styles.bulkActionText}>{selectedIds.size} Selected</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={handleBulkDelete} style={styles.bulkBtnDanger}>
              <Text style={styles.bulkBtnText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBulkShare} style={styles.bulkBtnPrimary}>
              {isProcessing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.bulkBtnText}>Share</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelectedIds(new Set())} style={styles.bulkBtnOutline}>
              <Text style={{ color: Colors.textPrimary, fontSize: FontSize.xs, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or invoice no..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      )}

      <MonthPicker selected={selectedMonth} onChange={setSelectedMonth} />
      
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
  searchBar: { marginBottom: Spacing.sm },
  searchInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 10, backgroundColor: '#fff', fontSize: FontSize.sm },
  bulkActionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e0e7ff', padding: 12, borderRadius: 8, marginBottom: Spacing.sm },
  bulkActionText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  bulkBtnDanger: { backgroundColor: Colors.danger, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  bulkBtnPrimary: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  bulkBtnOutline: { borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#fff' },
  bulkBtnText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '700' },
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
  cardSelected: { backgroundColor: '#eff6ff', borderColor: Colors.primary, borderWidth: 1 },
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
