// ============================================================
// theme.ts — App-wide design tokens
//
// COLORS is kept as the dark palette for any legacy module-level
// usage. All new code should use useTheme() from ThemeContext.
// ============================================================

import type { AppColors } from './colors';
import { darkColors } from './colors';

// Re-export for backward compatibility with any module-level
// StyleSheet.create that hasn't been migrated yet.
// Phase 1 migration replaces these usages with useTheme().
export const COLORS = darkColors;

export const ROUTES = {
  AUTH:     '(auth)',
  CLIENT:   '(client)',
  PROVIDER: '(provider)',
} as const;

// ── Tab bar factories (accept live colors from useTheme) ──────

export function makeTabBarStyle(colors: AppColors, insetBottom: number) {
  return {
    backgroundColor: colors.bg,
    borderTopColor:  colors.border,
    borderTopWidth:  1  as const,
    height:          56 + insetBottom,
    paddingBottom:   insetBottom + 4,
    paddingTop:      4  as const,
  };
}

export function makeTabOptions(colors: AppColors) {
  return {
    headerShown:             false,
    tabBarActiveTintColor:   colors.accent,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarLabelStyle:        { fontSize: 11, fontWeight: '600' as const },
  };
}

// Legacy static exports — used by tab layouts until they are migrated.
// Will be removed once makeTabBarStyle / makeTabOptions are wired in.
export const TAB_BAR_BASE_STYLE = {
  backgroundColor: COLORS.bg,
  borderTopColor:  COLORS.border,
  borderTopWidth:  1 as const,
};

export const TAB_BASE_OPTIONS = {
  headerShown:             false,
  tabBarActiveTintColor:   COLORS.accent,
  tabBarInactiveTintColor: COLORS.textMuted,
  tabBarLabelStyle:        { fontSize: 11, fontWeight: '600' as const },
};

export const TAB_SCREEN_OPTIONS = TAB_BASE_OPTIONS;
