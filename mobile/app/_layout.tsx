import 'intl-pluralrules';   // polyfill — must be first import
import { Component, useEffect, useState, useRef, useCallback } from 'react';
import { Platform, View, Text, StatusBar, TouchableOpacity, AppState } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { I18nextProvider } from 'react-i18next';
import { supabase } from '../src/lib/supabase';
import { handleNotifTap } from '../src/lib/notifRouting';
import { setRoleUpdateHandler } from '../src/lib/authEvents';
import { ROUTES } from '../src/constants/theme';
import { useNetworkStatus } from '../src/hooks/useNetworkStatus';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { initI18n } from '../src/i18n';
import i18nInstance from '../src/i18n';

SplashScreen.preventAutoHideAsync();

// ── Global Error Boundary ─────────────────────────────────────

class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state: { hasError: boolean; error: Error | null } = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, textAlign: 'center' }}>
          حدث خطأ غير متوقع
        </Text>
        <Text style={{ fontSize: 13, color: '#888', marginBottom: 24, textAlign: 'center' }}>
          {this.state.error?.message ?? 'Unknown error'}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#3B82F6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
          onPress={() => this.setState({ hasError: false, error: null })}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

// Show alerts even when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
});

// Android requires channels to be created before notifications can play sound.
// Must run before any notification is received.
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name:        'الإشعارات العامة',
    importance:  Notifications.AndroidImportance.MAX,
    sound:       'default',
    vibrationPattern: [0, 250, 250, 250],
    lightColor:  '#C9A84C',
  });
  Notifications.setNotificationChannelAsync('urgent', {
    name:        'الطلبات الطارئة',
    importance:  Notifications.AndroidImportance.MAX,
    sound:       'default',
    vibrationPattern: [0, 100, 100, 100, 100, 100],
    lightColor:  '#EF4444',
  });
}

// ── Register push token ───────────────────────────────────────

async function registerPushToken(userId: string) {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    // projectId falls back to app.json extra.eas.projectId when env var is absent
    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID ?? 'ce995c3f-5df4-46fc-bc17-8cd30eefadbc';
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    if (!token) return;

    // onConflict must match the composite unique constraint (user_id, token)
    // added in migration 030. Using 'user_id' alone caused a silent PG error
    // because that single-column constraint was dropped.
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        { user_id: userId, token, platform: 'expo', updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' },
      );

    if (error) console.warn('[push] token upsert failed:', error.message);
  } catch (e: any) {
    console.warn('[push] registerPushToken error:', e?.message);
  }
}

async function markNotifOpened(notifId: string) {
  try {
    await supabase.rpc('mark_notification_opened', { notif_id: notifId });
  } catch { /* non-blocking */ }
}

// ── Root layout ───────────────────────────────────────────────

