// ============================================================
// layout.ts — Safe-area helpers usable at module level
// (i.e. inside StyleSheet.create which runs outside components)
//
// For accurate dynamic values (when JSX is available), prefer
// the useInsets() hook. This file covers the StyleSheet case.
// ============================================================

import { Platform, StatusBar, Dimensions } from 'react-native';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('screen');

function getStatusBarHeight(): number {
  if (Platform.OS === 'android') {
    return StatusBar.currentHeight ?? 24;
  }
  // iOS: Dynamic Island / notch devices (812+) = 44–59px; older iPhones = 20px
  if (SCREEN_H >= 932) return 59; // iPhone 14 Pro Max / 15 Pro Max
  if (SCREEN_H >= 812) return 44; // iPhone X – 14 Pro
  return 20;
}

/** Status bar height for the current device */
export const STATUS_BAR_H = getStatusBarHeight();

/** Standard top padding for screen headers (status bar + breathing room) */
export const HEADER_PAD = STATUS_BAR_H + 12;

/**
 * Logical screen width — used for responsive calculations in StyleSheet.create.
 * For hook-based dynamic values use useInsets() instead.
 */
export const SCREEN_WIDTH = SCREEN_W;

/**
 * Returns a font size clamped between min and max,
 * scaled relative to a 390px base width (iPhone 14).
 */
export function rs(size: number, min?: number, max?: number): number {
  const scaled = Math.round((size * SCREEN_W) / 390);
  if (min !== undefined && scaled < min) return min;
  if (max !== undefined && scaled > max) return max;
  return scaled;
}

/**
 * Standard bottom padding for scrollable content (clears tab bar + home indicator).
 * Prefer useInsets().contentPad in components; use this only in StyleSheet.create.
 */
export const CONTENT_PAD_BOTTOM = Platform.OS === 'ios' ? 100 : 80;
