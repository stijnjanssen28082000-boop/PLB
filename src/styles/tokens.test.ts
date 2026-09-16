import { describe, expect, it } from 'vitest';
import { SELECTABLE_CONDITIONS } from '@/domain/types';
import { COLORS, CONDITION_COLORS, TOUCH_TARGET_MIN_PX, contrastRatio } from './tokens';

/**
 * The accessibility half of the design check in docs/ux.md §6, as a test rather
 * than a judgement call.
 *
 * The app is used outdoors, in cellars and in direct sun (C.2 principle 3), so
 * the bar here is WCAG AAA (7:1) for normal text rather than the usual AA 4.5:1.
 * Large text — the condition buttons — is held to AAA for large text (4.5:1).
 */

const AAA_NORMAL_TEXT = 7;
const AAA_LARGE_TEXT = 4.5;

describe('colour contrast', () => {
  it('keeps body text far above the normal-text threshold', () => {
    expect(contrastRatio(COLORS.text, COLORS.background)).toBeGreaterThanOrEqual(AAA_NORMAL_TEXT);
    expect(contrastRatio(COLORS.text, COLORS.surface)).toBeGreaterThanOrEqual(AAA_NORMAL_TEXT);
  });

  it('keeps muted text readable instead of thin grey on white', () => {
    // C.2 principle 3 rules out low-contrast grey text outright, so "muted"
    // here means slightly softer, not lighter than the threshold.
    expect(contrastRatio(COLORS.textMuted, COLORS.background)).toBeGreaterThanOrEqual(
      AAA_NORMAL_TEXT,
    );
    expect(contrastRatio(COLORS.textMuted, COLORS.surface)).toBeGreaterThanOrEqual(
      AAA_NORMAL_TEXT,
    );
  });

  it('gives every condition chip text it can carry', () => {
    for (const [condition, { fill, text }] of Object.entries(CONDITION_COLORS)) {
      expect(
        contrastRatio(text, fill),
        `${condition} label on ${fill}`,
      ).toBeGreaterThanOrEqual(AAA_LARGE_TEXT);
    }
  });

  it('separates the four condition buttons by luminance, not only by hue', () => {
    // Scoped to the conditions that appear as buttons side by side in Flow B.
    // That is where a mix-up costs something; `not_inspected` is a fallback
    // state and never sits next to `damaged` as a choice.
    //
    // Luminance rather than hue because two of these are red and green, the
    // common colour-vision confusion, and because direct sun flattens hue long
    // before it flattens brightness.
    for (const a of SELECTABLE_CONDITIONS) {
      for (const b of SELECTABLE_CONDITIONS) {
        if (a >= b) continue;
        expect(
          contrastRatio(CONDITION_COLORS[a].fill, CONDITION_COLORS[b].fill),
          `${a} vs ${b} are too close to tell apart`,
        ).toBeGreaterThan(1.2);
      }
    }
  });

  it('keeps a pale condition chip from disappearing into a white page', () => {
    // not_applicable is intentionally pale, so it leans on the border token to
    // stay a visible shape rather than on its fill.
    for (const [condition, { fill }] of Object.entries(CONDITION_COLORS)) {
      const standsAlone = contrastRatio(fill, COLORS.background) >= 3;
      const hasVisibleBorder = contrastRatio(COLORS.border, fill) >= 3;
      expect(
        standsAlone || hasVisibleBorder,
        `${condition} is neither distinct from the page nor outlined`,
      ).toBe(true);
    }
  });

  it('keeps the sync states legible', () => {
    for (const color of [COLORS.syncOffline, COLORS.syncPending, COLORS.syncDone]) {
      expect(contrastRatio(COLORS.textInverse, color)).toBeGreaterThanOrEqual(AAA_LARGE_TEXT);
      expect(contrastRatio(color, COLORS.background)).toBeGreaterThanOrEqual(AAA_LARGE_TEXT);
    }
  });

  it('keeps borders visible against both surfaces', () => {
    // A border the inspector cannot see in the sun is the same as no border.
    expect(contrastRatio(COLORS.border, COLORS.background)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(COLORS.border, COLORS.surface)).toBeGreaterThanOrEqual(3);
  });
});

describe('touch targets', () => {
  it('holds the field minimum at 48', () => {
    // Guards against the value drifting down to a web-typical 32 or 40 when
    // someone finds the buttons chunky on a desktop screen.
    expect(TOUCH_TARGET_MIN_PX).toBeGreaterThanOrEqual(48);
  });
});
