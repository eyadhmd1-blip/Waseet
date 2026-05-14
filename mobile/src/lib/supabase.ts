import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

export const supabaseUrl      = process.env.EXPO_PUBLIC_SUPABASE_URL!;
export const supabaseAnonKey  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// expo-secure-store v15 enforces a 2048-byte limit per key on iOS.
// Supabase session JSON (access_token + refresh_token + metadata) exceeds
// that limit, so we split large values across numbered chunk keys.
const CHUNK_SIZE = 1800;

const ChunkedSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const count = await SecureStore.getItemAsync(`${key}_count`);
    if (!count) return null;
    const chunks: string[] = [];
    for (let i = 0; i < parseInt(count, 10); i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
      if (chunk == null) return null;
      chunks.push(chunk);
    }
    return chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(`${key}_count`, String(chunks.length));
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}_${i}`, chunks[i]);
    }
  },

  async removeItem(key: string): Promise<void> {
    const count = await SecureStore.getItemAsync(`${key}_count`);
    if (!count) return;
    await SecureStore.deleteItemAsync(`${key}_count`);
    for (let i = 0; i < parseInt(count, 10); i++) {
      await SecureStore.deleteItemAsync(`${key}_${i}`);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage:            ChunkedSecureStore,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
  },
});
