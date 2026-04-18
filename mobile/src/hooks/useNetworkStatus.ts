import { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

const PING_URL = 'https://www.gstatic.com/generate_204';
const TIMEOUT_MS = 4000;

async function checkOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(PING_URL, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    return res.status === 204;
  } catch {
    return false;
  }
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = async () => {
    const online = await checkOnline();
    setIsOnline(online);
  };

  useEffect(() => {
    poll();

    // Poll every 15 seconds when app is in foreground
    intervalRef.current = setInterval(poll, 15_000);

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        poll();
        if (!intervalRef.current) {
          intervalRef.current = setInterval(poll, 15_000);
        }
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, []);

  return { isOnline };
}