function RootLayoutInner() {
  const [role, setRole]         = useState<'client' | 'provider' | null | undefined>(undefined);
  const [i18nReady, setI18nReady] = useState(false);
  // appKey increments when language changes, remounting the entire navigator
  const [appKey, setAppKey]     = useState(0);
  const { isOnline }            = useNetworkStatus();
  const { colors, isDark }      = useTheme();

  const router   = useRouter();
  const segments = useSegments();
  const notifListenerRef = useRef<Notifications.Subscription | null>(null);

  // ── Register direct role-update bridge for onboarding screen ──
  useEffect(() => {
    setRoleUpdateHandler((r) => setRole(r as any));
    return () => setRoleUpdateHandler(() => {});
  }, []);

  // ── Initialise i18n on mount ────────────────────────────────
  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  // ── Listen for language changes → remount navigator ─────────
  useEffect(() => {
    const handler = () => {
      // Remove all realtime channels before remounting so old subscriptions
      // don't linger as zombie connections after screens unmount.
      supabase.removeAllChannels();
      setAppKey(k => k + 1);
    };
    i18nInstance.on('languageChanged', handler);
    return () => { i18nInstance.off('languageChanged', handler); };
  }, []);

  // ── Notification tap routing ─────────────────────────────────
  useEffect(() => {
    notifListenerRef.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, unknown>;

      if (data?.notif_id) markNotifOpened(String(data.notif_id));

      handleNotifTap({
        screen:      data?.screen      as string | undefined,
        notif_id:    data?.notif_id    as string | undefined,
        provider_id: data?.provider_id as string | undefined,
        job_id:      data?.job_id      as string | undefined,
        request_id:  data?.request_id  as string | undefined,
      }, router);
    });

    return () => notifListenerRef.current?.remove();
  }, []);

  // ── Resolve role from a valid session ────────────────────────
  const resolveRole = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('users')
      .select('role, phone_verified')
      .eq('id', userId)
      .single();

    if (!data) {
      setRole('onboarding' as any);
    } else if (!data.phone_verified) {
      setRole('unverified' as any);
    } else {
      setRole(data.role);
    }
    registerPushToken(userId);
  }, []);

  // ── Auth state management ─────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session) {
        // Only sign the user out on an explicit SIGNED_OUT event.
        // INITIAL_SESSION with null means the token is expired and a
        // refresh is in progress — setting role=null here would flash
        // the auth screen before TOKEN_REFRESHED arrives.
        if (event === 'SIGNED_OUT') setRole(null);
        return;
      }
      resolveRole(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, [resolveRole]);

  // ── Restart auto-refresh + recover role on foreground ─────────
  // When battery-optimization kills the background process and the
  // user re-opens the app, the token refresh may not have run.
  // We call startAutoRefresh() and re-check the session so the role
  // is restored without showing the auth screen.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        supabase.auth.startAutoRefresh();
        // If role was wiped by a spurious null session event, restore it
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setRole(prev => {
            if (prev === null || prev === undefined) {
              resolveRole(session.user.id);
            }
            return prev;
          });
        }
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
    return () => sub.remove();
  }, [resolveRole]);

  // ── Hide splash only after both auth + i18n are ready ────────
  useEffect(() => {
    if (role !== undefined && i18nReady) SplashScreen.hideAsync();
  }, [role, i18nReady]);

  // ── Safety timeout: force-hide splash after 8s ───────────────
  // Prevents infinite splash on Xiaomi/Redmi (and similar) where
  // aggressive battery optimisation kills the background process.
  // On resume, onAuthStateChange can stall long enough that role
  // stays undefined forever without this fallback.
  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync(), 8000);
    return () => clearTimeout(t);
  }, []);

  // ── Route guard ───────────────────────────────────────────────
  useEffect(() => {
    // role === undefined means auth check hasn't completed yet — keep splash visible
    if (role === undefined) return;

    const inAuth     = segments[0] === ROUTES.AUTH;
    const inClient   = segments[0] === ROUTES.CLIENT;
    const inProvider = segments[0] === ROUTES.PROVIDER;

    if (!role) {
      if (!inAuth) router.replace('/(auth)');
    } else if ((role as string) === 'onboarding') {
      if (!inAuth) {
        // Use getSession() (local SecureStore cache — no network call) instead of
        // getUser() (GoTrue network call that can hang on slow connections and block
        // the supabase-js HTTP pool, causing all screen load() calls to stall).
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) {
            if (!inClient && !inProvider) router.replace('/(auth)/onboarding' as any);
            return;
          }
          supabase
            .from('users')
            .select('role, phone_verified')
            .eq('id', session.user.id)
            .single()
            .then(({ data }) => {
              if (!data) {
                if (!inClient && !inProvider) router.replace('/(auth)/onboarding' as any);
              } else if (!data.phone_verified) {
                router.replace('/verify-phone' as any);
              } else {
                setRole(data.role);
              }
            });
        });
      }
    } else if ((role as string) === 'unverified') {
      if ((segments[0] as string) !== 'verify-phone') router.replace('/verify-phone' as any);
    } else {
      // Redirect logged-in users who somehow ended up in the auth group
      if (inAuth) {
        if (role === 'client')   router.replace('/(client)');
        if (role === 'provider') router.replace('/(provider)');
      }
      // Only redirect cross-role access: client in provider area, or provider in client area.
      // Root-level shared screens (support, notification-settings, recurring-request, etc.)
      // are neither inClient nor inProvider, so they are always allowed through.
      if (role === 'client'   && inProvider) router.replace('/(client)');
      if (role === 'provider' && inClient)   router.replace('/(provider)');
    }

  }, [role, segments]);

  // Don't render until i18n is initialised (prevents flash of untranslated content)
  if (!i18nReady) return null;

  return (
    <SafeAreaProvider>
    <I18nextProvider i18n={i18nInstance}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      {!isOnline && (
        <View style={[offlineBanner, { backgroundColor: colors.errorBg }]}>
          <Text style={{ color: colors.errorSoft, fontSize: 13, fontWeight: '600' }}>
            ⚠ لا يوجد اتصال بالإنترنت
          </Text>
        </View>
      )}
      <Stack key={appKey} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)"                  />
        <Stack.Screen name="(client)"                />
        <Stack.Screen name="(provider)"              />
        <Stack.Screen name="request-detail"          />
        <Stack.Screen name="chat"                    />
        <Stack.Screen name="subscribe"               />
        <Stack.Screen name="portfolio"               />
        <Stack.Screen name="portfolio-add"           />
        <Stack.Screen name="notification-settings"   />
        <Stack.Screen name="notification-inbox"      />
        <Stack.Screen name="urgent-request"          />
        <Stack.Screen name="provider-profile"        />
        <Stack.Screen name="recurring-request"       />
        <Stack.Screen name="contract-detail"         />
        <Stack.Screen name="grace-period"            />
        <Stack.Screen name="provider-confirm"        />
        <Stack.Screen name="rate-job"                />
        <Stack.Screen name="support"                 />
        <Stack.Screen name="support-new"             />
        <Stack.Screen name="support-tickets"         />
        <Stack.Screen name="support-thread"          />
        <Stack.Screen name="verify-phone"            />
        <Stack.Screen name="p/[username]"            />
      </Stack>
    </I18nextProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <RootLayoutInner />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const offlineBanner: import('react-native').ViewStyle = {
  position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999,
  paddingVertical: 8, alignItems: 'center',
};
