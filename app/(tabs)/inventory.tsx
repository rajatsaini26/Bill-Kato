import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors, Spacing, FontSize } from '../../constants/theme';
import { db } from '../../db/client';

interface InventoryItem {
  id: number;
  item_name: string;
  unit: string;
  current_stock: number;
  default_price: number;
}

export default function InventoryScreen() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');

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

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [search])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search inventory..."
          placeholderTextColor="#6b7280"
          value={search}
          onChangeText={setSearch}
        />
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
              <Text style={styles.itemMeta}>Unit: {item.unit} • Def Price: ₹{item.default_price.toFixed(2)}</Text>
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
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
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
});
