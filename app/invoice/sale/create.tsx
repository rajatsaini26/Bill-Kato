import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import { createSaleInvoice, updateSaleInvoice, getSaleInvoiceById, getCustomerSuggestions } from '../../../db/queries/sales';
import { toStorableDate, toDisplayDate } from '../../../utils/dateFormat';
import { nextInvoiceNumber } from '../../../utils/invoiceNumber';
import { calcLineTotals } from '../../../utils/pnl';
import { buildSaleInvoiceHTML } from '../../../services/pdfTemplate';
import { generateAndShareSalePDF } from '../../../services/shareInvoice';
import { db } from '../../../db/client';
import DateTimePicker from '@react-native-community/datetimepicker';

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function CreateSaleInvoiceScreen() {
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId: string }>();
  
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [taxPct, setTaxPct] = useState('0');
  const [amountPaid, setAmountPaid] = useState('');
  const [invoiceType, setInvoiceType] = useState<'sale' | 'return'>('sale');
  
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number>(0);
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  
  const [invoiceDate, setInvoiceDate] = useState(toStorableDate());
  const [showDatePicker, setShowDatePicker] = useState(false);
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
          setInvoiceType(inv.invoice_type as 'sale' | 'return' || 'sale');
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

  const addItem = () => {
    setItems([...items, emptyItem()]);
    setEditingItemIndex(items.length);
  };
  
  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
    if (editingItemIndex === index) {
      setEditingItemIndex(Math.max(0, index - 1));
    } else if (editingItemIndex > index) {
      setEditingItemIndex(editingItemIndex - 1);
    }
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
      const finalAmountPaid = parseFloat(amountPaid) || 0;
      let derivedPaymentStatus = 'Unpaid';
      if (finalAmountPaid >= grandTotal) derivedPaymentStatus = 'Paid';
      else if (finalAmountPaid > 0) derivedPaymentStatus = 'Partial';
      
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
        status: derivedPaymentStatus.toLowerCase(),
        amount_paid: finalAmountPaid,
        payment_status: derivedPaymentStatus,
        invoice_type: invoiceType,
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
        const html = await buildSaleInvoiceHTML(full as any, shop);
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
    id, invoice_number: invoiceNumber, customer_name: customerName, customer_phone: customerPhone,
    invoice_date: invoiceDate, subtotal, discount_amount: totalDiscount, tax_amount: taxAmt,
    total: grandTotal, notes,
    status: (finalAmountPaid >= grandTotal ? 'paid' : finalAmountPaid > 0 ? 'partial' : 'unpaid'),
    amount_paid: finalAmountPaid,
    payment_status: (finalAmountPaid >= grandTotal ? 'Paid' : finalAmountPaid > 0 ? 'Partial' : 'Unpaid'),
    invoice_type: invoiceType, pdf_uri: '', created_at: invoiceDate,
  });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        
        {/* Type Toggle */}
        <View style={styles.typeRow}>
          <TouchableOpacity onPress={() => setInvoiceType('sale')} style={[styles.typeBtn, invoiceType === 'sale' && styles.typeBtnActiveSale]}>
            <Ionicons name="receipt-outline" size={16} color={invoiceType === 'sale' ? '#fff' : Colors.textSecondary} />
            <Text style={[styles.typeBtnText, invoiceType === 'sale' && { color: '#fff' }]}>Standard Sale</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setInvoiceType('return')} style={[styles.typeBtn, invoiceType === 'return' && styles.typeBtnActiveReturn]}>
            <Ionicons name="return-down-back" size={16} color={invoiceType === 'return' ? '#fff' : Colors.textSecondary} />
            <Text style={[styles.typeBtnText, invoiceType === 'return' && { color: '#fff' }]}>Return Bill</Text>
          </TouchableOpacity>
        </View>

        <Section title="Customer Details">
          <View style={{ zIndex: 10 }}>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput 
                style={styles.inputWithIcon} 
                placeholderTextColor={Colors.textMuted} 
                placeholder="Customer Name (optional)" 
                value={customerName} 
                onChangeText={handleCustomerNameChange} 
              />
            </View>
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
          
          <View style={styles.inputWrap}>
            <Ionicons name="call-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput 
              style={styles.inputWithIcon} 
              placeholderTextColor={Colors.textMuted} 
              placeholder="Phone Number (optional)" 
              value={customerPhone} 
              onChangeText={setCustomerPhone} 
              keyboardType="phone-pad" 
            />
          </View>
          
          <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(true)}>
            <View style={styles.dateSelectorLeft}>
              <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} />
              <Text style={styles.dateLabel}>Invoice Date</Text>
            </View>
            <Text style={styles.dateValue}>{toDisplayDate(invoiceDate)}</Text>
          </TouchableOpacity>
          
          {showDatePicker && (
            <DateTimePicker
              value={new Date(invoiceDate)}
              mode="date" display="default"
              onValueChange={(_, date) => {
                setShowDatePicker(false);
                if (date) setInvoiceDate(toStorableDate(date));
              }}
              onDismiss={() => setShowDatePicker(false)}
            />
          )}
        </Section>

        <Section title="Items">
          {items.map((item, index) => {
            const suggestions = inventory.filter(inv => inv.item_name.toLowerCase().includes(item.item_name.toLowerCase()) && item.item_name.length > 0 && inv.item_name !== item.item_name);
            const isEditing = editingItemIndex === index;
            
            if (!isEditing) {
              return (
                <TouchableOpacity key={index} style={styles.compactItemCard} onPress={() => setEditingItemIndex(index)}>
                  <View style={styles.compactItemInfo}>
                    <Text style={styles.compactItemName}>{item.item_name || `Item ${index + 1} (Empty)`}</Text>
                    <Text style={styles.compactItemMeta}>
                      {item.quantity || '0'} {item.unit} × ₹{item.unit_price || '0'}
                      {parseFloat(item.discount_pct) > 0 ? `  •  Disc: ${item.discount_pct}%` : ''}
                    </Text>
                  </View>
                  <View style={styles.compactItemRight}>
                    <Text style={styles.compactItemTotal}>
                      ₹{calcLineTotals(parseFloat(item.quantity) || 0, parseFloat(item.unit_price) || 0, parseFloat(item.discount_pct) || 0).toFixed(2)}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </View>
                </TouchableOpacity>
              );
            }

            return (
              <View key={index} style={styles.editorCard}>
                <View style={styles.editorHeader}>
                  <Text style={styles.editorTitle}>Editing Item {index + 1}</Text>
                  <View style={styles.editorActions}>
                    {items.length > 1 && (
                      <TouchableOpacity onPress={() => removeItem(index)} style={styles.iconBtn}>
                        <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => setEditingItemIndex(-1)} style={styles.doneBtn}>
                      <Text style={styles.doneBtnText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                <TextInput 
                  style={styles.input} 
                  placeholderTextColor={Colors.textMuted} 
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
                  <TextInput style={[styles.input, styles.flex1]} placeholderTextColor={Colors.textMuted} placeholder="Qty *" value={item.quantity} onChangeText={(v) => updateItem(index, 'quantity', v)} keyboardType="decimal-pad" />
                  <View style={{ width: Spacing.sm }} />
                  <TextInput style={[styles.input, styles.flex1]} placeholderTextColor={Colors.textMuted} placeholder="Unit (e.g. kg, pcs)" value={item.unit} onChangeText={(v) => updateItem(index, 'unit', v)} />
                </View>

                <View style={styles.row}>
                  <TextInput style={[styles.input, styles.flex1]} placeholderTextColor={Colors.textMuted} placeholder="Unit Price ₹ *" value={item.unit_price} onChangeText={(v) => updateItem(index, 'unit_price', v)} keyboardType="decimal-pad" />
                  <View style={{ width: Spacing.sm }} />
                  <TextInput style={[styles.input, styles.flex1]} placeholderTextColor={Colors.textMuted} placeholder="Cost Price ₹" value={item.cost_price} onChangeText={(v) => updateItem(index, 'cost_price', v)} keyboardType="decimal-pad" />
                </View>

                <View style={styles.row}>
                  <TextInput style={[styles.input, styles.flex1]} placeholderTextColor={Colors.textMuted} placeholder="Discount %" value={item.discount_pct} onChangeText={(v) => updateItem(index, 'discount_pct', v)} keyboardType="decimal-pad" />
                </View>

                <View style={styles.lineTotalBox}>
                  <Text style={styles.lineTotalLabel}>Line Total</Text>
                  <Text style={styles.lineTotalValue}>
                    ₹{calcLineTotals(parseFloat(item.quantity) || 0, parseFloat(item.unit_price) || 0, parseFloat(item.discount_pct) || 0).toFixed(2)}
                  </Text>
                </View>
              </View>
            );
          })}
          
          <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
            <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
            <Text style={styles.addItemText}>Add Another Item</Text>
          </TouchableOpacity>
        </Section>

        <Section title="Totals & Taxes">
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>₹{subtotal.toFixed(2)}</Text>
          </View>
          {totalDiscount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Discount</Text>
              <Text style={[styles.totalValue, { color: Colors.danger }]}>- ₹{totalDiscount.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.taxRow}>
            <Text style={styles.totalLabel}>Tax Rate (%)</Text>
            <TextInput style={styles.taxInput} value={taxPct} onChangeText={setTaxPct} keyboardType="decimal-pad" placeholder="0" />
            <Text style={styles.totalValue}>₹{taxAmt.toFixed(2)}</Text>
          </View>
          <View style={styles.grandTotalBox}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalValue}>₹{grandTotal.toFixed(2)}</Text>
          </View>
        </Section>

        <Section title="Payment & Notes">
          <Text style={styles.fieldLabel}>{invoiceType === 'return' ? 'Refund Amount Given (₹)' : 'Amount Received (₹)'}</Text>
          <TextInput 
            style={[styles.paymentInput, invoiceType === 'return' && { borderColor: Colors.danger, color: Colors.danger, backgroundColor: Colors.dangerLight }]} 
            placeholderTextColor={Colors.textMuted} 
            placeholder={invoiceType === 'return' ? '0.00 — refund paid to customer' : '0.00'} 
            value={amountPaid} 
            onChangeText={setAmountPaid} 
            keyboardType="decimal-pad" 
          />
          
          <View style={styles.balanceBox}>
            <View>
              <Text style={styles.balanceLabel}>{invoiceType === 'return' ? 'Outstanding Refund' : 'Balance Due'}</Text>
              <Text style={[styles.balanceValue, { color: Math.max(0, grandTotal - (parseFloat(amountPaid) || 0)) > 0 ? Colors.danger : Colors.success }]}>
                ₹{Math.max(0, grandTotal - (parseFloat(amountPaid) || 0)).toFixed(2)}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: (parseFloat(amountPaid) || 0) >= grandTotal ? Colors.successLight : (parseFloat(amountPaid) || 0) > 0 ? Colors.warningLight : Colors.dangerLight }]}>
              <Text style={[styles.statusPillText, { color: (parseFloat(amountPaid) || 0) >= grandTotal ? Colors.success : (parseFloat(amountPaid) || 0) > 0 ? Colors.warning : Colors.danger }]}>
                {(parseFloat(amountPaid) || 0) >= grandTotal
                  ? (invoiceType === 'return' ? 'REFUNDED' : 'PAID')
                  : (parseFloat(amountPaid) || 0) > 0 ? 'PARTIAL' : (invoiceType === 'return' ? 'PENDING' : 'UNPAID')}
              </Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Notes / Terms</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholderTextColor={Colors.textMuted}
            placeholder="Optional notes for customer"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </Section>

      </ScrollView>

      {/* Floating Action Bar */}
      <View style={styles.fabBar}>
        <TouchableOpacity style={styles.btnOutline} onPress={() => save(false)} disabled={loading}>
          {loading ? <ActivityIndicator color={Colors.primary} /> : <Text style={styles.btnOutlineText}>Save Only</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => save(true)} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="share-social-outline" size={18} color="#fff" />
              <Text style={styles.btnPrimaryText}>Save & Share</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  
  typeRow: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.sm },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  typeBtnActiveSale: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeBtnActiveReturn: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  typeBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textSecondary },

  section: { backgroundColor: Colors.surface, marginHorizontal: Spacing.md, marginBottom: Spacing.md, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  sectionTitle: { fontFamily: FontFamily.extraBold, fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: Spacing.md },
  
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.background, marginBottom: Spacing.sm },
  inputIcon: { paddingLeft: 14, paddingRight: 8 },
  inputWithIcon: { flex: 1, paddingVertical: 12, paddingRight: 14, fontSize: FontSize.sm, fontFamily: FontFamily.medium, color: Colors.textPrimary },
  
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: FontSize.sm, fontFamily: FontFamily.medium, color: Colors.textPrimary, backgroundColor: Colors.background, marginBottom: Spacing.sm },
  fieldLabel: { fontFamily: FontFamily.semiBold, fontSize: 11, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: Spacing.xs },
  
  dateSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.background },
  dateSelectorLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  dateValue: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.primary },
  
  compactItemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  compactItemInfo: { flex: 1 },
  compactItemName: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textPrimary },
  compactItemMeta: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },
  compactItemRight: { alignItems: 'flex-end', flexDirection: 'row', gap: 8 },
  compactItemTotal: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.primary },
  
  editorCard: { borderWidth: 1.5, borderColor: Colors.primaryLight, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, backgroundColor: Colors.surface, zIndex: 1 },
  editorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  editorTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  editorActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconBtn: { padding: 4 },
  doneBtn: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill },
  doneBtnText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#fff' },
  lineTotalBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.primaryLight, padding: 12, borderRadius: Radius.md, marginTop: 4 },
  lineTotalLabel: { fontFamily: FontFamily.semiBold, fontSize: FontSize.xs, color: Colors.primary },
  lineTotalValue: { fontFamily: FontFamily.extraBold, fontSize: FontSize.md, color: Colors.primary },
  
  row: { flexDirection: 'row' },
  flex1: { flex: 1 },
  
  addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed' },
  addItemText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.primary },
  
  suggestionsContainer: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm, marginTop: -Spacing.xs, ...Shadow.md },
  suggestionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, flexDirection: 'row', justifyContent: 'space-between' },
  suggestionText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textPrimary },
  suggestionSubText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },
  
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  totalLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  totalValue: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textPrimary },
  taxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  taxInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: 4, paddingHorizontal: 8, width: 70, textAlign: 'center', fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  grandTotalBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surfaceAlt, padding: Spacing.md, borderRadius: Radius.md, marginTop: Spacing.sm },
  grandTotalLabel: { fontFamily: FontFamily.extraBold, fontSize: FontSize.md, color: Colors.textPrimary },
  grandTotalValue: { fontFamily: FontFamily.extraBold, fontSize: FontSize.xl, color: Colors.primary },
  
  paymentInput: { borderWidth: 2, borderColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 14, fontSize: FontSize.lg, fontFamily: FontFamily.bold, color: Colors.primary, backgroundColor: Colors.primaryLight, marginBottom: Spacing.md },
  balanceBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  balanceLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },
  balanceValue: { fontFamily: FontFamily.extraBold, fontSize: FontSize.lg },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  statusPillText: { fontFamily: FontFamily.bold, fontSize: 10 },
  
  fabBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: Colors.surface, padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, ...Shadow.lg, gap: Spacing.sm },
  btnOutline: { flex: 1, paddingVertical: 14, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  btnOutlineText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.primary },
  btnPrimary: { flex: 2, flexDirection: 'row', gap: 8, paddingVertical: 14, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },
});
