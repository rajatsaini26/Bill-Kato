import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput, ActivityIndicator
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors, Spacing, FontSize } from '../../constants/theme';
import { getPurchaseInvoices, PurchaseInvoice, getPurchaseInvoiceById, deleteMultiplePurchaseInvoices } from '../../db/queries/purchases';
import { toShortDate, toStorableDate } from '../../utils/dateFormat';
import { buildPurchaseInvoiceHTML } from '../../services/pdfTemplate';
import { generateAndShareBulkPDF } from '../../services/shareInvoice';
import { db } from '../../db/client';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function PurchasesScreen() {
  const router = useRouter();
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [showPickerFor, setShowPickerFor] = useState<'start' | 'end' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const loadInvoices = useCallback(() => {
    try {
      setInvoices(getPurchaseInvoices({
        startDate: startDate ?? undefined,
        endDate: endDate ?? undefined,
        searchQuery: searchQuery || undefined,
      }));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }, [startDate, endDate, searchQuery]);

  useFocusEffect(useCallback(() => { loadInvoices(); }, [loadInvoices]));

  const toggleSelection = (id: number) => {
    const newSel = new Set(selectedIds);
    if (newSel.has(id)) newSel.delete(id);
    else newSel.add(id);
    setSelectedIds(newSel);
  };

  const handleBulkDelete = () => {
    Alert.alert('Delete Purchases', `Are you sure you want to delete ${selectedIds.size} purchases?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
          try {
            deleteMultiplePurchaseInvoices(Array.from(selectedIds));
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
        const inv = getPurchaseInvoiceById(id);
        if (inv) {
          htmls.push(await buildPurchaseInvoiceHTML(inv as any, shop));
        }
      }
      await generateAndShareBulkPDF(htmls, 'Purchase_Records');
      setSelectedIds(new Set());
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderItem = ({ item }: { item: PurchaseInvoice }) => {
    const isSelected = selectedIds.has(item.id);
    const selectionMode = selectedIds.size > 0;
    
    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => {
          if (selectionMode) toggleSelection(item.id);
          else router.push(`/invoice/purchase/${item.id}`);
        }}
        onLongPress={() => toggleSelection(item.id)}
      >
        <View style={styles.cardLeft}>
          <Text style={styles.invNo}>{item.invoice_number}</Text>
          <Text style={styles.partyName}>{item.vendor_name || '—'}</Text>
          <Text style={styles.date}>{toShortDate(item.invoice_date)}</Text>
        </View>
        <Text style={styles.amount}>₹{item.total.toFixed(2)}</Text>
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
            placeholder="Search by vendor or invoice no..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: Spacing.sm }}>
        <TouchableOpacity onPress={() => setShowPickerFor('start')} style={[styles.filterChip, startDate ? { backgroundColor: Colors.success } : {}]}>
          <Text style={[styles.filterChipText, startDate ? { color: '#fff' } : {}]}>
            {startDate ? `Start: ${toShortDate(startDate)}` : 'Start Date'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowPickerFor('end')} style={[styles.filterChip, endDate ? { backgroundColor: Colors.success } : {}]}>
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
  searchBar: { marginBottom: Spacing.sm },
  searchInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 10, backgroundColor: '#fff', fontSize: FontSize.sm },
  bulkActionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ecfdf5', padding: 12, borderRadius: 8, marginBottom: Spacing.sm },
  bulkActionText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.success },
  bulkBtnDanger: { backgroundColor: Colors.danger, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  bulkBtnPrimary: { backgroundColor: Colors.success, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
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
    borderLeftWidth: 4, borderLeftColor: Colors.success,
  },
  cardSelected: { backgroundColor: '#f0fdf4', borderColor: Colors.success, borderWidth: 1 },
  cardLeft: { flex: 1 },
  invNo: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.success },
  partyName: { fontSize: FontSize.md, color: Colors.textPrimary, marginTop: 2 },
  date: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  amount: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted },
  emptyBtn: { backgroundColor: Colors.success, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
});
