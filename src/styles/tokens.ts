/**
 * Design tokens for field use (docs/ux.md C.2).
 *
 * Exported from TypeScript as well as CSS so the accessibility check in
 * tokens.test.ts can assert the contrast ratios instead of us eyeballing them.
 * The colours here are the single source of truth; styles/tokens.css mirrors
 * them as custom properties.
 */

/**
 * Minimum touch target, in CSS pixels.
 *
 * C.2 principle 2 asks for 48×48pt. With the viewport meta tag the app uses, one
 * CSS pixel is one device-independent pixel, which is the unit both Material
 * (48dp) and HIG (44pt) state their minimums in — so 48 CSS px is that rule, not
 * a smaller approximation of it.
 */
export const TOUCH_TARGET_MIN_PX = 48;

/** Primary actions sit lower and are bigger: they are hit with a thumb, often one-handed. */
export const PRIMARY_TOUCH_TARGET_PX = 64;

export const COLORS = {
  /** Page and surface colours. Deliberately near-white, not grey-on-grey. */
  background: '#ffffff',
  surface: '#f2f4f6',
  surfaceRaised: '#ffffff',
  border: '#5b6670',

  /** Body text. C.2 principle 3 rules out thin grey text on white. */
  text: '#14181c',
  textMuted: '#454e57',
  textInverse: '#ffffff',

  brand: '#0b3d5c',
  brandText: '#ffffff',

  /** Sync states (Flow E): grey / amber / green. */
  syncOffline: '#3c4650',
  syncPending: '#7a4100',
  syncDone: '#0d6034',

  danger: '#a1121b',
  focusRing: '#0b3d5c',
} as const;

export type ColorToken = keyof typeof COLORS;

/**
 * Condition colours (C.5: the same colour means the same thing everywhere).
 *
 * Each condition sits on its own luminance tier, not just its own hue. Hue alone
 * fails twice over in this app: on a screen washed out by direct sun, and for
 * the red/green confusions that are the common colour-vision deficiencies —
 * which is exactly the good/damaged pair. Every chip also carries its text
 * label, so colour is never the only signal.
 *
 * `not_applicable` is deliberately the quiet one: "nothing to report" should not
 * shout as loudly as "damaged".
 */
export const CONDITION_COLORS = {
  good: { fill: '#14663a', text: '#ffffff' },
  traces_of_use: { fill: '#d18200', text: '#14181c' },
  damaged: { fill: '#8c0f16', text: '#ffffff' },
  not_applicable: { fill: '#cfd6dc', text: '#14181c' },
  not_inspected: { fill: '#454e57', text: '#ffffff' },
} as const;

// --- contrast helpers, used by the accessibility test ----------------------

function channelLuminance(value: number): number {
  const normalised = value / 255;
  return normalised <= 0.04045
    ? normalised / 12.92
    : Math.pow((normalised + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (
    0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
  );
}

/** WCAG 2.1 contrast ratio between two hex colours. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
