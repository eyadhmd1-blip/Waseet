import { Tabs } from 'expo-router';
import { Text, View, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeTabBarStyle, makeTabOptions } from '../../src/constants/theme';
import { useLanguage } from '../../src/hooks/useLanguage';
import { useTheme } from '../../src/context/ThemeContext';
import { useTutorial } from '../../src/hooks/useTutorial';
import { OnboardingCarousel } from '../tutorial/carousel';
import { useUnreadMsgCount } from '../../src/hooks/useUnreadMsgCount';

const { width: W } = Dimensions.get('window');
const BTN = Math.min(46, Math.floor(W * 0.11));

export default function ClientLayout() {
  const insets = useSafeAreaInsets();
  const { isRTL } = useLanguage();
  const { colors } = useTheme();
  const { showCarousel, dismissCarousel } = useTutorial('client');
  const { count: unreadMsgs } = useUnreadMsgCount();

  const tabBarStyle = {
    ...makeTabBarStyle(colors, insets.bottom),
    flexDirection: (isRTL ? 'row-reverse' : 'row') as 'row' | 'row-reverse',
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={{ ...makeTabOptions(colors), tabBarStyle }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'الرئيسية',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🏠</Text>,
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
          name="new-request"
          options={{
            title: 'طلب جديد',
            tabBarIcon: ({ focused }) => (
              <View style={{
                width: BTN, height: BTN, borderRadius: 14,
                backgroundColor: colors.accent,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: colors.accent,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: focused ? 0.5 : 0.35,
                shadowRadius: 8,
                elevation: focused ? 8 : 5,
              }}>
                <Text style={{ fontSize: 22 }}>➕</Text>
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'الرسائل',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>💬</Text>,
            tabBarBadge: unreadMsgs > 0 ? unreadMsgs : undefined,
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

      {/* Onboarding carousel — shown once on first login, safe Modal outside Tabs */}
      <OnboardingCarousel role="client" visible={showCarousel} onDone={dismissCarousel} />
    </View>
  );
}
