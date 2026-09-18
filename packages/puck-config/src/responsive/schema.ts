import {
  createRegistry,
  screenVariantsFromBreakpoints,
  type ComboKey,
  type VariantRegistry,
} from "@frens-earth/variant-engine";
import type { BrandTokens } from "../tokens";

/**
 * Responsive schema (Phase 2 step 2) — the shared style-system types plus
 * the bridge from BrandTokens.breakpoints to a variant registry.
 *
 * StyleProps moved here from index.tsx so the responsive layer (css.ts,
 * field.tsx) and the registry share ONE definition without an import cycle.
 */

export type Align = "left" | "center" | "right";
export type FontKey = "default" | "display" | "body" | "accent";

/** colour is a plain string: "default", a house token key, or a "#hex" */
export type StyleProps = {
  font: FontKey;
  size: number;
  kerning: number;
  lineHeight: number;
  color: string;
  spaceAbove: number;
  spaceBelow: number;
  /**
   * font-weight (T-341, H130 ruling 0018.06.27): the ONE named new key —
   * a bounded stepped set (400/500/600/700), never a free number. OPTIONAL
   * and absent from DEFAULT_STYLE on purpose: absent = inherit, no decl
   * emitted (typo()/typoDecls's `if (s.weight)` twin) — unlike the other
   * StyleProps numbers, 0 is not this prop's "unset" value, undefined is.
   */
  weight?: number;
};

export const DEFAULT_STYLE: StyleProps = {
  font: "default",
  size: 0,
  kerning: 0,
  lineHeight: 0,
  color: "default",
  spaceAbove: 0,
  spaceBelow: 0,
  // weight intentionally absent — see the StyleProps doc comment above.
};

export type BreakpointKey = "tablet" | "desktop";

/**
 * The optional per-block override prop: sparse StyleProps layers keyed by
 * combo key ("tablet", "desktop"). Absent or empty = the block renders on
 * today's exact inline path — the untouched-path guarantee.
 */
export type StyleVariants = Partial<Record<ComboKey, Partial<StyleProps>>>;

const REGISTRY_CACHE = new WeakMap<BrandTokens, VariantRegistry>();

/** Memoized: one registry per BrandTokens object (breakpoints are data). */
export function registryFor(tokens: BrandTokens): VariantRegistry {
  let reg = REGISTRY_CACHE.get(tokens);
  if (!reg) {
    reg = createRegistry(screenVariantsFromBreakpoints(tokens.breakpoints));
    REGISTRY_CACHE.set(tokens, reg);
  }
  return reg;
}
