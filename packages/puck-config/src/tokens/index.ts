/**
 * Design tokens -- Phase 1, build step 1 of the Rails Spec.
 *
 * A brand's design decisions as DATA: one BrandTokens object per brand.
 * Three consumers read the same object, which is the whole point:
 *   1. the Style Inspector -- swatches, font menus, and slider bounds are
 *      generated from it (change a token, the studio follows);
 *   2. the guardrail lint (packages/plugin-rails, step 4) -- "on-brand"
 *      means "resolvable in the brand's tokens", severities come from
 *      `rails` (config, not code);
 *   3. the AI copilot -- the tokens are its vocabulary, so generated pages
 *      stay on-brand by construction.
 *
 * Colour contrast grades are MEASURED (WCAG relative luminance), never
 * assumed -- see `contrastRatio` and each brand file's recorded grades.
 */

export type ThemeName = "night" | "dawn";

/** How a colour token behaves as TEXT on a theme's ground. */
export type ContrastGrade = "aa" | "large" | "fails";

export interface ColorToken {
  /** what renders emit -- usually a CSS custom property so live theming works */
  css: string;
  /** resolved hex on the dark theme ground */
  night: string;
  /** resolved hex on the light theme ground (may equal night if not overridden) */
  dawn: string;
  label: string;
  /** measured contrast grade as text on each theme's ground */
  grade: { night: ContrastGrade; dawn: ContrastGrade };
}

export interface FontToken {
  css: string;
  label: string;
  serif: boolean;
}

export interface PaletteSlot {
  key: "p1" | "p2" | "p3" | "p4" | "p5";
  label: string;
  hint: string;
  value: string;
}

export type Severity = "error" | "warn" | "off";

export interface RuleSeverity {
  brand: Severity;
  play: Severity;
}

/** The 13 guardrail rules of the Rails Spec (W8). */
export const RULE_IDS = [
  "one-h1",
  "heading-order",
  "contrast-min",
  "token-only",
  "no-serif",
  "slot-allow",
  "nesting-depth",
  "tap-target",
  "thumb-reach",
  "body-size",
  "alt-text",
  "motion-safe",
  "empty-slot",
] as const;

export type RuleId = (typeof RULE_IDS)[number];

export type BrandRails = Record<RuleId, RuleSeverity>;

export interface BrandTokens {
  id: string;
  name: string;
  /** theme grounds, for contrast math and swatch sheets */
  grounds: { night: string; dawn: string };
  colors: Record<string, ColorToken>;
  fonts: Record<string, FontToken>;
  /** the 5-slot brand palette -- what the dice roll and promote-to-token write */
  palette: PaletteSlot[];
  type: {
    basePx: number;
    ratio: number;
    sizes: {
      display: number;
      h1: number;
      h2: number;
      h3: number;
      body: number;
      small: number;
    };
    bounds: {
      sizePx: [number, number];
      kerningPx: [number, number];
      lineHeight: [number, number];
    };
  };
  spacing: { stops: number[]; maxPx: number };
  breakpoints: { tabletMin: number; desktopMin: number };
  rails: BrandRails;
}

/** Resolve a colour field value against the brand: "default" passes through,
 *  a token key resolves to its css, a palette slot (p1-p5) resolves to its
 *  live CSS variable (the host sets --p1..--p5 from the saved brand palette,
 *  so re-rolling the palette re-skins every block that picked a slot), and a
 *  raw "#hex" passes through (play lane). */
export function colorCss(
  tokens: BrandTokens,
  value: string | undefined
): string | undefined {
  if (!value || value === "default") return undefined;
  if (value.startsWith("#")) return value;
  if (/^p[1-5]$/.test(value)) return `var(--${value})`;
  return tokens.colors[value]?.css ?? value;
}

/** Resolve a font field value against the brand's font tokens. */
export function fontCss(
  tokens: BrandTokens,
  value: string | undefined
): string | undefined {
  if (!value || value === "default") return undefined;
  return tokens.fonts[value]?.css;
}

/** WCAG 2.x relative-luminance contrast ratio between two hex colours. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lum = (hex: string): number => {
    const h = hex.replace("#", "");
    const chan = (i: number): number => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * chan(0) + 0.7152 * chan(2) + 0.0722 * chan(4);
  };
  const [a, b] = [lum(hexA), lum(hexB)];
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Grade a text colour on a ground: aa >= 4.5, large >= 3, else fails. */
export function gradeOn(textHex: string, groundHex: string): ContrastGrade {
  const r = contrastRatio(textHex, groundHex);
  return r >= 4.5 ? "aa" : r >= 3 ? "large" : "fails";
}

export { STARTER } from "./starter";
