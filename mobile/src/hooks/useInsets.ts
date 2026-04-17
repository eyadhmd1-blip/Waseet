// ============================================================
// useInsets — Centralised safe-area inset values
// Use instead of hardcoded paddingTop: 60 everywhere.
//
//   const { top, bottom, headerPad, contentPad } = useInsets();
//
//   top        — raw status-bar height (e.g. 44 on iPhone, 24–60 on Android)
//   bottom     — home-indicator / nav-bar height (0–34 depending on device)
//   headerPad  — safe paddingTop for screen headers  (top + 12)
//   contentPad — safe paddingBottom for scroll views (bottom + 24)
// ============================================================

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useInsets() {
  const insets = useSafeAreaInsets();

  return {
    top:        insets.top,
    bottom:     insets.bottom,
    headerPad:  insets.top + 12,
    contentPad: insets.bottom + 24,
  };
}
