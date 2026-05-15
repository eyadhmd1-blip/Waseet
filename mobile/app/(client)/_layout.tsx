import { Tabs } from 'expo-router';
import { Text, View, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeTabBarStyle, makeTabOptions } from '../../src/constants/theme';
import { useLanguage } from '../../src/hooks/useLanguage';
import { useTheme } from '../../src/context/ThemeContext';
import { useTutorial } from '../../src/hooks/useTutorial';
import { OnboardingCarousel } from '../tutorial/carousel';
import { useUnreadMsgCount } from '../../src/hooks/useUnreadMsgCount';

export default function ClientLayout() {
  const insets = useSafeAreaInsets();
  const { isRTL } = useLanguage();
  const { colors, isDark } = useTheme();
  const { showCarousel, dismissCarousel } = useTutorial('client');
  const { count: unreadMsgs } = useUnreadMsgCount();

  const tabBarStyle = {
    ...makeTabBarStyle(colors, insets.bottom),
    flexDirection: (isRTL ? 'row-reverse' : 'row') as 'row' | 'row-reverse',
    height: 68 + insets.bottom,   // 12px extra so the raised button stays in-bounds
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
            tabBarButton: (props) => {
              const focused = props.accessibilityState?.selected ?? false;
              return (
                <TouchableOpacity
                  onPress={props.onPress}
                  activeOpacity={0.82}
                  style={[
                    props.style,
                    { alignItems: 'center', justifyContent: 'flex-start', paddingTop: 0 },
                  ]}
                >
                  {/* Raised circle */}
                  <View style={{
                    width: 56, height: 56, borderRadius: 28,
                    backgroundColor: colors.accent,
                    alignItems: 'center', justifyContent: 'center',
                    marginTop: -10,
                    opacity: focused ? 1 : 0.9,
                    ...Platform.select({
                      ios: {
                        shadowColor: isDark ? '#000' : colors.accent,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: isDark ? 0.5 : 0.38,
                        shadowRadius: 10,
                      },
                    }),
                  }}>
                    <Text style={{ fontSize: 28, color: '#fff', fontWeight: '300', lineHeight: 32 }}>
                      +
                    </Text>
                  </View>

                  {/* Label */}
                  <Text style={{
                    fontSize: 11, fontWeight: '600',
                    color: focused ? colors.accent : colors.textMuted,
                    marginTop: 3,
                  }}>
                    طلب جديد
                  </Text>
                </TouchableOpacity>
              );
            },
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
