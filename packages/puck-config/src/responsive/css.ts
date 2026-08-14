import {
  comboKey,
  comboScreenSpec,
  cssClassName,
  emitBlockCss,
  parseComboKey,
  sortCombos,
  type CssLayer,
} from "@pacsarcade/variant-engine";
import { colorCss, fontCss, type BrandTokens } from "../tokens";
import {
  registryFor,
  type Align,
  type StyleProps,
  type StyleVariants,
} from "./schema";

/**
 * The responsive CSS path — decl-record TWINS of index.tsx's inline
 * typo()/box(). These two are the ONLY source of decls for generated
 * sheets; keep them in lockstep with the inline pair.
 *
 * THE LAW OF THIS FILE: inline styles beat stylesheets. So for a block
 * WITH overrides, EVERY style-system property — including the block's own
 * hardcoded inline defaults (e.g. Text's fontSize ".98rem" / lineHeight
 * 1.85) — moves OUT of inline INTO the base layer of the generated sheet,
 * where a media block can win by source order. Equal specificity
 * (single-class selectors), no !important.
 */

export type DeclRecord = Record<string, string>;

/** A styled block's hardcoded inline defaults, split by element. */
export type BlockStyleDefaults = { typo?: DeclRecord; box?: DeclRecord };

/**
 * Typography decls for an element (twin of typo(): size 0 / line-height 0
 * = inherit, i.e. no decl — which is why the field layer deletes override
 * keys instead of writing 0).
 */
export function typoDecls(
  style: Partial<StyleProps> | undefined,
  tokens: BrandTokens,
  hardcodedDefaults?: DeclRecord
): DeclRecord {
  const d: DeclRecord = { ...(hardcodedDefaults ?? {}) };
  if (!style) return d;
  if (style.font && style.font !== "default") {
    const f = fontCss(tokens, style.font);
    if (f) d["font-family"] = f;
  }
  if (style.size) d["font-size"] = `${style.size}px`;
  if (style.kerning) d["letter-spacing"] = `${style.kerning}px`;
  if (style.lineHeight) d["line-height"] = String(style.lineHeight);
  if (style.color && style.color !== "default") {
    const c = colorCss(tokens, style.color);
    if (c) d["color"] = c;
  }
  return d;
}

/**
 * Wrapper decls (twin of box()): alignment + vertical spacing. Variant
 * layers pass align undefined — alignment is not a varianted prop.
 */
export function boxDecls(
  align: Align | undefined,
  style: Partial<StyleProps> | undefined,
  hardcodedDefaults?: DeclRecord
): DeclRecord {
  const d: DeclRecord = { ...(hardcodedDefaults ?? {}) };
  if (align) d["text-align"] = align;
  if (style?.spaceAbove) d["margin-top"] = `${style.spaceAbove}px`;
  if (style?.spaceBelow) d["margin-bottom"] = `${style.spaceBelow}px`;
  return d;
}

export interface StyleVariantsCss {
  /** class for the wrapper element (alignment + spacing) */
  boxClass: string;
  /** class for the text element (typography) */
  typoClass: string;
  /** the block's generated sheet: box rules then typo rules */
  cssText: string;
}

/**
 * Build the generated sheet for one block, or null when styleVariants is
 * absent/empty (or the block has no id) — the null return IS the
 * untouched-path guarantee: callers fall through to today's exact inline
 * render.
 */
export function styleVariantsCss(
  id: string,
  align: Align,
  style: StyleProps | undefined,
  styleVariants: StyleVariants | undefined,
  tokens: BrandTokens,
  blockDefaults?: BlockStyleDefaults
): StyleVariantsCss | null {
  if (!styleVariants) return null;
  const entries = Object.entries(styleVariants).filter(
    ([key, values]) => key && values && Object.keys(values).length > 0
  ) as [string, Partial<StyleProps>][];
  if (entries.length === 0) return null;
  if (!id) return null;

  const reg = registryFor(tokens);
  const valuesByKey = new Map<string, Partial<StyleProps>>(
    entries.map(([key, values]) => [comboKey(reg, parseComboKey(key)), values])
  );
  const orderedCombos = sortCombos(
    reg,
    entries.map(([key]) => parseComboKey(key))
  );

  // Base layer = hardcoded defaults merged with base style decls.
  const boxLayers: CssLayer[] = [
    { decls: boxDecls(align, style, blockDefaults?.box) },
  ];
  const typoLayers: CssLayer[] = [
    { decls: typoDecls(style, tokens, blockDefaults?.typo) },
  ];
  for (const combo of orderedCombos) {
    const values = valuesByKey.get(comboKey(reg, combo));
    if (!values) continue;
    // intersection of the combo's screen windows — engine-owned since 0.3.0
    const screen = comboScreenSpec(reg, combo) ?? undefined;
    boxLayers.push({ screen, decls: boxDecls(undefined, values) });
    typoLayers.push({ screen, decls: typoDecls(values, tokens) });
  }

  const boxClass = cssClassName("sv-box", id);
  const typoClass = cssClassName("sv-typo", id);
  const cssText = [
    emitBlockCss(boxClass, boxLayers, reg.strategy),
    emitBlockCss(typoClass, typoLayers, reg.strategy),
  ]
    .filter(Boolean)
    .join("\n");

  return { boxClass, typoClass, cssText };
}
