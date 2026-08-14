import {
  provenance,
  type Provenance,
  type VariantCombo,
} from "@pacsarcade/variant-engine";
import type { BrandTokens } from "../tokens";
import { BLOCK_STYLE_DEFAULTS } from "../index";
import { registryFor, type StyleProps, type StyleVariants } from "./schema";

/**
 * House provenance (Phase 2 step 4) — the bridge between the generic
 * engine walk and the fleet's style-system semantics:
 *  - 0 / "default" IS the base's unset sentinel (typo()/typoDecls emit no
 *    decl for them), so a sentinel base value really comes from a default;
 *  - whether that default is the BLOCK's (a hardcoded inline default in
 *    BLOCK_STYLE_DEFAULTS) or the BRAND's (the site stylesheet) is decided
 *    by mapping the style prop to its CSS property and looking it up in
 *    the block's decl records.
 *
 * NOTE: this module imports from ../index, which imports the field layer,
 * which imports this module — a deliberate, benign cycle: the only access
 * to BLOCK_STYLE_DEFAULTS happens at CALL time (inside styleProvenance),
 * long after every module in the loop has finished evaluating.
 */

/** style-system prop → the CSS property its decl twins emit */
export const PROP_TO_CSS: Record<keyof StyleProps, string> = {
  font: "font-family",
  size: "font-size",
  kerning: "letter-spacing",
  lineHeight: "line-height",
  color: "color",
  spaceAbove: "margin-top",
  spaceBelow: "margin-bottom",
};

/** does a decl record cover the CSS property (or its shorthand — Quote's
 *  `margin: "0"` covers margin-top/margin-bottom)? */
const declCovers = (
  decls: Record<string, string> | undefined,
  css: string
): boolean => {
  if (!decls) return false;
  if (css in decls) return true;
  const shorthand = css.split("-")[0];
  return shorthand !== css && shorthand in decls;
};

/** Provenance of one style prop at the target combo, house rules applied. */
export function styleProvenance(
  tokens: BrandTokens,
  blockType: string,
  base: StyleProps,
  settings: StyleVariants,
  target: VariantCombo,
  prop: keyof StyleProps
): Provenance<StyleProps> {
  const reg = registryFor(tokens);
  return provenance(reg, base, settings, target, prop, {
    isUnsetBase: (v) => v === 0 || v === "default",
    hasBlockDefault: (p) => {
      const defaults = BLOCK_STYLE_DEFAULTS[blockType];
      if (!defaults) return false;
      const css = PROP_TO_CSS[p];
      return declCovers(defaults.typo, css) || declCovers(defaults.box, css);
    },
  });
}
