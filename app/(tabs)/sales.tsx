import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import { getSaleInvoices, SaleInvoice, getSaleInvoiceById, deleteMultipleSaleInvoices } from '../../db/queries/sales';
import { toShortDate, toStorableDate } from '../../utils/dateFormat';
import { buildSaleInvoiceHTML } from '../../services/pdfTemplate';
import { generateAndShareBulkPDF } from '../../services/shareInvoice';
import { db } from '../../db/client';
import DateTimePicker from '@react-native-community/datetimepicker';

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  paid:    { color: Colors.success, bg: Colors.successLight, label: 'PAID' },
  unpaid:  { color: Colors.danger,  bg: Colors.dangerLight,  label: 'UNPAID' },
  partial: { color: Colors.warning, bg: Colors.warningLight, label: 'PARTIAL' },
};

function groupByDate(invoices: SaleInvoice[]): { title: string; data: SaleInvoice[] }[] {
  const today = new Date(); today.setHours(0,0,0,0);
  const groups: Record<string, SaleInvoice[]> = {};
  for (const inv of invoices) {
    const d = new Date(inv.invoice_date); d.setHours(0,0,0,0);
    const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
    let key = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff <= 7 ? 'This Week' : diff <= 30 ? 'This Month' : 'Older';
    if (!groups[key]) groups[key] = [];
    groups[key].push(inv);
  }
  const order = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];
  return order.filter(k => groups[k]).map(k => ({ title: k, data: groups[k] }));
}

