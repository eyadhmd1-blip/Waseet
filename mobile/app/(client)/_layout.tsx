import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BASE_OPTIONS, TAB_BAR_BASE_STYLE } from '../../src/constants/theme';
import { useLanguage } from '../../src/hooks/useLanguage';

export default function ClientLayout() {
  const insets = useSafeAreaInsets();
  const { isRTL } = useLanguage();
  const tabBarStyle = {
    ...TAB_BAR_BASE_STYLE,
    height:        56 + insets.bottom,
    paddingBottom: insets.bottom + 4,
    paddingTop:    4,
    flexDirection: (isRTL ? 'row-reverse' : 'row') as 'row' | 'row-reverse',
  };

  return (
    <Tabs screenOptions={{ ...TAB_BASE_OPTIONS, tabBarStyle }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="new-request"
        options={{
          title: 'طلب جديد',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>➕</Text>,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'طلباتي',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📋</Text>,
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
        name="profile"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>👤</Text>,
        }}
      />
      {/* Hide non-tab screens from the tab bar */}
      <Tabs.Screen name="saved-providers" options={{ href: null }} />
    </Tabs>
  );
}
