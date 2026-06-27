import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, FlatList
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, FontSize } from '../../../constants/theme';
import { createSaleInvoice, updateSaleInvoice, getSaleInvoiceById, getCustomerSuggestions } from '../../../db/queries/sales';
import { toStorableDate, toDisplayDate } from '../../../utils/dateFormat';
import { nextInvoiceNumber } from '../../../utils/invoiceNumber';
import { calcLineTotals } from '../../../utils/pnl';
import { buildSaleInvoiceHTML } from '../../../services/pdfTemplate';
import { generateAndShareSalePDF } from '../../../services/shareInvoice';
import { db } from '../../../db/client';

interface Item {
  item_name: string;
  quantity: string;
  unit: string;
  unit_price: string;
  cost_price: string;
  discount_pct: string;
}

interface InventoryItem {
  id: number;
  item_name: string;
  unit: string;
  default_price: number;
}

const emptyItem = (): Item => ({
  item_name: '', quantity: '', unit: 'pcs', unit_price: '', cost_price: '', discount_pct: '0',
});

export default function CreateSaleInvoiceScreen() {
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId: string }>();
  
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [taxPct, setTaxPct] = useState('0');
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Unpaid' | 'Partial'>('Paid');
  const [amountPaid, setAmountPaid] = useState('');
  
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  
  const [invoiceDate, setInvoiceDate] = useState(toStorableDate());
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('');

  useEffect(() => {
    try {
      const result = db.getAllSync<InventoryItem>(`SELECT * FROM inventory_items`);
      setInventory(result);

      if (editId) {
        const inv = getSaleInvoiceById(Number(editId));
        if (inv) {
          setEditInvoiceNumber(inv.invoice_number);
          setCustomerName(inv.customer_name);
          setCustomerPhone(inv.customer_phone);
          setInvoiceDate(inv.invoice_date);
          setNotes(inv.notes);
          setPaymentStatus(inv.payment_status as any || 'Paid');
          setAmountPaid(inv.amount_paid > 0 ? inv.amount_paid.toString() : '');
          setTaxPct(inv.subtotal > 0 ? ((inv.tax_amount / inv.subtotal) * 100).toFixed(2).replace(/\.00$/, '') : '0');
          setItems(inv.items.map(i => ({
            item_name: i.item_name,
            quantity: i.quantity.toString(),
            unit: i.unit,
            unit_price: i.unit_price.toString(),
            cost_price: i.cost_price.toString(),
            discount_pct: i.discount_pct.toString(),
          })));
        }
      }
    } catch (e) {
      console.log('Error loading data', e);
    }
  }, [editId]);

  const handleCustomerNameChange = (val: string) => {
    setCustomerName(val);
    if (val.length > 1) {
      setCustomerSuggestions(getCustomerSuggestions(val));
      setShowCustomerSuggestions(true);
    } else {
      setShowCustomerSuggestions(false);
    }
  };

  const selectCustomer = (name: string) => {
    setCustomerName(name);
    setShowCustomerSuggestions(false);
  };

  const updateItem = (index: number, field: keyof Item, value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const selectSuggestedItem = (index: number, invItem: InventoryItem) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      item_name: invItem.item_name,
      unit: invItem.unit,
      unit_price: invItem.default_price.toString(),
    };
    setItems(updated);
    setFocusedItemIndex(null);
  };

  const addItem = () => setItems([...items, emptyItem()]);
  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const computedItems = items.map((item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    const disc = parseFloat(item.discount_pct) || 0;
    const cost = parseFloat(item.cost_price) || 0;
    return { ...item, qty, price, disc, cost, lineTotal: calcLineTotals(qty, price, disc) };
  });

  const subtotal = computedItems.reduce((s, i) => s + i.lineTotal, 0);
  const totalDiscount = computedItems.reduce((s, i) => s + (i.qty * i.price * i.disc / 100), 0);
  const taxAmt = subtotal * (parseFloat(taxPct) || 0) / 100;
  const grandTotal = subtotal + taxAmt;

  const validate = () => {
    if (items.length === 0) { Alert.alert('Error', 'Add at least one item'); return false; }
    for (const [i, item] of items.entries()) {
      if (!item.item_name.trim()) { Alert.alert('Error', `Item ${i + 1} name is required`); return false; }
      if (!item.quantity || parseFloat(item.quantity) <= 0) { Alert.alert('Error', `Item ${i + 1} quantity must be > 0`); return false; }
      if (!item.unit_price || parseFloat(item.unit_price) < 0) { Alert.alert('Error', `Item ${i + 1} price is required`); return false; }
    }
    return true;
  };

  const getShop = () => {
    return db.getFirstSync<any>(`SELECT * FROM shop_profile WHERE id = 1`) ?? {
      id: 1, name: 'My Shop', address: '', phone: '', gstin: '', currency: 'INR',
    };
  };

  const save = async (share: boolean) => {
    if (!validate()) return;
    setLoading(true);
    try {
      const invoiceNumber = editId ? editInvoiceNumber : nextInvoiceNumber('SALE');
      const finalAmountPaid = paymentStatus === 'Paid' ? grandTotal : paymentStatus === 'Unpaid' ? 0 : parseFloat(amountPaid) || 0;
      
      const itemsData = computedItems.map((i) => ({
        item_name: i.item_name,
        quantity: i.qty,
        unit: i.unit,
        unit_price: i.price,
        discount_pct: i.disc,
        line_total: i.lineTotal,
        cost_price: i.cost,
      }));
      
      const payload = {
        invoice_number: invoiceNumber,
        customer_name: customerName,
        customer_phone: customerPhone,
        invoice_date: invoiceDate,
        subtotal,
        discount_amount: totalDiscount,
        tax_amount: taxAmt,
        total: grandTotal,
        notes,
        status: paymentStatus.toLowerCase(),
        amount_paid: finalAmountPaid,
        payment_status: paymentStatus,
        items: itemsData,
      };

      let id = Number(editId);
      if (editId) {
        updateSaleInvoice(id, payload);
      } else {
        id = createSaleInvoice(payload);
      }
      
      if (share) {
        const full = { ...getInvoiceForPdf(id, invoiceNumber, finalAmountPaid), items: itemsData.map((it, idx) => ({ ...it, id: idx, invoice_id: id })) };
        const shop = getShop();
        const html = buildSaleInvoiceHTML(full as any, shop);
        try {
          await generateAndShareSalePDF(html, id);
        } catch (e: any) {
          Alert.alert('PDF Error', e.message);
        }
      }
      router.replace('/(tabs)/sales');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const getInvoiceForPdf = (id: number, invoiceNumber: string, finalAmountPaid: number) => ({
    id,
    invoice_number: invoiceNumber,
    customer_name: customerName,
    customer_phone: customerPhone,
    invoice_date: invoiceDate,
    subtotal,
    discount_amount: totalDiscount,
    tax_amount: taxAmt,
    total: grandTotal,
    notes,
    status: paymentStatus.toLowerCase(),
    amount_paid: finalAmountPaid,
    payment_status: paymentStatus,
    pdf_uri: '',
    created_at: invoiceDate,
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      {/* Customer Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Customer Details</Text>
        <View style={{ zIndex: 10 }}>
          <TextInput 
            style={styles.input} 
            placeholderTextColor="#000000" 
            placeholder="Customer Name (optional)" 
            value={customerName} 
            onChangeText={handleCustomerNameChange} 
          />
          {showCustomerSuggestions && customerSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {customerSuggestions.map(sugg => (
                <TouchableOpacity key={sugg} style={styles.suggestionItem} onPress={() => selectCustomer(sugg)}>
                  <Text style={styles.suggestionText}>{sugg}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <TextInput style={styles.input} placeholderTextColor="#000000" placeholder="Customer Phone (optional)" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" />
        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>Invoice Date:</Text>
          <Text style={styles.dateValue}>{toDisplayDate(invoiceDate)}</Text>
        </View>
      </View>

      {/* Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items</Text>
        {items.map((item, index) => {
          const suggestions = inventory.filter(inv => inv.item_name.toLowerCase().includes(item.item_name.toLowerCase()) && item.item_name.length > 0 && inv.item_name !== item.item_name);
          return (
            <View key={index} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemIndex}>Item {index + 1}</Text>
                {items.length > 1 && (
                  <TouchableOpacity onPress={() => removeItem(index)}>
                    <Text style={{ color: Colors.danger, fontSize: 18 }}>🗑</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <TextInput 
                style={styles.input} 
                placeholderTextColor="#000000" 
                placeholder="Item Name *" 
                value={item.item_name} 
                onChangeText={(v) => updateItem(index, 'item_name', v)} 
                onFocus={() => setFocusedItemIndex(index)}
                onBlur={() => setTimeout(() => setFocusedItemIndex(null), 200)}
              />
              
              {focusedItemIndex === index && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {suggestions.slice(0, 3).map(sugg => (
                    <TouchableOpacity key={sugg.id} style={styles.suggestionItem} onPress={() => selectSuggestedItem(index, sugg)}>
                      <Text style={styles.suggestionText}>{sugg.item_name}</Text>
                      <Text style={styles.suggestionSubText}>₹{sugg.default_price} | {sugg.unit}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.row}>
                <TextInput style={[styles.input, styles.flex1]} placeholderTextColor="#000000" placeholder="Qty *" value={item.quantity} onChangeText={(v) => updateItem(index, 'quantity', v)} keyboardType="decimal-pad" />
                <TextInput style={[styles.input, styles.flex1]} placeholderTextColor="#000000" placeholder="Unit" value={item.unit} onChangeText={(v) => updateItem(index, 'unit', v)} />
              </View>
              <View style={styles.row}>
                <TextInput style={[styles.input, styles.flex1]} placeholderTextColor="#000000" placeholder="Unit Price ₹ *" value={item.unit_price} onChangeText={(v) => updateItem(index, 'unit_price', v)} keyboardType="decimal-pad" />
                <TextInput style={[styles.input, styles.flex1]} placeholderTextColor="#000000" placeholder="Cost/Buy Price ₹" value={item.cost_price} onChangeText={(v) => updateItem(index, 'cost_price', v)} keyboardType="decimal-pad" />
              </View>
              <TextInput style={styles.input} placeholderTextColor="#000000" placeholder="Discount %" value={item.discount_pct} onChangeText={(v) => updateItem(index, 'discount_pct', v)} keyboardType="decimal-pad" />
              <Text style={styles.lineTotal}>
                Line Total: ₹{calcLineTotals(parseFloat(item.quantity) || 0, parseFloat(item.unit_price) || 0, parseFloat(item.discount_pct) || 0).toFixed(2)}
              </Text>
            </View>
          );
        })}
        <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
          <Text style={styles.addItemText}>＋ Add Item</Text>
        </TouchableOpacity>
      </View>

      {/* Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notes</Text>
        <TextInput
          style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
          placeholderTextColor="#000000"
          placeholder="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </View>

      {/* Totals */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Totals</Text>
        <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>₹{subtotal.toFixed(2)}</Text></View>
        <View style={styles.totalRow}><Text style={styles.totalLabel}>Total Discount</Text><Text style={[styles.totalValue, { color: Colors.danger }]}>- ₹{totalDiscount.toFixed(2)}</Text></View>
        <View style={styles.taxRow}>
          <Text style={styles.totalLabel}>Tax %</Text>
          <TextInput style={styles.taxInput} value={taxPct} onChangeText={setTaxPct} keyboardType="decimal-pad" />
          <Text style={styles.totalValue}>₹{taxAmt.toFixed(2)}</Text>
        </View>
        <View style={[styles.totalRow, styles.grandTotalRow]}>
          <Text style={styles.grandTotalLabel}>Grand Total</Text>
          <Text style={styles.grandTotalValue}>₹{grandTotal.toFixed(2)}</Text>
        </View>
      </View>

      {/* Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Status</Text>
        <View style={styles.statusRow}>
          {(['Paid', 'Unpaid', 'Partial'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setPaymentStatus(s)}
              style={[styles.statusBtn, paymentStatus === s && statusBtnActive(s)]}
            >
              <Text style={[styles.statusBtnText, paymentStatus === s && { color: '#fff' }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {paymentStatus === 'Partial' && (
          <View style={{ marginTop: Spacing.sm }}>
            <TextInput 
              style={[styles.input, { borderColor: Colors.warning, borderWidth: 1.5 }]} 
              placeholderTextColor="#000000" 
              placeholder="Amount Paid ₹" 
              value={amountPaid} 
              onChangeText={setAmountPaid} 
              keyboardType="decimal-pad" 
            />
          </View>
        )}
      </View>

      {/* Buttons */}
      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.btnSave} onPress={() => save(false)} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Only</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnShare} onPress={() => save(true)} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save & Share PDF</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const statusBtnActive = (s: string) => ({
  backgroundColor: s === 'Paid' ? Colors.success : s === 'Unpaid' ? Colors.danger : Colors.warning,
  borderColor: 'transparent',
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  section: { backgroundColor: Colors.surface, margin: Spacing.md, borderRadius: 12, padding: Spacing.md, elevation: 1 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 10,
    fontSize: FontSize.sm, color: Colors.textPrimary, backgroundColor: Colors.background,
    marginBottom: Spacing.sm,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  dateValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '600' },
  itemCard: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: Spacing.sm, marginBottom: Spacing.sm, backgroundColor: Colors.background, zIndex: 1 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  itemIndex: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  row: { flexDirection: 'row', gap: Spacing.sm },
  flex1: { flex: 1 },
  lineTotal: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary, textAlign: 'right' },
  addItemBtn: { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 8, padding: 10, alignItems: 'center', borderStyle: 'dashed' },
  addItemText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.sm },
  suggestionsContainer: { backgroundColor: '#f9fafb', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: Spacing.sm, marginTop: -Spacing.sm, elevation: 2 },
  suggestionItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', flexDirection: 'row', justifyContent: 'space-between' },
  suggestionText: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '600' },
  suggestionSubText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  totalValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  taxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  taxInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 6, padding: 4, width: 60, textAlign: 'center', fontSize: FontSize.sm },
  grandTotalRow: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 6, paddingTop: 6 },
  grandTotalLabel: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  grandTotalValue: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.primary },
  statusRow: { flexDirection: 'row', gap: Spacing.sm },
  statusBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border },
  statusBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  btnRow: { flexDirection: 'row', gap: Spacing.sm, margin: Spacing.md },
  btnSave: { flex: 1, backgroundColor: Colors.textSecondary, borderRadius: 10, padding: Spacing.md, alignItems: 'center' },
  btnShare: { flex: 1, backgroundColor: Colors.primary, borderRadius: 10, padding: Spacing.md, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
});
