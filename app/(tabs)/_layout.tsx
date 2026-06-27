import { Tabs, useRouter } from 'expo-router';
import { TouchableOpacity, Text } from 'react-native';
import { Colors } from '../../constants/theme';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    home: '🏠',
    receipt: '🧾',
    cart: '🛒',
    chart: '📊',
  };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.7 }}>{icons[name] ?? '●'}</Text>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  return (
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
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              style={{ marginRight: 16 }}
            >
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
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/invoice/sale/create')}
              style={{ marginRight: 16 }}
            >
              <Text style={{ color: '#fff', fontSize: 24 }}>＋</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="purchases"
        options={{
          title: 'Purchases',
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon name="cart" focused={focused} />,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/invoice/purchase/create')}
              style={{ marginRight: 16 }}
            >
              <Text style={{ color: '#fff', fontSize: 24 }}>＋</Text>
            </TouchableOpacity>
          ),
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
  );
}
