import { useCallback, useEffect, useRef, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeTabBarStyle, makeTabOptions } from '../../src/constants/theme';
import { useLanguage } from '../../src/hooks/useLanguage';
import { useTheme } from '../../src/context/ThemeContext';
import { supabase } from '../../src/lib/supabase';
import { useTutorial } from '../../src/hooks/useTutorial';
import { OnboardingCarousel } from '../tutorial/carousel';

// Shown at most once per app session
let _alertShownThisSession = false;

type AlertKind = 'expiringSoon' | 'creditsLow' | 'trialEnded' | 'pendingPayment';

interface AlertState {
  kind:      AlertKind;
  days?:     number;
  count?:    number;
  ticketId?: string;
}

export default function ProviderLayout() {
  const insets   = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const { colors }   = useTheme();
  const router       = useRouter();

  const [alert, setAlert] = useState<AlertState | null>(null);
  const checked = useRef(false);
  const { showCarousel, dismissCarousel } = useTutorial('provider');

  const tabBarStyle = {
    ...makeTabBarStyle(colors, insets.bottom),
    flexDirection: (isRTL ? 'row-reverse' : 'row') as 'row' | 'row-reverse',
  };

  // ── Check subscription health on mount ─────────────────────
  const checkSubscription = useCallback(async () => {
    if (_alertShownThisSession || checked.current) return;
    checked.current = true;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const [{ data: p }, { data: pendingTicket }] = await Promise.all([
      supabase
        .from('providers')
        .select('is_subscribed, subscription_tier, subscription_ends, subscription_credits, bonus_credits, trial_used')
        .eq('id', session.user.id)
        .single(),
      supabase
        .from('support_tickets')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('category', 'payment')
        .not('status', 'in', '("resolved","closed")')
        .maybeSingle(),
    ]);

    if (!p) return;

    // 1. Trial ended — highest priority
    if (!p.is_subscribed && p.trial_used) {
      _alertShownThisSession = true;
      setAlert({ kind: 'trialEnded' });
      return;
    }

    // 2. Pending payment ticket — remind provider to check support thread
    if (pendingTicket) {
      _alertShownThisSession = true;
      setAlert({ kind: 'pendingPayment', ticketId: pendingTicket.id });
      return;
    }

    if (!p.is_subscribed) return;

    // 3. Subscription expiring in ≤ 5 days
    if (p.subscription_ends) {
      const daysLeft = Math.ceil(
        (new Date(p.subscription_ends).getTime() - Date.now()) / 86_400_000
      );
      if (daysLeft <= 5 && daysLeft >= 0) {
        _alertShownThisSession = true;
        setAlert({ kind: 'expiringSoon', days: daysLeft });
        return;
      }
    }

    // 4. Subscription credits ≤ 3 (skip premium — unlimited)
    if (p.subscription_tier !== 'premium' && (p.subscription_credits ?? 0) <= 3) {
      _alertShownThisSession = true;
      setAlert({ kind: 'creditsLow', count: p.subscription_credits ?? 0 });
    }
  }, []);

  useEffect(() => { checkSubscription(); }, [checkSubscription]);

  // ── Alert content ───────────────────────────────────────────
  const dismiss = () => setAlert(null);

  const handleAction = () => {
    dismiss();
    if (alert?.kind === 'pendingPayment' && alert.ticketId) {
      router.push({ pathname: '/support-thread', params: { id: alert.ticketId } } as any);
    } else {
      router.push('/subscribe' as any);
    }
  };

  let title      = '';
  let sub        = '';
  let actionLabel = '';

  if (alert) {
    if (alert.kind === 'trialEnded') {
      title       = t('profile.trialEndedTitle');
      sub         = t('profile.trialEndedSub');
      actionLabel = t('profile.renewNow');
    } else if (alert.kind === 'pendingPayment') {
      title       = t('profile.pendingPaymentTitle');
      sub         = t('profile.pendingPaymentSub');
      actionLabel = t('profile.viewSupportThread');
    } else if (alert.kind === 'expiringSoon') {
      title       = t('profile.expiringSoonTitle');
      sub         = t('profile.expiringSoonSub', { days: alert.days ?? 0 });
      actionLabel = t('profile.renewNow');
    } else {
      title       = t('profile.creditsLowTitle');
      sub         = t('profile.creditsLowSub', { count: alert.count ?? 0 });
      actionLabel = t('profile.renewNow');
    }
  }

  const st = styles(colors);

  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={{ ...makeTabOptions(colors), tabBarStyle }}>
        <Tabs.Screen
          name="index"
          options={{
            title: t('providerFeed.tabTitle'),
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🔍</Text>,
          }}
        />
        <Tabs.Screen
          name="jobs"
          options={{
            title: t('providerJobs.title'),
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🛠️</Text>,
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: t('chat.title'),
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>💬</Text>,
          }}
        />
        <Tabs.Screen
          name="dashboard"
          options={{
            title: t('profile.stats'),
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📊</Text>,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('profile.tabTitle'),
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>👤</Text>,
          }}
        />
      </Tabs>

      {/* ── Onboarding carousel — shown once on first login ── */}
      <OnboardingCarousel role="provider" visible={showCarousel} onDone={dismissCarousel} />

      {/* ── Subscription Alert Modal ── */}
      <Modal
        visible={!!alert}
        transparent
        animationType="fade"
        onRequestClose={dismiss}
      >
        <View style={st.overlay}>
          <View style={st.sheet}>
            <Text style={st.title}>{title}</Text>
            <Text style={st.sub}>{sub}</Text>

            <TouchableOpacity style={st.renewBtn} onPress={handleAction}>
              <Text style={st.renewBtnText}>{actionLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={st.laterBtn} onPress={dismiss}>
              <Text style={st.laterBtnText}>{t('profile.laterBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function styles(colors: import('../../src/constants/colors').AppColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center', justifyContent: 'flex-end',
    },
    sheet: {
      width: '100%', backgroundColor: colors.surface,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      padding: 28, paddingBottom: 48, alignItems: 'center', gap: 10,
    },
    title:       { fontSize: 20, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
    sub:         { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 8 },
    renewBtn:    { width: '100%', backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
    renewBtnText:{ fontSize: 16, fontWeight: '700', color: colors.bg },
    laterBtn:    { paddingVertical: 10 },
    laterBtnText:{ fontSize: 14, color: colors.textMuted },
  });
}
