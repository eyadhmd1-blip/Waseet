import { StyleSheet } from 'react-native';

export const COLORS = {
  bg:           '#0F172A',
  surface:      '#1E293B',
  border:       '#334155',
  textPrimary:  '#F1F5F9',
  textSecondary:'#94A3B8',
  textMuted:    '#475569',
  accent:       '#F59E0B',
  accentDim:    '#1C1A0E',
};

export const ROUTES = {
  AUTH:     '(auth)',
  CLIENT:   '(client)',
  PROVIDER: '(provider)',
} as const;

// Base style shared between both tab layouts.
// height / paddingBottom are set dynamically with useSafeAreaInsets()
// in each _layout.tsx so the bar always clears the home indicator.
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

// Legacy export — layouts will import TAB_BASE_OPTIONS instead.
export const TAB_SCREEN_OPTIONS = TAB_BASE_OPTIONS;
