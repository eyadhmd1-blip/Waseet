import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  'https://bkbjsstxhvdnqcmpuulf.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrYmpzc3R4aHZkbnFjbXB1dWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMjY3ODcsImV4cCI6MjA5MTgwMjc4N30.-B_KTG1LYlKBlNCWjQhLKYfkp5lXN4xhIm1oMYhHsE4';

// expo-secure-store v14+ enforces a 2048-byte value limit on iOS.
// Supabase session JSON (access_token + refresh_token + user metadata) routinely
// exceeds this limit, causing setItemAsync to throw and the session to be lost on
// every app restart. This chunked adapter splits large values across multiple keys.
const CHUNK_SIZE = 1800;

async function getChunked(key: string): Promise<string | null> {
  const countStr = await SecureStore.getItemAsync(`${key}.n`);
  if (!countStr) return SecureStore.getItemAsync(key); // legacy non-chunked value

  const count = parseInt(countStr, 10);
  const parts = await Promise.all(
    Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)),
  );
  return parts.every(p => p !== null) ? parts.join('') : null;
}

async function setChunked(key: string, value: string): Promise<void> {
  if (value.length <= CHUNK_SIZE) {
    await removeChunked(key);
    await SecureStore.setItemAsync(key, value);
    return;
  }
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    chunks.push(value.slice(i, i + CHUNK_SIZE));
  }
  await SecureStore.deleteItemAsync(key).catch(() => {}); // remove legacy single-key value
  await Promise.all([
    SecureStore.setItemAsync(`${key}.n`, String(chunks.length)),
    ...chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}.${i}`, chunk)),
  ]);
}

async function removeChunked(key: string): Promise<void> {
  const countStr = await SecureStore.getItemAsync(`${key}.n`);
  if (countStr) {
    const count = parseInt(countStr, 10);
    await Promise.all([
      SecureStore.deleteItemAsync(`${key}.n`),
      ...Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)),
    ]);
  }
  await SecureStore.deleteItemAsync(key).catch(() => {});
}

const ExpoSecureStoreAdapter = {
  getItem:    getChunked,
  setItem:    setChunked,
  removeItem: removeChunked,
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage:            ExpoSecureStoreAdapter,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
  },
});