export default function SalesScreen() {
  const router = useRouter();
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [showPickerFor, setShowPickerFor] = useState<'start' | 'end' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [invoices, setInvoices] = useState<SaleInvoice[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');

  const loadInvoices = useCallback(() => {
    try {
      setInvoices(getSaleInvoices({ startDate: startDate ?? undefined, endDate: endDate ?? undefined, searchQuery: searchQuery || undefined }));
    } catch (e: any) { Alert.alert('Error', e.message); }
  }, [startDate, endDate, searchQuery]);

  useFocusEffect(useCallback(() => { loadInvoices(); }, [loadInvoices]));

  const toggleSelection = (id: number) => {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
  };

  const handleBulkDelete = () => {
    Alert.alert('Delete Invoices', `Delete ${selectedIds.size} invoice(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        try { deleteMultipleSaleInvoices(Array.from(selectedIds)); setSelectedIds(new Set()); loadInvoices(); }
        catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const handleBulkShare = async () => {
    setIsProcessing(true);
    try {
      const shop = db.getFirstSync<any>(`SELECT * FROM shop_profile WHERE id = 1`) ?? { id: 1, name: 'My Shop', address: '', phone: '', gstin: '', currency: 'INR' };
      const htmls: string[] = [];
      for (const id of Array.from(selectedIds)) {
        const inv = getSaleInvoiceById(id);
        if (inv) htmls.push(await buildSaleInvoiceHTML(inv as any, shop));
      }
      await generateAndShareBulkPDF(htmls, 'Sales_Invoices');
      setSelectedIds(new Set());
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setIsProcessing(false); }
  };

  const totalFiltered = invoices.reduce((s, i) => s + i.total, 0);
  const selectionMode = selectedIds.size > 0;
  const sections = groupByDate(invoices);

  const renderCard = ({ item }: { item: SaleInvoice }) => {
    const isSelected = selectedIds.has(item.id);
    const s = STATUS_META[item.status] ?? STATUS_META.unpaid;
    const isReturn = item.invoice_type === 'return';
    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => selectionMode ? toggleSelection(item.id) : router.push(`/invoice/sale/${item.id}`)}
        onLongPress={() => toggleSelection(item.id)}
        activeOpacity={0.78}
      >
        {isSelected && (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
          </View>
        )}
        <View style={[styles.cardAccent, { backgroundColor: isReturn ? Colors.danger : Colors.primary }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={styles.cardLeft}>
              <Text style={styles.invNo}>{item.invoice_number}{isReturn ? ' (Return)' : ''}</Text>
              <Text style={styles.partyName} numberOfLines={1}>{item.customer_name || '—'}</Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={[styles.amount, isReturn && { color: Colors.danger }]}>
                {isReturn ? '- ' : ''}₹{item.total.toFixed(2)}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
                <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.cardDate}><Ionicons name="calendar-outline" size={10} color={Colors.textMuted} /> {toShortDate(item.invoice_date)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Bulk Action Bar or Search */}
      {selectionMode ? (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkCount}>{selectedIds.size} selected</Text>
          <View style={styles.bulkActions}>
            <TouchableOpacity onPress={() => setSelectedIds(new Set())} style={styles.bulkChip}>
              <Text style={styles.bulkChipText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBulkShare} style={[styles.bulkChip, { backgroundColor: Colors.primary }]}>
              {isProcessing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[styles.bulkChipText, { color: '#fff' }]}>Share PDF</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBulkDelete} style={[styles.bulkChip, { backgroundColor: Colors.danger }]}>
              <Text style={[styles.bulkChipText, { color: '#fff' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.topBar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search invoices..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          {/* View mode toggle */}
          <TouchableOpacity style={styles.viewToggle} onPress={() => setViewMode(v => v === 'grouped' ? 'flat' : 'grouped')}>
            <Ionicons name={viewMode === 'grouped' ? 'list-outline' : 'layers-outline'} size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Filter chips */}
      <View style={styles.filterRow}>
        <TouchableOpacity onPress={() => setShowPickerFor('start')} style={[styles.chip, startDate && styles.chipActive]}>
          <Ionicons name="calendar-outline" size={11} color={startDate ? '#fff' : Colors.textSecondary} />
          <Text style={[styles.chipText, startDate && styles.chipTextActive]}>
            {startDate ? toShortDate(startDate) : 'Start'}
          </Text>
        </TouchableOpacity>
        <Text style={{ color: Colors.textMuted, fontSize: 12 }}>→</Text>
        <TouchableOpacity onPress={() => setShowPickerFor('end')} style={[styles.chip, endDate && styles.chipActive]}>
          <Ionicons name="calendar-outline" size={11} color={endDate ? '#fff' : Colors.textSecondary} />
          <Text style={[styles.chipText, endDate && styles.chipTextActive]}>
            {endDate ? toShortDate(endDate) : 'End'}
          </Text>
        </TouchableOpacity>
        {(startDate || endDate) && (
          <TouchableOpacity onPress={() => { setStartDate(null); setEndDate(null); }} style={styles.clearChip}>
            <Ionicons name="close-outline" size={14} color={Colors.danger} />
            <Text style={{ fontSize: 11, color: Colors.danger, fontFamily: FontFamily.semiBold }}>Clear</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        {invoices.length > 0 && (
          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeText}>Total: ₹{totalFiltered.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {showPickerFor && (
        <DateTimePicker
          value={showPickerFor === 'start' ? (startDate ? new Date(startDate) : new Date()) : (endDate ? new Date(endDate) : new Date())}
          mode="date" display="default"
          onValueChange={(_, date) => {
            const m = showPickerFor; setShowPickerFor(null);
            if (date) {
              const f = toStorableDate(date).split('T')[0];
              m === 'start' ? setStartDate(f) : setEndDate(f);
            }
          }}
          onDismiss={() => setShowPickerFor(null)}
        />
      )}

      {viewMode === 'grouped' ? (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCard}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
              <Text style={styles.sectionHeaderCount}>{section.data.length} invoice{section.data.length !== 1 ? 's' : ''}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<EmptyState onPress={() => router.push('/invoice/sale/create')} message="No sales found" btnLabel="+ Create First Invoice" />}
          stickySectionHeadersEnabled={false}
        />
      ) : (
        <SectionList
          sections={[{ title: '', data: invoices }]}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCard}
          renderSectionHeader={() => null}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<EmptyState onPress={() => router.push('/invoice/sale/create')} message="No sales found" btnLabel="+ Create First Invoice" />}
        />
      )}
    </View>
  );
}

function EmptyState({ onPress, message, btnLabel }: { onPress: () => void; message: string; btnLabel: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="receipt-outline" size={52} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>{message}</Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onPress}>
        <Text style={styles.emptyBtnText}>{btnLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, paddingBottom: 0 },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },
  searchInput: { flex: 1, fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textPrimary },
  viewToggle: {
    width: 42, height: 42, borderRadius: Radius.md,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },

  bulkBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.primaryLight, padding: Spacing.md, margin: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primary + '40',
  },
  bulkCount: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.primary },
  bulkActions: { flexDirection: 'row', gap: Spacing.sm },
  bulkChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  bulkChipText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textPrimary },

  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: FontFamily.semiBold, fontSize: 11, color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },
  clearChip: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 6 },
  totalBadge: {
    backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  totalBadgeText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#fff' },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginTop: Spacing.sm,
  },
  sectionHeaderText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textSecondary },
  sectionHeaderCount: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textMuted },

  listContent: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    marginBottom: Spacing.sm, flexDirection: 'row',
    overflow: 'hidden', ...Shadow.sm,
  },
  cardSelected: { borderWidth: 1.5, borderColor: Colors.primary },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: Spacing.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flex: 1, marginRight: Spacing.sm },
  invNo: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.primary },
  partyName: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.textPrimary, marginTop: 2 },
  cardDate: { fontFamily: FontFamily.medium, fontSize: 10, color: Colors.textMuted, marginTop: 6 },
  cardRight: { alignItems: 'flex-end' },
  amount: { fontFamily: FontFamily.extraBold, fontSize: FontSize.lg, color: Colors.textPrimary },
  statusBadge: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill },
  statusText: { fontFamily: FontFamily.bold, fontSize: 10 },
  checkBadge: { position: 'absolute', top: 8, left: 8, zIndex: 1 },

  empty: { alignItems: 'center', marginTop: 60, gap: Spacing.md },
  emptyTitle: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.textMuted },
  emptyBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.md },
  emptyBtnText: { fontFamily: FontFamily.bold, color: '#fff', fontSize: FontSize.sm },
});
