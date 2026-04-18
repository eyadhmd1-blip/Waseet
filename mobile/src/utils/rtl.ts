// ============================================================
// rtl.ts — RTL-aware style helpers
//
// All functions accept `isRTL` from useLanguage() and return
// values safe to use as inline style overrides in JSX.
//
// Usage:
//   const { isRTL, ta } = useLanguage();
//   <View style={{ flexDirection: flexRow(isRTL) }}>
//   <View style={me(12, isRTL)}>   ← margin on trailing (end) edge
// ============================================================

import type { TextStyle, FlexStyle, ViewStyle } from 'react-native';

// ─── Text ────────────────────────────────────────────────────

/** textAlign pointing to the reading start (right in AR, left in EN) */
export const textStart = (isRTL: boolean): TextStyle['textAlign'] =>
  isRTL ? 'right' : 'left';

/** textAlign pointing to the reading end */
export const textEnd = (isRTL: boolean): TextStyle['textAlign'] =>
  isRTL ? 'left' : 'right';

// ─── Flex ────────────────────────────────────────────────────

/** flexDirection aware of reading direction */
export const flexRow = (isRTL: boolean): FlexStyle['flexDirection'] =>
  isRTL ? 'row-reverse' : 'row';

/** alignItems at the leading (start) edge */
export const alignStart = (isRTL: boolean): FlexStyle['alignItems'] =>
  isRTL ? 'flex-end' : 'flex-start';

/** alignItems at the trailing (end) edge */
export const alignEnd = (isRTL: boolean): FlexStyle['alignItems'] =>
  isRTL ? 'flex-start' : 'flex-end';

/** alignSelf at the leading (start) edge */
export const selfStart = (isRTL: boolean): ViewStyle['alignSelf'] =>
  isRTL ? 'flex-end' : 'flex-start';

/** alignSelf at the trailing (end) edge */
export const selfEnd = (isRTL: boolean): ViewStyle['alignSelf'] =>
  isRTL ? 'flex-start' : 'flex-end';

// ─── Margins (start = leading edge, end = trailing edge) ─────

/** Margin on the leading (start) edge */
export const ms = (v: number, isRTL: boolean): ViewStyle =>
  isRTL ? { marginRight: v } : { marginLeft: v };

/** Margin on the trailing (end) edge */
export const me = (v: number, isRTL: boolean): ViewStyle =>
  isRTL ? { marginLeft: v } : { marginRight: v };

// ─── Padding ─────────────────────────────────────────────────

/** Padding on the leading (start) edge */
export const ps = (v: number, isRTL: boolean): ViewStyle =>
  isRTL ? { paddingRight: v } : { paddingLeft: v };

/** Padding on the trailing (end) edge */
export const pe = (v: number, isRTL: boolean): ViewStyle =>
  isRTL ? { paddingLeft: v } : { paddingRight: v };

// ─── Absolute positioning ─────────────────────────────────────

/** Absolute position pinned to the leading (start) edge */
export const startPos = (v: number, isRTL: boolean): ViewStyle =>
  isRTL ? { right: v } : { left: v };

/** Absolute position pinned to the trailing (end) edge */
export const endPos = (v: number, isRTL: boolean): ViewStyle =>
  isRTL ? { left: v } : { right: v };
