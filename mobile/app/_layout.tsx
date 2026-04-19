import 'intl-pluralrules';   // polyfill — must be first import
import { useEffect, useState, useRef } from 'react';
import { Platform, View, Text } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { I18nextProvider } from 'react-i18next';
import { supabase } from '../src/lib/supabase';
import { ROUTES } from '../src/constants/theme';
import { useNetworkStatus } from '../src/hooks/useNetworkStatus';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { initI18n } from '../src/i18n';
import i18nInstance from '../src/i18n';

SplashScreen.preventAutoHideAsync();

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

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });

    if (!token) return;

    await supabase
      .from('push_tokens')
      .upsert(
        { user_id: userId, token, platform: 'expo', updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' },
      );
  } catch { /* non-blocking */ }
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
  const { colors }              = useTheme();

  const router   = useRouter();
  const segments = useSegments();
  const notifListenerRef = useRef<Notifications.Subscription | null>(null);

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

      const screen     = data?.screen      as string | undefined;
      const notifId    = data?.notif_id    as string | undefined;
      const providerId = data?.provider_id as string | undefined;
      const jobId      = data?.job_id      as string | undefined;

      if (screen === 'provider_confirm' && jobId) {
        router.push({ pathname: '/provider-confirm', params: { job_id: jobId } } as any);
      } else if (screen === 'new-request') {
        const href = notifId ? `/(client)/new-request?notif_id=${notifId}` : '/(client)/new-request';
        router.push(href as any);
      } else if (screen === 'urgent') {
        router.push('/(provider)');
      } else if (screen === 'provider-profile' && providerId) {
        router.push({ pathname: '/provider-profile', params: { provider_id: providerId } } as any);
      } else if (screen === 'home') {
        router.push('/(client)');
      } else if (screen === 'support_thread' && jobId) {
        router.push({ pathname: '/support-thread', params: { id: jobId } } as any);
      }
    });

    return () => notifListenerRef.current?.remove();
  }, []);

  // ── Auth state management ─────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        setRole(null);
      } else {
        const { data } = await supabase
          .from('users')
          .select('role, phone_verified')
          .eq('id', session.user.id)
          .single();

        if (!data) {
          // No users row yet — new user in onboarding
          setRole('onboarding' as any);
        } else if (!data.phone_verified) {
          // Phone not yet verified — route to verification gate
          setRole('unverified' as any);
        } else {
          setRole(data.role);
        }
        registerPushToken(session.user.id);
      }
      // NOTE: SplashScreen is hidden in the route guard below,
      // AFTER navigation is decided — prevents flash of wrong screen.
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Hide splash only after both auth + i18n are ready ────────
  useEffect(() => {
    if (role !== undefined && i18nReady) SplashScreen.hideAsync();
  }, [role, i18nReady]);

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
        // Don't blindly redirect — provider may have just finished the onboarding form.
        // Re-query the DB; if a users row now exists, update role and let them through.
        supabase.auth.getUser().then(({ data: { user: u } }) => {
          if (!u) { router.replace('/(auth)/onboarding' as any); return; }
          supabase
            .from('users')
            .select('role, phone_verified')
            .eq('id', u.id)
            .single()
            .then(({ data }) => {
              if (!data) {
                // Only redirect if the user is NOT already at a valid role destination.
                // If they just finished onboarding and navigated to /(provider) or
                // /(client), a stale re-query race must not bounce them back out.
                if (!inClient && !inProvider) router.replace('/(auth)/onboarding' as any);
              } else if (!data.phone_verified) {
                router.replace('/verify-phone' as any);
              } else {
                setRole(data.role); // triggers guard again with real role
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
      </Stack>
    </I18nextProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}

const offlineBanner: import('react-native').ViewStyle = {
  position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999,
  paddingVertical: 8, alignItems: 'center',
};
