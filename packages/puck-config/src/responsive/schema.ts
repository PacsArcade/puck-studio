import {
  createRegistry,
  screenVariantsFromBreakpoints,
  type ComboKey,
  type VariantRegistry,
} from "@pacsarcade/variant-engine";
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
};

export const DEFAULT_STYLE: StyleProps = {
  font: "default",
  size: 0,
  kerning: 0,
  lineHeight: 0,
  color: "default",
  spaceAbove: 0,
  spaceBelow: 0,
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
