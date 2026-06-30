import React, { useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import {
  TouchableOpacity, Text, View, StyleSheet, Modal,
  TouchableWithoutFeedback, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, Radius, Shadow } from '../../constants/theme';
import { useAppStore } from '../../store/useAppStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TabIcon({ name, focused }: { name: React.ComponentProps<typeof Ionicons>['name']; focused: boolean }) {
  return (
    <Ionicons
      name={name}
      size={22}
      color={focused ? Colors.primary : Colors.textMuted}
    />
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const shopName = useAppStore((s) => s.shopName);
  const [menuVisible, setMenuVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const rotateAnim = React.useRef(new Animated.Value(0)).current;

  const openMenu = () => {
    setMenuVisible(true);
    Animated.spring(rotateAnim, { toValue: 1, useNativeDriver: true, damping: 15 }).start();
  };
  const closeMenu = () => {
    Animated.spring(rotateAnim, { toValue: 0, useNativeDriver: true, damping: 15 }).start(() =>
      setMenuVisible(false)
    );
  };

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: Colors.surface,
            borderTopWidth: 1,
            borderTopColor: Colors.border,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 8,
            ...Shadow.md,
          },
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarLabelStyle: {
            fontSize: 10,
            fontFamily: FontFamily.semiBold,
            marginTop: 2,
          },
          headerStyle: { backgroundColor: Colors.primary, ...Shadow.md },
          headerTintColor: '#fff',
          headerTitleStyle: { fontFamily: FontFamily.bold, fontSize: 17 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: shopName || 'Dashboard',
            tabBarLabel: 'Home',
            tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />,
            headerRight: () => (
              <TouchableOpacity onPress={() => router.push('/settings')} style={{ marginRight: 16 }}>
                <Ionicons name="settings-outline" size={22} color="#fff" />
              </TouchableOpacity>
            ),
          }}
        />
        <Tabs.Screen
          name="sales"
          options={{
            title: 'Sales',
            tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'receipt' : 'receipt-outline'} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="purchases"
          options={{
            title: 'Purchases',
            tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'cart' : 'cart-outline'} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: 'Inventory',
            tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'cube' : 'cube-outline'} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: 'Reports',
            tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'bar-chart' : 'bar-chart-outline'} focused={focused} />,
          }}
        />
      </Tabs>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openMenu} activeOpacity={0.9}>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name="add" size={28} color="#fff" />
        </Animated.View>
      </TouchableOpacity>

      <Modal visible={menuVisible} transparent animationType="none" onRequestClose={closeMenu}>
        <TouchableWithoutFeedback onPress={closeMenu}>
          <View style={styles.overlay}>
            <View style={[styles.menuContainer, { bottom: 60 + insets.bottom + 16 }]}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { closeMenu(); setTimeout(() => router.push('/invoice/sale/create'), 200); }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: Colors.primaryLight }]}>
                  <Ionicons name="receipt-outline" size={18} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.menuTitle}>New Sale</Text>
                  <Text style={styles.menuSub}>Create a sale invoice</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { closeMenu(); setTimeout(() => router.push('/invoice/purchase/create'), 200); }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: Colors.successLight }]}>
                  <Ionicons name="cart-outline" size={18} color={Colors.success} />
                </View>
                <View>
                  <Text style={[styles.menuTitle, { color: Colors.success }]}>New Purchase</Text>
                  <Text style={styles.menuSub}>Record a purchase bill</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.lg,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  menuContainer: {
    position: 'absolute',
    right: 16,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    width: 240,
    overflow: 'hidden',
    ...Shadow.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    fontSize: 14,
    fontFamily: FontFamily.bold,
    color: Colors.primary,
  },
  menuSub: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
});
