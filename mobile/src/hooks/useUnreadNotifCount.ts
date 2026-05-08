import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';

export function useUnreadNotifCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { count: n } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('is_read', false);

    setCount(n ?? 0);
  }, []);

  // Refresh count whenever screen gains focus
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // Realtime: increment badge instantly when a new notification is inserted
  useEffect(() => {
    let userId: string | null = null;

    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      userId = session.user.id;

      const channel = supabase
        .channel(`notif_count_${userId}_${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          () => setCount(prev => prev + 1),
        )
        .subscribe();

      return channel;
    };

    let channelPromise = setup();

    return () => {
      channelPromise.then(ch => { if (ch) supabase.removeChannel(ch); });
    };
  }, []);

  return { count, refresh };
}
