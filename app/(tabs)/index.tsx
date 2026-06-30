import React, { useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Animated, Image,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontFamily, Radius, Shadow } from '../../constants/theme';
import { getDashboardStats } from '../../db/queries/reports';
import { getRecentSaleInvoices, SaleInvoice } from '../../db/queries/sales';
import { getRecentPurchaseInvoices, PurchaseInvoice } from '../../db/queries/purchases';
import { toShortDate } from '../../utils/dateFormat';
import { useAppStore } from '../../store/useAppStore';
import { db } from '../../db/client';

interface DashboardStats {
  todaySales: number;
  todayPurchases: number;
  monthSales: number;
  monthPurchases: number;
  monthProfit: number;
}

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function StatCard({ value, label, color, icon, delay = 0 }: {
  value: string; label: string; color: string; icon: React.ComponentProps<typeof Ionicons>['name']; delay?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  useFocusEffect(useCallback(() => {
    anim.setValue(0); slide.setValue(16);
    Animated.parallel([
      Animated.timing(anim, { toValue: 1, duration: 380, delay, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 380, delay, useNativeDriver: true }),
    ]).start();
  }, []));

  return (
    <Animated.View style={[styles.statCard, { opacity: anim, transform: [{ translateY: slide }] }]}>
      <View style={[styles.statIconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

type ActivityItem =
  | { kind: 'sale'; data: SaleInvoice }
  | { kind: 'purchase'; data: PurchaseInvoice };

export default function DashboardScreen() {
  const router = useRouter();
  const shopName = useAppStore((s) => s.shopName);
  const [stats, setStats] = React.useState<DashboardStats>({
    todaySales: 0, todayPurchases: 0, monthSales: 0, monthPurchases: 0, monthProfit: 0,
  });
  const [activity, setActivity] = React.useState<ActivityItem[]>([]);
  const [logoUri, setLogoUri] = React.useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    try {
      setStats(getDashboardStats());
      const sales = getRecentSaleInvoices(4).map((d): ActivityItem => ({ kind: 'sale', data: d }));
      const purchases = getRecentPurchaseInvoices(4).map((d): ActivityItem => ({ kind: 'purchase', data: d }));
      const merged = [...sales, ...purchases].sort((a, b) => {
        const da = a.kind === 'sale' ? a.data.invoice_date : (a.data as PurchaseInvoice).invoice_date;
        const db2 = b.kind === 'sale' ? b.data.invoice_date : (b.data as PurchaseInvoice).invoice_date;
        return db2.localeCompare(da);
      });
      setActivity(merged);
      const profile = db.getFirstSync<{ logo_uri: string }>(`SELECT logo_uri FROM shop_profile WHERE id = 1`);
      setLogoUri(profile?.logo_uri || null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }, []));

  const cardData: Array<{
    value: string; label: string; color: string; icon: React.ComponentProps<typeof Ionicons>['name']; delay: number;
  }> = [
    { value: fmt(stats.todaySales), label: "Today's Sales", color: Colors.primary, icon: 'trending-up-outline', delay: 0 },
    { value: fmt(stats.monthSales), label: 'Month Sales', color: Colors.accent, icon: 'calendar-outline', delay: 80 },
    {
      value: fmt(stats.monthProfit), label: 'Month Profit',
      color: stats.monthProfit >= 0 ? Colors.success : Colors.danger,
      icon: stats.monthProfit >= 0 ? 'wallet-outline' : 'trending-down-outline', delay: 160,
    },
    { value: fmt(stats.todayPurchases), label: "Today's Purchases", color: Colors.warning, icon: 'cart-outline', delay: 240 },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      {/* Hero Banner */}
      <View style={styles.hero}>
        <View style={styles.heroLeft}>
          <Text style={styles.heroGreeting}>Good day 👋</Text>
          <Text style={styles.heroShop} numberOfLines={1}>{shopName || 'My Business'}</Text>
          <View style={styles.heroSalesBadge}>
            <Text style={styles.heroSalesLabel}>Today's Collection</Text>
            <Text style={styles.heroSalesValue}>{fmt(stats.todaySales)}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings')} style={styles.logoCircle}>
          {logoUri ? (
            <Image source={{ uri: logoUri }} style={styles.logoImg} />
          ) : (
            <View style={styles.logoFallback}>
              <Text style={styles.logoFallbackText}>{(shopName || 'B').charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Stats 2×2 */}
      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          <StatCard {...cardData[0]} />
          <StatCard {...cardData[1]} />
        </View>
        <View style={styles.statsRow}>
          <StatCard {...cardData[2]} />
          <StatCard {...cardData[3]} />
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickRow}>
        <TouchableOpacity style={[styles.quickBtn, { backgroundColor: Colors.primary }]} onPress={() => router.push('/invoice/sale/create')} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.quickBtnText}>New Sale</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickBtn, { backgroundColor: Colors.success }]} onPress={() => router.push('/invoice/purchase/create')} activeOpacity={0.85}>
          <Ionicons name="cart-outline" size={18} color="#fff" />
          <Text style={styles.quickBtnText}>New Purchase</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickBtn, { backgroundColor: Colors.accent }]} onPress={() => router.push('/(tabs)/reports')} activeOpacity={0.85}>
          <Ionicons name="bar-chart-outline" size={18} color="#fff" />
          <Text style={styles.quickBtnText}>Reports</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/sales')}>
            <Text style={styles.sectionLink}>View all</Text>
          </TouchableOpacity>
        </View>

        {activity.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="document-text-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No recent activity</Text>
          </View>
        ) : (
          activity.map((item, idx) => {
            const isSale = item.kind === 'sale';
            const inv = item.data as any;
            return (
              <TouchableOpacity
                key={`${item.kind}-${inv.id}`}
                style={styles.activityCard}
                onPress={() => router.push(isSale ? `/invoice/sale/${inv.id}` : `/invoice/purchase/${inv.id}`)}
                activeOpacity={0.75}
              >
                <View style={[styles.activityIcon, { backgroundColor: isSale ? Colors.primaryLight : Colors.successLight }]}>
                  <Ionicons name={isSale ? 'receipt-outline' : 'cart-outline'} size={16} color={isSale ? Colors.primary : Colors.success} />
                </View>
                <View style={styles.activityMid}>
                  <Text style={styles.activityInvNo}>{inv.invoice_number}</Text>
                  <Text style={styles.activityParty} numberOfLines={1}>
                    {(isSale ? inv.customer_name : inv.vendor_name) || '—'}
                  </Text>
                </View>
                <View style={styles.activityRight}>
                  <Text style={[styles.activityAmount, { color: isSale ? Colors.primary : Colors.success }]}>
                    ₹{inv.total.toFixed(2)}
                  </Text>
                  <Text style={styles.activityDate}>{toShortDate(inv.invoice_date)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  hero: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroLeft: { flex: 1, marginRight: Spacing.md },
  heroGreeting: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)' },
  heroShop: { fontFamily: FontFamily.extraBold, fontSize: FontSize.xl, color: '#fff', marginTop: 2, marginBottom: Spacing.md },
  heroSalesBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  heroSalesLabel: { fontFamily: FontFamily.medium, fontSize: 10, color: 'rgba(255,255,255,0.8)' },
  heroSalesValue: { fontFamily: FontFamily.extraBold, fontSize: FontSize.lg, color: '#fff', marginTop: 2 },

  logoCircle: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', ...Shadow.md },
  logoImg: { width: '100%', height: '100%' },
  logoFallback: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoFallbackText: { fontFamily: FontFamily.extraBold, fontSize: FontSize.xl, color: '#fff' },

  statsGrid: {
    paddingHorizontal: Spacing.md,
    marginTop: -Spacing.lg,
    gap: Spacing.sm,
  },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, ...Shadow.md,
  },
  statIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  statValue: { fontFamily: FontFamily.extraBold, fontSize: FontSize.lg },
  statLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 3 },

  quickRow: {
    flexDirection: 'row', gap: Spacing.sm,
    marginHorizontal: Spacing.md, marginTop: Spacing.md,
  },
  quickBtn: {
    flex: 1, flexDirection: 'column', alignItems: 'center',
    paddingVertical: 12, borderRadius: Radius.md, gap: 4, ...Shadow.sm,
  },
  quickBtnText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#fff' },

  section: { marginHorizontal: Spacing.md, marginTop: Spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.textPrimary },
  sectionLink: { fontFamily: FontFamily.semiBold, fontSize: FontSize.xs, color: Colors.primary },

  emptyBox: { alignItems: 'center', paddingVertical: Spacing.xl, backgroundColor: Colors.surface, borderRadius: Radius.lg, gap: Spacing.sm },
  emptyText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textMuted },

  activityCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, ...Shadow.sm,
  },
  activityIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  activityMid: { flex: 1 },
  activityInvNo: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textSecondary },
  activityParty: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.textPrimary, marginTop: 1 },
  activityRight: { alignItems: 'flex-end' },
  activityAmount: { fontFamily: FontFamily.extraBold, fontSize: FontSize.md },
  activityDate: { fontFamily: FontFamily.medium, fontSize: 10, color: Colors.textMuted, marginTop: 2 },
});
