import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { CATEGORY_GROUPS } from '../constants/categories';
import type { CategoryGroup, ServiceCategory } from '../types';

const CACHE_KEY    = 'waseet_categories_v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

type CacheEntry = { ts: number; groups: CategoryGroup[] };

function rowsToGroups(rows: any[]): CategoryGroup[] {
  const map = new Map<string, CategoryGroup>();
  for (const row of rows) {
    if (!map.has(row.group_slug)) {
      map.set(row.group_slug, {
        slug: row.group_slug,
        name_ar: row.group_ar,
        name_en: row.group_en ?? '',
        categories: [],
      });
    }
    map.get(row.group_slug)!.categories.push({
      id:         row.id,
      slug:       row.slug,
      name_ar:    row.name_ar,
      name_en:    row.name_en ?? row.name_ar,
      group_slug: row.group_slug,
      group_ar:   row.group_ar,
      group_en:   row.group_en ?? '',
      icon:       row.icon ?? 'wrench',
      sort_order: row.sort_order,
      is_active:  row.is_active,
    } as ServiceCategory);
  }
  return Array.from(map.values());
}

export function useCategories() {
  // Start with hardcoded data immediately — no flicker on first render
  const [groups, setGroups] = useState<CategoryGroup[]>(CATEGORY_GROUPS);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 1. Check AsyncStorage cache first
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw) {
          const entry: CacheEntry = JSON.parse(raw);
          if (Date.now() - entry.ts < CACHE_TTL_MS && entry.groups.length > 0) {
            if (!cancelled) setGroups(entry.groups);
            return;
          }
        }
      } catch {}

      // 2. Fetch fresh data from DB
      try {
        const { data, error } = await supabase
          .from('service_categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (error || !data || data.length === 0) return;

        const fetched = rowsToGroups(data);
        if (!cancelled && fetched.length > 0) {
          setGroups(fetched);
          await AsyncStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ ts: Date.now(), groups: fetched })
          ).catch(() => {});
        }
      } catch {}
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { groups };
}
