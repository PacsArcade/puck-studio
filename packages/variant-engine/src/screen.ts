import type { VariantCombo, VariantDef, VariantRegistry } from "./index";

/**
 * Screen dimension helpers — the only variant kind live in v0.1.
 *
 * A ScreenSpec is a width window. mobile-first specs carry only minWidth,
 * desktop-first specs only maxWidth; both may combine for a band.
 */
export type ScreenSpec = {
  minWidth?: number;
  maxWidth?: number;
};

/** Inclusive width match: 768 matches { minWidth: 768 }, 767 does not. */
export const matchesWidth = (spec: ScreenSpec, width: number): boolean =>
  (spec.minWidth === undefined || width >= spec.minWidth) &&
  (spec.maxWidth === undefined || width <= spec.maxWidth);

/**
 * The house translation of BrandTokens.breakpoints into screen variants:
 * mobile is the base (no variant), tablet and desktop are min-width
 * overrides — the mobile-first shape the fleet's CSS already speaks.
 */
export const screenVariantsFromBreakpoints = (breakpoints: {
  tabletMin: number;
  desktopMin: number;
}): VariantDef[] => [
  {
    key: "tablet",
    kind: "screen",
    group: "screen",
    screen: { minWidth: breakpoints.tabletMin },
  },
  {
    key: "desktop",
    kind: "screen",
    group: "screen",
    screen: { minWidth: breakpoints.desktopMin },
  },
];

/**
 * ALL screen variants whose spec matches the width, in registry order —
 * at 1200 both tablet (>=768) and desktop (>=1080) are active, which is
 * exactly how min-width media queries stack in the cascade.
 */
export const screenComboForWidth = (
  reg: VariantRegistry,
  width: number
): VariantCombo =>
  reg.variants
    .filter(
      (v) => v.kind === "screen" && v.screen && matchesWidth(v.screen, width)
    )
    .map((v) => v.key);
