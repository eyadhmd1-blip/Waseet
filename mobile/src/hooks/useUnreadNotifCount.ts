import { useState, useCallback } from 'react';
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

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  return { count, refresh };
}
