import React, { useState } from 'react';
import { Tabs, useRouter } from 'react-native-router-flux'; // wait expo-router
import { TouchableOpacity, Text, View, StyleSheet, Modal, TouchableWithoutFeedback } from 'react-native';
import { useRouter as useExpoRouter } from 'expo-router';
import { Colors } from '../../constants/theme';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    home: '🏠',
    receipt: '🧾',
    cart: '🛒',
    chart: '📊',
    box: '📦',
  };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.7 }}>{icons[name] ?? '●'}</Text>
  );
}

export default function TabsLayout() {
  const router = useExpoRouter();
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarStyle: { backgroundColor: Colors.primary },
          tabBarActiveTintColor: '#ffffff',
          tabBarInactiveTintColor: '#93C5FD',
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon name="home" focused={focused} />,
            headerRight: () => (
              <TouchableOpacity onPress={() => router.push('/settings')} style={{ marginRight: 16 }}>
                <Text style={{ color: '#fff', fontSize: 20 }}>⚙️</Text>
              </TouchableOpacity>
            ),
          }}
        />
        <Tabs.Screen
          name="sales"
          options={{
            title: 'Sales',
            tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon name="receipt" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="purchases"
          options={{
            title: 'Purchases',
            tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon name="cart" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: 'Inventory',
            tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon name="box" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: 'Reports',
            tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon name="chart" focused={focused} />,
          }}
        />
      </Tabs>

      {/* Global FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setMenuVisible(true)}
      >
        <Text style={styles.fabIcon}>＋</Text>
      </TouchableOpacity>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.overlay}>
            <View style={styles.menuContainer}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { setMenuVisible(false); router.push('/invoice/sale/create'); }}
              >
                <Text style={styles.menuIcon}>🧾</Text>
                <Text style={styles.menuText}>New Sale</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomWidth: 0 }]}
                onPress={() => { setMenuVisible(false); router.push('/invoice/purchase/create'); }}
              >
                <Text style={styles.menuIcon}>🛒</Text>
                <Text style={styles.menuText}>New Purchase</Text>
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
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginRight: 20,
    marginBottom: 150,
    width: 200,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
});
