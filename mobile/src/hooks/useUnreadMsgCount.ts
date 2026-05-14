import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useUnreadMsgCount() {
  const [count, setCount]   = useState(0);
  const jobIdsRef           = useRef<Set<string>>(new Set());
  const userIdRef           = useRef<string | null>(null);
  const debounceRef         = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCount = useCallback(async (userId: string, jobIds: string[]) => {
    if (jobIds.length === 0) { setCount(0); return; }
    const { count: n } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('job_id', jobIds)
      .eq('is_read', false)
      .neq('sender_id', userId);
    setCount(n ?? 0);
  }, []);

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const userId = session.user.id;
    userIdRef.current = userId;

    const { data: jobsData } = await supabase
      .from('jobs')
      .select('id')
      .or(`client_id.eq.${userId},provider_id.eq.${userId}`)
      .in('status', ['active', 'disputed']);

    const jobIds = (jobsData ?? []).map((j: any) => j.id);
    jobIdsRef.current = new Set(jobIds);
    await fetchCount(userId, jobIds);
  }, [fetchCount]);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      await refresh();
      if (cancelled) return;
      const userId = userIdRef.current;
      if (!userId) return;

      channel = supabase
        .channel(`unread_msg_${userId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          const msg = payload.new as any;
          if (msg.sender_id === userId) return;
          if (!jobIdsRef.current.has(msg.job_id)) return;
          setCount(prev => prev + 1);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => {
          // Debounce to handle bulk mark-as-read from chat screen
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            if (userIdRef.current) fetchCount(userIdRef.current, [...jobIdsRef.current]);
          }, 300);
        })
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[Waseet] unread_msg channel error — refreshing count');
            if (userIdRef.current) fetchCount(userIdRef.current, [...jobIdsRef.current]);
          }
        });
    };

    setup();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [refresh, fetchCount]);

  return { count, refresh };
}
