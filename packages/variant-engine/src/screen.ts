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
 * The intersection of a combo's screen windows (lifted verbatim from
 * puck-config's responsive/css.ts in 0.3.0 so token emission and block
 * sheets share ONE definition): minWidths max out, maxWidths min out.
 * Non-screen members (toggles, groups) contribute nothing; a combo with
 * no screen members returns null — "no @media wrapper".
 */
export function comboScreenSpec(
  reg: VariantRegistry,
  combo: VariantCombo
): ScreenSpec | null {
  let spec: ScreenSpec | null = null;
  for (const key of combo) {
    const v = reg.variants.find((x) => x.key === key);
    if (v?.kind === "screen" && v.screen) {
      spec = spec ?? {};
      if (v.screen.minWidth !== undefined)
        spec.minWidth = Math.max(spec.minWidth ?? -Infinity, v.screen.minWidth);
      if (v.screen.maxWidth !== undefined)
        spec.maxWidth = Math.min(spec.maxWidth ?? Infinity, v.screen.maxWidth);
    }
  }
  return spec;
}

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
