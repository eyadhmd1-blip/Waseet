import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  'https://bkbjsstxhvdnqcmpuulf.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrYmpzc3R4aHZkbnFjbXB1dWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMjY3ODcsImV4cCI6MjA5MTgwMjc4N30.-B_KTG1LYlKBlNCWjQhLKYfkp5lXN4xhIm1oMYhHsE4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage:            AsyncStorage,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
  },
});
