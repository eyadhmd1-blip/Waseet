import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TooltipKey =
  | 'newRequest'   // client: ➕ tab on first feed load
  | 'firstBid'     // client: first time a request has bids
  | 'credits'      // provider: credits badge in header
  | 'boost'        // provider: after first pending bid
  | 'contracts';   // provider: contracts tab first view

const KEY_CAROUSEL = (role: 'client' | 'provider') =>
  `waseet_carousel_seen_${role}`;
const KEY_TOOLTIPS = 'waseet_tooltips_seen';

export function useTutorial(role: 'client' | 'provider') {
  const [carouselDone, setCarouselDone] = useState<boolean | null>(null);
  const [seen, setSeen]                 = useState<Set<TooltipKey>>(new Set());
  const [ready, setReady]               = useState(false);

  useEffect(() => {
    (async () => {
      const [c, t] = await Promise.all([
        AsyncStorage.getItem(KEY_CAROUSEL(role)),
        AsyncStorage.getItem(KEY_TOOLTIPS),
      ]);
      setCarouselDone(c === 'true');
      if (t) {
        try { setSeen(new Set(JSON.parse(t) as TooltipKey[])); } catch {}
      }
      setReady(true);
    })();
  }, [role]);

  const dismissCarousel = useCallback(async () => {
    await AsyncStorage.setItem(KEY_CAROUSEL(role), 'true');
    setCarouselDone(true);
  }, [role]);

  const markTooltip = useCallback(async (key: TooltipKey) => {
    setSeen(prev => {
      const next = new Set(prev);
      next.add(key);
      AsyncStorage.setItem(KEY_TOOLTIPS, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const isTooltipSeen = useCallback(
    (key: TooltipKey) => seen.has(key),
    [seen],
  );

  const resetTutorial = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(KEY_CAROUSEL(role)),
      AsyncStorage.removeItem(KEY_TOOLTIPS),
    ]);
    setCarouselDone(false);
    setSeen(new Set());
  }, [role]);

  return {
    ready,
    showCarousel: ready && carouselDone === false,
    dismissCarousel,
    isTooltipSeen,
    markTooltip,
    resetTutorial,
  };
}
