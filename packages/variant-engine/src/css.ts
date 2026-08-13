import type { ResponsiveStrategy } from "./index";
import type { ScreenSpec } from "./screen";

/**
 * CSS emission — the write side of the engine.
 *
 * One block with overrides = one generated sheet: a base rule first
 * (hardcoded defaults merged with base style decls — inline styles beat
 * stylesheets, so anything a variant may override MUST live here, not
 * inline), then @media blocks in strategy order (mobileFirst: ascending
 * min-width). Every selector is a single class — equal specificity,
 * source order wins, NO !important.
 */

/** djb2 → base36, 4 chars — collision guard for sanitized ids. */
const hash4 = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36).padStart(4, "0").slice(-4);
};

/**
 * A safe, stable class name from an arbitrary block id: the raw id
 * sanitized to [A-Za-z0-9_-] plus a 4-char hash OF THE RAW id (so "a b"
 * and "a-b" cannot collide after sanitizing).
 */
export const cssClassName = (prefix: string, rawId: string): string =>
  `${prefix}-${rawId.replace(/[^A-Za-z0-9_-]/g, "-")}-${hash4(rawId)}`;

/** "(min-width: 768px)", "(max-width: 1079px)", or both joined by " and ". */
export const mediaText = (spec: ScreenSpec): string => {
  const parts: string[] = [];
  if (spec.minWidth !== undefined)
    parts.push(`(min-width: ${spec.minWidth}px)`);
  if (spec.maxWidth !== undefined)
    parts.push(`(max-width: ${spec.maxWidth}px)`);
  return parts.join(" and ");
};

export interface CssLayer {
  /** absent = base layer (or a non-screen combo — also folds into base) */
  screen?: ScreenSpec;
  /** CSS property → value, property names already in CSS (kebab) form */
  decls: Record<string, string>;
}

const rule = (
  indent: string,
  className: string,
  decls: Record<string, string>
): string => {
  const lines = Object.entries(decls).map(
    ([prop, value]) => `${indent}  ${prop}: ${value};`
  );
  return `${indent}.${className} {\n${lines.join("\n")}\n${indent}}`;
};

/**
 * Emit the block's sheet: base rule first (all screen-less layers merged,
 * insertion order), then one @media block per screen layer, sorted by the
 * strategy (mobileFirst: ascending min-width; desktopFirst: descending
 * max-width; unknown: given order). Empty layers are skipped.
 */
export function emitBlockCss(
  className: string,
  layers: CssLayer[],
  strategy: ResponsiveStrategy
): string {
  const baseDecls: Record<string, string> = {};
  for (const layer of layers) {
    if (!layer.screen) Object.assign(baseDecls, layer.decls);
  }

  const media = layers.filter(
    (l): l is CssLayer & { screen: ScreenSpec } => l.screen !== undefined
  );
  const sorted = media
    .map((layer, i) => ({ layer, i }))
    .sort((a, b) => {
      if (strategy === "mobileFirst")
        return (
          (a.layer.screen.minWidth ?? 0) - (b.layer.screen.minWidth ?? 0) ||
          a.i - b.i
        );
      if (strategy === "desktopFirst")
        return (
          (b.layer.screen.maxWidth ?? 0) - (a.layer.screen.maxWidth ?? 0) ||
          a.i - b.i
        );
      return a.i - b.i;
    })
    .map((x) => x.layer);

  const out: string[] = [];
  if (Object.keys(baseDecls).length > 0)
    out.push(rule("", className, baseDecls));
  for (const m of sorted) {
    if (Object.keys(m.decls).length === 0) continue;
    out.push(
      `@media ${mediaText(m.screen)} {\n${rule("  ", className, m.decls)}\n}`
    );
  }
  return out.join("\n");
}
