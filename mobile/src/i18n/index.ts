// ============================================================
// WASEET — i18n Configuration
// Uses i18next + react-i18next + expo-localization
// Supports Arabic (RTL, default) and English (LTR)
// Language preference stored in AsyncStorage
// ============================================================

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';

import ar from './ar.json';
import en from './en.json';

export type Lang = 'ar' | 'en';
export const LANG_KEY = '@waseet_language';
export const DEFAULT_LANG: Lang = 'ar';

// ── Read stored language preference ──────────────────────────

export async function getStoredLang(): Promise<Lang> {
  try {
    const stored = await AsyncStorage.getItem(LANG_KEY);
    if (stored === 'ar' || stored === 'en') return stored;
  } catch { /* fallback */ }

  // No stored preference → always default to Arabic
  return DEFAULT_LANG;
}

// ── Apply RTL direction for the given language ────────────────
// Must be called before React renders for native layout direction.
// Full effect only available on native restart; JS-layer direction
// changes take effect immediately on navigator remount.

export function applyRTL(lang: Lang) {
  const isRTL = lang === 'ar';
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(isRTL);
}

// ── Initialize i18next ────────────────────────────────────────

export async function initI18n(): Promise<Lang> {
  const lang = await getStoredLang();
  applyRTL(lang);

  await i18n
    .use(initReactI18next)
    .init({
      resources:        { ar: { translation: ar }, en: { translation: en } },
      lng:              lang,
      fallbackLng:      DEFAULT_LANG,
      interpolation:    { escapeValue: false },
      compatibilityJSON:'v4',
    });

  return lang;
}

// ── Change language at runtime ────────────────────────────────

export async function changeLanguage(lang: Lang): Promise<void> {
  await AsyncStorage.setItem(LANG_KEY, lang);
  await i18n.changeLanguage(lang);
  applyRTL(lang);
}

export default i18n;
