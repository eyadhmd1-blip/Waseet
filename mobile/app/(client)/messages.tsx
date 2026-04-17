import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { COLORS } from '../../src/constants/theme';
import { useLanguage } from '../../src/hooks/useLanguage';
import { useInsets } from '../../src/hooks/useInsets';
import { HEADER_PAD } from '../../src/utils/layout';

type ConversationJob = {
  id: string;
  status: string;
  created_at: string;
  request:  { title: string; category_slug: string };
  provider: { user: { full_name: string } };
};

const JOB_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:    { bg: '#78350F', text: '#FCD34D' },
  completed: { bg: '#14532D', text: '#86EFAC' },
  cancelled: { bg: '#3B0764', text: '#C4B5FD' },
  disputed:  { bg: '#7F1D1D', text: '#FCA5A5' },
};

export default function ClientMessages() {
    const { headerPad } = useInsets();
  const router = useRouter();
  const { t, ta, lang } = useLanguage();
  const [jobs, setJobs]           = useState<ConversationJob[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const JOB_STATUS_LABEL: Record<string, string> = {
    active:    t('providerJobs.statusActive'),
    completed: t('providerJobs.statusCompleted'),
    cancelled: t('providerJobs.statusCancelled'),
    disputed:  t('providerJobs.statusDisputed'),
  };

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('jobs')
      .select(`
        id, status, created_at,
        request:requests(title, category_slug),
        provider:providers!jobs_provider_id_fkey(user:users(full_name))
      `)
      .eq('client_id', user.id)
      .in('status', ['active', 'completed', 'disputed'])
      .order('created_at', { ascending: false });

    if (data) setJobs(data as unknown as ConversationJob[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const renderItem = ({ item }: { item: ConversationJob }) => {
    const colors = JOB_STATUS_COLORS[item.status] ?? JOB_STATUS_COLORS.active;
    const providerName = item.provider?.user?.full_name ?? '—';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: '/chat', params: { job_id: item.id } })}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{providerName.charAt(0)}</Text>
        </View>

        <View style={styles.cardInfo}>
          <Text style={[styles.providerName, { textAlign: ta }]} numberOfLines={1}>{providerName}</Text>
          <Text style={[styles.jobTitle, { textAlign: ta }]} numberOfLines={1}>{item.request?.title}</Text>
        </View>

        <View style={styles.cardRight}>
          <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.statusText, { color: colors.text }]}>
              {JOB_STATUS_LABEL[item.status] ?? item.status}
            </Text>
          </View>
          <Text style={styles.cardDate}>
            {new Date(item.created_at).toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', { day: 'numeric', month: 'short' })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { textAlign: ta }]}>{t('chat.title')}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>{t('chat.noConversations')}</Text>
              <Text style={styles.emptySub}>{t('chat.noConvSub')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:      { paddingHorizontal: 20, paddingTop: HEADER_PAD, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary },
  listContent: { paddingVertical: 8 },

  card:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  avatar:     { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '700', color: COLORS.bg },
  cardInfo:   { flex: 1 },
  providerName:{ fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 3 },
  jobTitle:   { fontSize: 12, color: COLORS.textMuted },

  cardRight:   { alignItems: 'flex-end', gap: 6 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:  { fontSize: 10, fontWeight: '700' },
  cardDate:    { fontSize: 11, color: COLORS.textMuted },

  empty:      { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon:  { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  emptySub:   { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },
});
