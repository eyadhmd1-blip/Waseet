// ============================================================
// colors.ts — Theme token definitions
//
// Two palettes: dark (default, existing) and light (new).
// All components read from ThemeContext — never import directly.
// ============================================================

export type AppColors = {
  // Backgrounds
  bg:            string;
  surface:       string;
  surfaceAlt:    string;   // slightly elevated surface (cards inside cards)
  // Borders
  border:        string;
  // Text
  textPrimary:   string;
  textSecondary: string;
  textMuted:     string;
  // Brand accent
  accent:        string;
  accentDark:    string;   // accent for use on light surfaces (contrast-safe)
  gold2:         string;
  accentDim:     string;   // very dark tint for accent backgrounds
  // Status — fixed across themes (semantic, not stylistic)
  error:         string;   // #EF4444
  errorDark:     string;   // #DC2626
  errorBg:       string;   // #7F1D1D
  errorSoft:     string;   // #FCA5A5
  errorDeepBg:   string;   // #450A0A
  success:       string;   // #10B981
  successBg:     string;   // #064E3B
  successSoft:   string;   // #6EE7B7
  successDeepBg: string;   // #14532D
  info:          string;   // #38BDF8
  infoBg:        string;   // #0C4A6E
  infoSoft:      string;   // #7DD3FC
  // Overlay
  overlay:       string;   // rgba for modals
};

export const darkColors: AppColors = {
  bg:            '#060E28',
  surface:       '#0C1C45',
  surfaceAlt:    '#112055',
  border:        '#1B3568',
  textPrimary:   '#EEF4FF',
  textSecondary: '#7DAFD6',
  textMuted:     '#3A5C80',
  accent:        '#C9A84C',
  accentDark:    '#C9A84C',
  gold2:         '#E8C96A',
  accentDim:     '#18120A',
  // Status (same in both themes — semantic colors)
  error:         '#EF4444',
  errorDark:     '#DC2626',
  errorBg:       '#7F1D1D',
  errorSoft:     '#FCA5A5',
  errorDeepBg:   '#450A0A',
  success:       '#10B981',
  successBg:     '#064E3B',
  successSoft:   '#6EE7B7',
  successDeepBg: '#14532D',
  info:          '#38BDF8',
  infoBg:        '#0C4A6E',
  infoSoft:      '#7DD3FC',
  overlay:       'rgba(0,0,0,0.75)',
};

export const lightColors: AppColors = {
  bg:            '#F8F9FC',
  surface:       '#FFFFFF',
  surfaceAlt:    '#F1F5FB',
  border:        '#E2E8F0',
  textPrimary:   '#0F172A',
  textSecondary: '#475569',
  textMuted:     '#94A3B8',
  accent:        '#8B6914',   // darker gold — contrast-safe on white
  accentDark:    '#6B5010',
  gold2:         '#A07820',
  accentDim:     '#FEF3C7',   // warm amber tint for light mode
  // Status (identical — semantic colors are fixed)
  error:         '#EF4444',
  errorDark:     '#DC2626',
  errorBg:       '#FEE2E2',
  errorSoft:     '#991B1B',
  errorDeepBg:   '#FEE2E2',
  success:       '#059669',
  successBg:     '#D1FAE5',
  successSoft:   '#065F46',
  successDeepBg: '#D1FAE5',
  info:          '#0284C7',
  infoBg:        '#DBEAFE',
  infoSoft:      '#1E40AF',
  overlay:       'rgba(15,23,42,0.6)',
};
