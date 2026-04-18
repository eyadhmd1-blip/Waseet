import { StyleSheet } from 'react-native';

export const COLORS = {
  bg:            '#060E28',
  surface:       '#0C1C45',
  border:        '#1B3568',
  textPrimary:   '#EEF4FF',
  textSecondary: '#7DAFD6',
  textMuted:     '#3A5C80',
  accent:        '#C9A84C',
  gold2:         '#E8C96A',
  accentDim:     '#18120A',
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
