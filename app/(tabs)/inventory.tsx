import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors, Spacing, FontSize } from '../../constants/theme';
import { db } from '../../db/client';

interface InventoryItem {
  id: number;
  item_name: string;
  unit: string;
  current_stock: number;
  purchase_cost: number;
  default_price: number;
}

export default function InventoryScreen() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('kg');
  const [newItemCost, setNewItemCost] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemStock, setNewItemStock] = useState('');

  const METRIC_UNITS = ['kg', 'g', 'L', 'ml', 'm', 'cm', 'pcs(pieces)', 'box', 'feet'];

  const loadItems = () => {
    try {
      const q = search 
        ? `SELECT * FROM inventory_items WHERE item_name LIKE '%${search}%' ORDER BY item_name ASC`
        : `SELECT * FROM inventory_items ORDER BY item_name ASC`;
      const result = db.getAllSync<InventoryItem>(q);
      setItems(result);
    } catch (e) {
      console.log('Error loading inventory:', e);
    }
  };

  const handleAddItem = () => {
    if (!newItemName.trim()) {
      Alert.alert('Validation Error', 'Item name is required.');
      return;
    }
    const cost = parseFloat(newItemCost) || 0;
    const price = parseFloat(newItemPrice) || 0;
    const stock = parseFloat(newItemStock) || 0;

    try {
      db.runSync(
        `INSERT INTO inventory_items (item_name, unit, purchase_cost, default_price, current_stock) 
         VALUES (?, ?, ?, ?, ?)`,
        [newItemName.trim(), newItemUnit, cost, price, stock]
      );
      Alert.alert('Success', 'Item added to inventory.');
      setIsModalVisible(false);
      setNewItemName('');
      setNewItemCost('');
      setNewItemPrice('');
      setNewItemStock('');
      setNewItemUnit('kg');
      loadItems();
    } catch (e: any) {
      if (e.message.includes('UNIQUE constraint failed')) {
        Alert.alert('Error', 'An item with this name already exists.');
      } else {
        Alert.alert('Error', 'Could not save item.');
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [search])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TextInput
            style={[styles.searchInput, { flex: 1, marginRight: Spacing.sm }]}
            placeholder="Search inventory..."
            placeholderTextColor="#6b7280"
            value={search}
            onChangeText={setSearch}
          />
          <TouchableOpacity style={styles.addBtn} onPress={() => setIsModalVisible(true)}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No items found in inventory.</Text>
            <Text style={styles.emptyStateSubText}>Items are automatically added here when you create a sale or purchase invoice.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.itemName}>{item.item_name}</Text>
              <Text style={styles.itemMeta}>Unit: {item.unit}</Text>
              <Text style={styles.itemMeta}>Buy: ₹{item.purchase_cost?.toFixed(2) || '0.00'} • Sell: ₹{item.default_price?.toFixed(2) || '0.00'}</Text>
            </View>
            <View style={styles.stockInfo}>
              <Text style={[styles.stockText, item.current_stock < 0 && styles.negativeStock]}>
                {item.current_stock.toFixed(2)}
              </Text>
              <Text style={styles.stockLabel}>in stock</Text>
            </View>
          </View>
        )}
      />

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Item</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalForm}>
              <Text style={styles.label}>Item Name *</Text>
              <TextInput style={styles.input} placeholderTextColor="#6b7280" placeholder="e.g. Rice, Sugar" value={newItemName} onChangeText={setNewItemName} />

              <Text style={styles.label}>Unit</Text>
              <View style={styles.unitsContainer}>
                {METRIC_UNITS.map(u => (
                  <TouchableOpacity key={u} style={[styles.unitBtn, newItemUnit === u && styles.unitBtnActive]} onPress={() => setNewItemUnit(u)}>
                    <Text style={[styles.unitBtnText, newItemUnit === u && styles.unitBtnTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Purchase Cost (₹)</Text>
              <TextInput style={styles.input} placeholderTextColor="#6b7280" placeholder="0.00" value={newItemCost} onChangeText={setNewItemCost} keyboardType="decimal-pad" />

              <Text style={styles.label}>Sell Price (₹)</Text>
              <TextInput style={styles.input} placeholderTextColor="#6b7280" placeholder="0.00" value={newItemPrice} onChangeText={setNewItemPrice} keyboardType="decimal-pad" />

              <Text style={styles.label}>Opening Quantity</Text>
              <TextInput style={styles.input} placeholderTextColor="#6b7280" placeholder="0" value={newItemStock} onChangeText={setNewItemStock} keyboardType="decimal-pad" />

              <TouchableOpacity style={styles.saveBtn} onPress={handleAddItem}>
                <Text style={styles.saveBtnText}>Save Item</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: Spacing.md,
    backgroundColor: Colors.primary,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    fontSize: FontSize.md,
  },
  addBtn: {
    backgroundColor: Colors.success,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FontSize.md,
  },
  listContent: {
    padding: Spacing.md,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  stockInfo: {
    alignItems: 'flex-end',
    paddingLeft: Spacing.md,
  },
  stockText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.success,
  },
  negativeStock: {
    color: Colors.danger,
  },
  stockLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  emptyState: {
    marginTop: 60,
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateSubText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  modalClose: {
    fontSize: 24,
    color: Colors.textSecondary,
    padding: 4,
  },
  modalForm: {
    paddingBottom: 40,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  unitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  unitBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  unitBtnText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  unitBtnTextActive: {
    color: '#fff',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: 20,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
