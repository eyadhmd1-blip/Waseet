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

// Shown at most once per app session
let _alertShownThisSession = false;

type AlertKind = 'expiringSoon' | 'creditsLow' | 'trialEnded';

interface AlertState {
  kind:  AlertKind;
  days?: number;
  count?: number;
}

export default function ProviderLayout() {
  const insets   = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const { colors }   = useTheme();
  const router       = useRouter();

  const [alert, setAlert] = useState<AlertState | null>(null);
  const checked = useRef(false);

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

    const { data: p } = await supabase
      .from('providers')
      .select('is_subscribed, subscription_tier, subscription_ends, subscription_credits, bonus_credits, trial_used')
      .eq('id', session.user.id)
      .single();

    if (!p) return;

    // 1. Trial ended — highest priority
    if (!p.is_subscribed && p.trial_used) {
      _alertShownThisSession = true;
      setAlert({ kind: 'trialEnded' });
      return;
    }

    if (!p.is_subscribed) return;

    // 2. Subscription expiring in ≤ 5 days
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

    // 3. Subscription credits ≤ 3 (skip premium — unlimited)
    if (p.subscription_tier !== 'premium' && (p.subscription_credits ?? 0) <= 3) {
      _alertShownThisSession = true;
      setAlert({ kind: 'creditsLow', count: p.subscription_credits ?? 0 });
    }
  }, []);

  useEffect(() => { checkSubscription(); }, [checkSubscription]);

  // ── Alert content ───────────────────────────────────────────
  const dismiss = () => setAlert(null);

  const handleRenew = () => {
    dismiss();
    router.push('/subscribe' as any);
  };

  let title = '';
  let sub   = '';

  if (alert) {
    if (alert.kind === 'trialEnded') {
      title = t('profile.trialEndedTitle');
      sub   = t('profile.trialEndedSub');
    } else if (alert.kind === 'expiringSoon') {
      title = t('profile.expiringSoonTitle');
      sub   = t('profile.expiringSoonSub', { days: alert.days ?? 0 });
    } else {
      title = t('profile.creditsLowTitle');
      sub   = t('profile.creditsLowSub', { count: alert.count ?? 0 });
    }
  }

  const st = styles(colors);

  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={{ ...makeTabOptions(colors), tabBarStyle }}>
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

            <TouchableOpacity style={st.renewBtn} onPress={handleRenew}>
              <Text style={st.renewBtnText}>{t('profile.renewNow')}</Text>
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
