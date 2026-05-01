// ============================================================
// WASEET — Support Hub Screen
// Entry point: FAQ accordion + quick ticket actions + stats
// ============================================================

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useLanguage } from '../src/hooks/useLanguage';
import { useTheme } from '../src/context/ThemeContext';
import { AppHeader } from '../src/components/AppHeader';
import type { AppColors } from '../src/constants/colors';

interface FaqItem {
  id: string;
  question_ar: string;
  answer_ar: string;
  question_en?: string;
  answer_en?: string;
  category: string;
}

interface TicketSummary {
  open: number;
  in_review: number;
  total: number;
}

export default function SupportScreen() {
  const router = useRouter();
  const { t, ta, lang, isRTL } = useLanguage();
  const { colors } = useTheme();

  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);

  const [faq,       setFaq]       = useState<FaqItem[]>([]);
  const [summary,   setSummary]   = useState<TicketSummary>({ open: 0, in_review: 0, total: 0 });
  const [loading,   setLoading]   = useState(true);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [isAdmin,   setIsAdmin]   = useState(false);
  const [adminNew,  setAdminNew]  = useState(0);

  const load = useCallback(async () => {
    try {
      const { data: { session: _ses } } = await supabase.auth.getSession();
      const user = _ses?.user;

      const [{ data: faqData }, { data: tickets }, { data: userData }] = await Promise.all([
        supabase
          .from('support_faq')
          .select('id, question_ar, answer_ar, question_en, answer_en, category')
          .order('sort_order', { ascending: true })
          .limit(10),
        user
          ? supabase
              .from('support_tickets')
              .select('status')
              .eq('user_id', user.id)
          : Promise.resolve({ data: [] }),
        user
          ? supabase.from('users').select('is_admin').eq('id', user.id).single()
          : Promise.resolve({ data: null }),
      ]);

      if (faqData) setFaq(faqData as FaqItem[]);
      if (tickets) {
        const open      = (tickets as any[]).filter(t => t.status === 'open').length;
        const in_review = (tickets as any[]).filter(t => t.status === 'in_review').length;
        setSummary({ open, in_review, total: (tickets as any[]).length });
      }
      if (userData?.is_admin) {
        setIsAdmin(true);
        const { count } = await supabase
          .from('support_tickets')
          .select('id', { count: 'exact', head: true })
          .in('status', ['open', 'in_review']);
        setAdminNew(count ?? 0);
      }

    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader variant="stack" title={t('support.headerTitle')} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Admin inbox shortcut — only visible to admins */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.adminInboxBtn}
            onPress={() => router.push('/admin' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.adminInboxText}>{t('support.adminInboxBtn')}</Text>
            {adminNew > 0 && (
              <View style={styles.adminInboxBadge}>
                <Text style={styles.adminInboxBadgeText}>
                  {t('support.adminNewCount', { count: adminNew })}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>🛟</Text>
          <Text style={styles.heroTitle}>{t('support.heroTitle')}</Text>
          <Text style={styles.heroSub}>{t('support.heroSub')}</Text>
        </View>

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/support-new' as any)}
          >
            <Text style={styles.actionIcon}>✉️</Text>
            <Text style={styles.actionLabel}>{t('support.newTicket')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/support-tickets' as any)}
          >
            <Text style={styles.actionIcon}>📂</Text>
            <Text style={styles.actionLabel}>{t('support.myTickets')}</Text>
            {summary.total > 0 && (
              <View style={styles.actionBadge}>
                <Text style={styles.actionBadgeText}>{summary.total}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Ticket summary bar */}
        {summary.total > 0 && (
          <View style={styles.summaryBar}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>{summary.open}</Text>
              <Text style={styles.summaryLbl}>{t('support.summaryOpen')}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: '#F59E0B' }]}>{summary.in_review}</Text>
              <Text style={styles.summaryLbl}>{t('support.summaryReview')}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>{summary.total}</Text>
              <Text style={styles.summaryLbl}>{t('support.summaryTotal')}</Text>
            </View>
          </View>
        )}

        {/* FAQ */}
        {faq.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('support.sectionFaq')}</Text>
            {faq.map(item => {
              const question = lang === 'ar' ? item.question_ar : (item.question_en ?? item.question_ar);
              const answer   = lang === 'ar' ? item.answer_ar   : (item.answer_en   ?? item.answer_ar);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.faqItem}
                  onPress={() => setOpenFaqId(openFaqId === item.id ? null : item.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.faqHeader, {}]}>
                    <Text style={styles.faqArrow}>
                      {openFaqId === item.id ? '▲' : '▼'}
                    </Text>
                    <Text style={styles.faqQ}>{question}</Text>
                  </View>
                  {openFaqId === item.id && (
                    <Text style={styles.faqA}>{answer}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* Contact note */}
        <View style={styles.contactNote}>
          <Text style={styles.contactNoteText}>
            {t('support.contactNote')}
          </Text>
          <TouchableOpacity
            style={styles.openTicketBtn}
            onPress={() => router.push('/support-new' as any)}
          >
            <Text style={styles.openTicketBtnText}>{t('support.openTicketBtn')}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

function createStyles(colors: AppColors, isRTL: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    center:    { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },


    content: { padding: 16, paddingBottom: 48 },

    hero:      { alignItems: 'center', paddingVertical: 24 },
    heroIcon:  { fontSize: 48, marginBottom: 10 },
    heroTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
    heroSub:   { fontSize: 14, color: colors.textMuted },

    actionsRow:      { flexDirection: 'row', gap: 12, marginBottom: 16 },
    actionCard:      { flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: colors.border, gap: 8 },
    actionIcon:      { fontSize: 28 },
    actionLabel:     { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    actionBadge:     { position: 'absolute', top: 8, left: 8, backgroundColor: colors.accent, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
    actionBadgeText: { fontSize: 11, fontWeight: '700', color: colors.bg },

    summaryBar:     { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: colors.border },
    summaryItem:    { flex: 1, alignItems: 'center' },
    summaryVal:     { fontSize: 22, fontWeight: '700', color: '#38BDF8' },
    summaryLbl:     { fontSize: 11, color: colors.textMuted, marginTop: 3 },
    summaryDivider: { width: 1, backgroundColor: colors.border },

    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 10, textAlign: ta },

    faqItem:   { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
    faqHeader: { alignItems: 'center', gap: 10 },
    faqArrow:  { fontSize: 10, color: colors.textMuted, width: 14 },
    faqQ:      { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary, lineHeight: 20, textAlign: ta },
    faqA:      { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, textAlign: ta },

    contactNote:      { backgroundColor: colors.accentDim, borderRadius: 14, padding: 16, marginTop: 12, borderWidth: 1, borderColor: 'rgba(201,168,76,0.30)', alignItems: 'center' },
    contactNoteText:  { fontSize: 13, color: '#FCD34D', lineHeight: 20, marginBottom: 14, textAlign: ta },
    openTicketBtn:    { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
    openTicketBtnText:{ fontSize: 14, fontWeight: '700', color: colors.bg },

    adminInboxBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: 'rgba(201,168,76,0.1)', borderRadius: 14,
      padding: 16, marginBottom: 8,
      borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)',
    },
    adminInboxText:      { fontSize: 15, fontWeight: '700', color: colors.accent },
    adminInboxBadge:     { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
    adminInboxBadgeText: { fontSize: 12, fontWeight: '700', color: colors.bg },
  });
}
