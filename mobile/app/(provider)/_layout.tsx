import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BASE_OPTIONS, TAB_BAR_BASE_STYLE } from '../../src/constants/theme';

export default function ProviderLayout() {
  const insets = useSafeAreaInsets();
  const tabBarStyle = {
    ...TAB_BAR_BASE_STYLE,
    height:        56 + insets.bottom,
    paddingBottom: insets.bottom + 4,
    paddingTop:    4,
  };

  return (
    <Tabs screenOptions={{ ...TAB_BASE_OPTIONS, tabBarStyle }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'الطلبات',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🔍</Text>,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'أعمالي',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🛠️</Text>,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'الرسائل',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>💬</Text>,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'إحصائياتي',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'ملفي',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>👤</Text>,
        }}
      />
    </Tabs>
  );
}
