import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, Alert, KeyboardAvoidingView, Platform, Animated, ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import { db } from '../../db/client';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';

interface InventoryItem {
  id: number;
  item_name: string;
  unit: string;
  current_stock: number;
  purchase_cost: number;
  default_price: number;
}

const METRIC_UNITS = ['kg', 'g', 'L', 'ml', 'm', 'cm', 'pcs(pieces)', 'box', 'feet'];
const EMPTY_FORM = { name: '', unit: 'kg', cost: '', price: '', stock: '' };
const LOW_STOCK_THRESHOLD = 10;

type SortMode = 'name' | 'stock_asc' | 'stock_desc';

function getStockColor(stock: number): string {
  if (stock <= 0) return Colors.danger;
  if (stock <= LOW_STOCK_THRESHOLD) return Colors.warning;
  return Colors.success;
}

function StockBar({ stock, max }: { stock: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, stock / max)) : 0;
  const color = getStockColor(stock);
  return (
    <View style={barStyles.track}>
      <View style={[barStyles.fill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
    </View>
  );
}
const barStyles = StyleSheet.create({
  track: { height: 4, backgroundColor: Colors.border, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
});

export default function InventoryScreen() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('name');
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const slideAnim = useRef(new Animated.Value(500)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const openModal = (item?: InventoryItem) => {
    if (item) {
      setIsEditing(true); setEditId(item.id);
      setForm({ name: item.item_name, unit: item.unit, cost: item.purchase_cost?.toString() ?? '0', price: item.default_price?.toString() ?? '0', stock: item.current_stock?.toString() ?? '0' });
    } else {
      setIsEditing(false); setEditId(null); setForm(EMPTY_FORM);
    }
    setModalVisible(true);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 500, duration: 220, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setModalVisible(false));
  };

  const loadItems = useCallback(() => {
    try {
      const q = search
        ? `SELECT * FROM inventory_items WHERE item_name LIKE '%${search}%' ORDER BY item_name ASC`
        : `SELECT * FROM inventory_items ORDER BY item_name ASC`;
      let result = db.getAllSync<InventoryItem>(q);
      if (sort === 'stock_asc') result = [...result].sort((a, b) => a.current_stock - b.current_stock);
      if (sort === 'stock_desc') result = [...result].sort((a, b) => b.current_stock - a.current_stock);
      setItems(result);
    } catch (e) { console.log('Error loading inventory:', e); }
  }, [search, sort]);

  useFocusEffect(useCallback(() => { loadItems(); }, [loadItems]));

  const handleSave = () => {
    if (!form.name.trim()) { Alert.alert('Validation Error', 'Item name is required.'); return; }
    const cost = parseFloat(form.cost) || 0;
    const price = parseFloat(form.price) || 0;
    const stock = parseFloat(form.stock) || 0;
    try {
      if (isEditing && editId !== null) {
        db.runSync(`UPDATE inventory_items SET item_name=?, unit=?, purchase_cost=?, default_price=?, current_stock=? WHERE id=?`, [form.name.trim(), form.unit, cost, price, stock, editId]);
      } else {
        db.runSync(`INSERT INTO inventory_items (item_name, unit, purchase_cost, default_price, current_stock) VALUES (?, ?, ?, ?, ?)`, [form.name.trim(), form.unit, cost, price, stock]);
      }
      closeModal(); loadItems();
    } catch (e: any) {
      if (e.message?.includes('UNIQUE constraint failed')) Alert.alert('Error', 'An item with this name already exists.');
      else Alert.alert('Error', 'Could not save item.');
    }
  };

  const handleDelete = (item: InventoryItem) => {
    Alert.alert('Delete Item', `Delete "${item.item_name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        try { db.runSync(`DELETE FROM inventory_items WHERE id=?`, [item.id]); loadItems(); }
        catch { Alert.alert('Error', 'Could not delete item.'); }
      }},
    ]);
  };

  const exportCSV = async () => {
    try {
      const allItems = db.getAllSync<InventoryItem>(`SELECT * FROM inventory_items ORDER BY item_name ASC`);
      if (allItems.length === 0) { Alert.alert('No Data', 'No inventory items to export.'); return; }
      const headers = 'Item Name,Unit,Purchase Price,Sale Price,Current Stock Quantity';
      const rows = allItems.map(i =>
        `"${i.item_name}","${i.unit}",${i.purchase_cost ?? 0},${i.default_price ?? 0},${i.current_stock ?? 0}`
      ).join('\n');
      const csv = headers + '\n' + rows;
      const path = (FileSystem.documentDirectory ?? '') + 'inventory_export.csv';
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export Inventory CSV' });
    } catch (e: any) { Alert.alert('Export Error', e.message); }
  };

  const importCSV = async () => {
    try {
      console.log('[Import] Opening document picker...');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        console.log('[Import] Cancelled or no file selected.');
        return;
      }

      const asset = result.assets[0];
      const fileName = asset.name ?? '';
      console.log(`[Import] File picked: name="${fileName}" size=${asset.size} mimeType="${asset.mimeType}"`);

      // ---- Parse into a 2D array of strings (rows x cols) ----
      let rows: string[][] = [];
      const isXlsx = /\.xlsx?$/i.test(fileName) ||
        asset.mimeType?.includes('spreadsheetml') ||
        asset.mimeType?.includes('ms-excel');

      if (isXlsx) {
        console.log('[Import] Detected XLSX — reading as base64...');
        const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
        console.log(`[Import] Base64 length: ${b64.length}`);
        const workbook = XLSX.read(b64, { type: 'base64' });
        const sheetName = workbook.SheetNames[0];
        console.log(`[Import] Workbook sheets: [${workbook.SheetNames.join(', ')}] — using "${sheetName}"`);
        const sheet = workbook.Sheets[sheetName];
        // sheet_to_array_of_arrays gives us string[][]
        rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' }) as string[][];
        console.log(`[Import] XLSX parsed: ${rows.length} rows x ${rows[0]?.length ?? 0} cols`);
      } else {
        console.log('[Import] Detected CSV — reading as UTF-8 text...');
        const text = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
        console.log(`[Import] Text length: ${text.length}`);
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        rows = lines.map(l => l.split(',').map(c => c.replace(/"/g, '').trim()));
        console.log(`[Import] CSV parsed: ${rows.length} rows`);
      }

      if (rows.length < 2) {
        console.warn('[Import] Not enough rows — aborting.');
        Alert.alert('Invalid File', 'The file must have a header row and at least one data row.');
        return;
      }

      // ---- Fuzzy header mapping ----
      const rawHeaders = rows[0].map(h => String(h ?? '').trim().toLowerCase());
      console.log(`[Import] Headers (${rawHeaders.length}): [${rawHeaders.join(' | ')}]`);

      const colMap = { name: -1, unit: -1, cost: -1, price: -1, stock: -1 };
      rawHeaders.forEach((h, i) => {
        if (/item.?name|name|product/i.test(h)) colMap.name = i;
        else if (/\bunit\b/i.test(h)) colMap.unit = i;
        else if (/purchase|cost|buy/i.test(h)) colMap.cost = i;
        else if (/sale.?price|sell|price|mrp/i.test(h)) colMap.price = i;
        else if (/stock|quantity|qty|current.?stock/i.test(h)) colMap.stock = i;
      });
      console.log(`[Import] Column map: name=${colMap.name} unit=${colMap.unit} cost=${colMap.cost} price=${colMap.price} stock=${colMap.stock}`);

      if (colMap.name < 0) {
        console.warn('[Import] "Item Name" column not found. Aborting.');
        Alert.alert('Column Not Found', 'Could not find an "Item Name" column.\n\nFound headers:\n' + rawHeaders.join(', '));
        return;
      }

      // Log first 3 data rows
      for (let s = 1; s <= Math.min(3, rows.length - 1); s++) {
        console.log(`[Import] Sample row ${s}: [${rows[s].join(' | ')}]`);
      }

      // ---- Upsert rows ----
      let inserted = 0, updated = 0, skipped = 0;
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].map(c => String(c ?? '').trim());
        const name = cols[colMap.name]?.trim();
        if (!name) { skipped++; continue; }

        const unit = colMap.unit >= 0 ? (cols[colMap.unit] || 'pcs') : 'pcs';
        const cost = colMap.cost >= 0 ? parseFloat(cols[colMap.cost]) || 0 : 0;
        const price = colMap.price >= 0 ? parseFloat(cols[colMap.price]) || 0 : 0;
        const stock = colMap.stock >= 0 ? parseFloat(cols[colMap.stock]) || 0 : 0;

        const existing = db.getFirstSync<{ id: number }>(`SELECT id FROM inventory_items WHERE item_name = ?`, [name]);
        if (existing) {
          db.runSync(`UPDATE inventory_items SET unit=?, purchase_cost=?, default_price=?, current_stock=? WHERE id=?`,
            [unit, cost, price, stock, existing.id]);
          console.log(`[Import] Row ${i}: UPDATED id=${existing.id} name="${name}" cost=${cost} price=${price} stock=${stock}`);
          updated++;
        } else {
          db.runSync(`INSERT INTO inventory_items (item_name, unit, purchase_cost, default_price, current_stock) VALUES (?,?,?,?,?)`,
            [name, unit, cost, price, stock]);
          console.log(`[Import] Row ${i}: INSERTED name="${name}" cost=${cost} price=${price} stock=${stock}`);
          inserted++;
        }
      }

      console.log(`[Import] Complete — inserted=${inserted} updated=${updated} skipped=${skipped}`);
      loadItems();
      Alert.alert('Import Complete', `${inserted} items added, ${updated} items updated.${skipped > 0 ? `\n${skipped} rows skipped (empty name).` : ''}`);
    } catch (e: any) {
      console.error('[Import] ERROR:', e);
      Alert.alert('Import Error', e.message);
    }
  };

  const maxStock = Math.max(...items.map(i => i.current_stock), 1);
  const lowStockItems = items.filter(i => i.current_stock <= LOW_STOCK_THRESHOLD && i.current_stock > 0);
  const outOfStock = items.filter(i => i.current_stock <= 0);

  const renderItem = ({ item }: { item: InventoryItem }) => {
    const stockColor = getStockColor(item.current_stock);
    const margin = item.default_price > 0 ? ((item.default_price - item.purchase_cost) / item.default_price * 100) : 0;
    return (
      <View style={styles.card}>
        <View style={[styles.cardAccent, { backgroundColor: stockColor }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={styles.cardInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.itemName}>{item.item_name}</Text>
                <View style={[styles.unitPill, { backgroundColor: Colors.primaryLight }]}>
                  <Text style={styles.unitPillText}>{item.unit}</Text>
                </View>
              </View>
              <Text style={styles.itemMeta}>Buy ₹{item.purchase_cost?.toFixed(2) || '0.00'}  •  Sell ₹{item.default_price?.toFixed(2) || '0.00'}  •  Margin {margin.toFixed(0)}%</Text>
              <StockBar stock={item.current_stock} max={maxStock} />
            </View>
            <View style={styles.cardRight}>
              <Text style={[styles.stockNum, { color: stockColor }]}>
                {item.current_stock % 1 === 0 ? item.current_stock.toFixed(0) : item.current_stock.toFixed(2)}
              </Text>
              <Text style={styles.stockUnit}>{item.unit}</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.primaryLight }]} onPress={() => openModal(item)}>
                  <Ionicons name="pencil-outline" size={14} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.dangerLight }]} onPress={() => handleDelete(item)}>
                  <Ionicons name="trash-outline" size={14} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.topBtnGroup}>
          <TouchableOpacity style={styles.iconActionBtn} onPress={importCSV}>
            <Ionicons name="cloud-download-outline" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconActionBtn} onPress={exportCSV}>
            <Ionicons name="cloud-upload-outline" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sort Row */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort:</Text>
        {([['name', 'A–Z'], ['stock_asc', 'Low Stock'], ['stock_desc', 'High Stock']] as [SortMode, string][]).map(([mode, label]) => (
          <TouchableOpacity key={mode} onPress={() => setSort(mode)} style={[styles.sortChip, sort === mode && styles.sortChipActive]}>
            <Text style={[styles.sortChipText, sort === mode && { color: '#fff' }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Alert Banner */}
      {(outOfStock.length > 0 || lowStockItems.length > 0) && (
        <View style={styles.alertBanner}>
          <Ionicons name="warning-outline" size={16} color={Colors.warning} />
          <Text style={styles.alertText}>
            {outOfStock.length > 0 ? `${outOfStock.length} out of stock` : ''}
            {outOfStock.length > 0 && lowStockItems.length > 0 ? '  •  ' : ''}
            {lowStockItems.length > 0 ? `${lowStockItems.length} low stock` : ''}
          </Text>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={52} color={Colors.textMuted} />
            <Text style={styles.emptyStateText}>No items found</Text>
            <Text style={styles.emptyStateSubText}>Add items manually or they'll appear here when you create invoices.</Text>
          </View>
        }
      />

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="none" onRequestClose={closeModal} statusBarTranslucent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <Animated.View style={[styles.modalOverlay, { opacity: overlayAnim }]}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeModal} />
            <Animated.View style={[styles.modalSheet, { transform: [{ translateY: slideAnim }] }]}>
              <View style={styles.dragHandle} />
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{isEditing ? 'Edit Item' : 'New Item'}</Text>
                  <Text style={styles.modalSub}>{isEditing ? 'Update inventory details' : 'Add to your inventory'}</Text>
                </View>
                <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
                  <Ionicons name="close" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Item Name *</Text>
                <TextInput style={styles.input} placeholderTextColor={Colors.textMuted} placeholder="e.g. Basmati Rice" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} />

                <Text style={styles.label}>Unit of Measurement</Text>
                <View style={styles.unitsGrid}>
                  {METRIC_UNITS.map((u) => (
                    <TouchableOpacity key={u} style={[styles.unitChip, form.unit === u && styles.unitChipActive]} onPress={() => setForm((f) => ({ ...f, unit: u }))}>
                      <Text style={[styles.unitChipText, form.unit === u && styles.unitChipTextActive]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Purchase Cost (₹)</Text>
                    <TextInput style={styles.input} placeholderTextColor={Colors.textMuted} placeholder="0.00" value={form.cost} onChangeText={(v) => setForm((f) => ({ ...f, cost: v }))} keyboardType="decimal-pad" />
                  </View>
                  <View style={{ width: Spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Sell Price (₹)</Text>
                    <TextInput style={styles.input} placeholderTextColor={Colors.textMuted} placeholder="0.00" value={form.price} onChangeText={(v) => setForm((f) => ({ ...f, price: v }))} keyboardType="decimal-pad" />
                  </View>
                </View>

                <Text style={styles.label}>{isEditing ? 'Current Stock' : 'Opening Quantity'}</Text>
                <TextInput style={styles.input} placeholderTextColor={Colors.textMuted} placeholder="0" value={form.stock} onChangeText={(v) => setForm((f) => ({ ...f, stock: v }))} keyboardType="decimal-pad" />

                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Ionicons name={isEditing ? 'save-outline' : 'add-circle-outline'} size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>{isEditing ? 'Update Item' : 'Add to Inventory'}</Text>
                </TouchableOpacity>
                <View style={{ height: 32 }} />
              </ScrollView>
            </Animated.View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border, ...Shadow.sm,
  },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.background, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: Colors.textPrimary },
  topBtnGroup: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconActionBtn: {
    width: 38, height: 38, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.border,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: Radius.md, ...Shadow.sm,
  },
  addBtnText: { color: '#fff', fontFamily: FontFamily.bold, fontSize: FontSize.sm },

  sortRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  sortLabel: { fontFamily: FontFamily.semiBold, fontSize: FontSize.xs, color: Colors.textMuted },
  sortChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  sortChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sortChipText: { fontFamily: FontFamily.semiBold, fontSize: 11, color: Colors.textSecondary },

  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.warningLight, borderBottomWidth: 1, borderBottomColor: Colors.warning + '40',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  alertText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.xs, color: Colors.warning },

  listContent: { padding: Spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    marginBottom: Spacing.sm, flexDirection: 'row', overflow: 'hidden', ...Shadow.md,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: Spacing.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInfo: { flex: 1, marginRight: Spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  itemName: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.textPrimary, flexShrink: 1 },
  unitPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill },
  unitPillText: { fontFamily: FontFamily.semiBold, fontSize: 10, color: Colors.primary },
  itemMeta: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  stockNum: { fontFamily: FontFamily.extraBold, fontSize: FontSize.xl },
  stockUnit: { fontFamily: FontFamily.medium, fontSize: 10, color: Colors.textMuted },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  actionBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  emptyState: { marginTop: 60, alignItems: 'center', padding: 24, gap: Spacing.sm },
  emptyStateText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.textSecondary },
  emptyStateSubText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%', paddingTop: 12, ...Shadow.lg,
  },
  dragHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg, marginBottom: Spacing.md,
  },
  modalTitle: { fontFamily: FontFamily.extraBold, fontSize: FontSize.xl, color: Colors.textPrimary },
  modalSub: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  closeBtn: {
    backgroundColor: Colors.background, borderRadius: 20, width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  modalForm: { paddingHorizontal: Spacing.lg },
  label: { fontFamily: FontFamily.semiBold, fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 6, marginTop: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: 12,
    fontSize: FontSize.md, fontFamily: FontFamily.regular, color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  formRow: { flexDirection: 'row' },
  unitsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitChip: {
    paddingVertical: 7, paddingHorizontal: 14, borderRadius: Radius.pill,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  unitChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  unitChipText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.textSecondary },
  unitChipTextActive: { color: '#fff' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, padding: 16, borderRadius: Radius.md,
    marginTop: Spacing.lg, ...Shadow.md,
  },
  saveBtnText: { color: '#fff', fontFamily: FontFamily.bold, fontSize: FontSize.md },
});
