import {
  comboKey,
  comboScreenSpec,
  createRegistry,
  mediaText,
  parseComboKey,
  resolve,
  screenVariantsFromBreakpoints,
  sortCombos,
  type ComboKey,
  type VariantCombo,
  type VariantDef,
  type VariantRegistry,
  type VariantedProps,
} from "@pacsarcade/variant-engine";
import type { BrandTokens, PaletteKey, TokenComboKey } from "./index";

/**
 * Varianted tokens (Phase 2 step 5) — the palette becomes variant-aware.
 *
 * DARK-FIRST LAW: night is the base. A slot's `value` IS its night hex;
 * "dawn" is an override layer riding the engine's "toggle" kind, exactly
 * like "tablet" rides "screen". emitTokenVars writes the palette as CSS
 * custom properties (the write side); effectivePalette resolves one combo
 * to five hexes (the read side — lint, swatches, the copilot). Same
 * registry, same sortCombos order, so the emitted cascade and the resolved
 * values can never disagree.
 *
 * Forward-only degradation: combo keys are canonicalized through
 * comboKey(parseComboKey(k)); a key naming a variant this registry does
 * not know is IGNORED, never a throw — a cartridge written for a future
 * registry still renders its known layers today.
 */

/** the theme dimension: one toggle, "dawn" — night is the base, not a key */
export const DAWN_VARIANT: VariantDef = {
  key: "dawn",
  kind: "toggle",
  group: "theme",
};

const REGISTRY_CACHE = new WeakMap<BrandTokens, VariantRegistry>();

/**
 * Memoized: one TOKEN registry per BrandTokens object — the responsive
 * screen variants (from breakpoints) plus the dawn toggle. Distinct from
 * responsive/schema's registryFor, which is screens-only (block style
 * overrides have no theme dimension today).
 */
export function tokenRegistryFor(tokens: BrandTokens): VariantRegistry {
  let reg = REGISTRY_CACHE.get(tokens);
  if (!reg) {
    reg = createRegistry([
      ...screenVariantsFromBreakpoints(tokens.breakpoints),
      DAWN_VARIANT,
    ]);
    REGISTRY_CACHE.set(tokens, reg);
  }
  return reg;
}

/** the host's LIVE palette overrides (KV) — they beat the cartridge */
export interface LivePaletteOverrides {
  /** per-slot base (night) hex — beats slot.value */
  base?: Partial<Record<PaletteKey, string>>;
  /** per-slot per-combo hex — beats the slot's own varianted entries */
  varianted?: Partial<
    Record<PaletteKey, Partial<Record<TokenComboKey, string>>>
  >;
}

/** the pre-0.10 host shape ({ p1: "#hex", … }) — accepted as base-only */
export type LegacyPaletteOverrides = Partial<Record<PaletteKey, string>>;

export interface EmitTokenVarsOptions {
  overrides?: LivePaletteOverrides | LegacyPaletteOverrides;
  /** selector carrying the base (night) palette */
  rootSelector?: string;
  /** selector that marks the document light — the dawn layers' home */
  dawnSelector?: string;
  /** extra selectors that force dawn inside a night document */
  dawnScopes?: string[];
  /** selectors that re-pin the FULL night palette inside a light document
   *  (the `.keep-dark` law) — each gets a copy of the base layer */
  nightScopes?: string[];
}

const isLegacy = (
  o: LivePaletteOverrides | LegacyPaletteOverrides
): o is LegacyPaletteOverrides => !("base" in o) && !("varianted" in o);

const normalizeOverrides = (
  o: LivePaletteOverrides | LegacyPaletteOverrides | undefined
): LivePaletteOverrides => {
  if (!o) return {};
  if (!isLegacy(o)) return o;
  const base: Partial<Record<PaletteKey, string>> = {};
  for (const [k, v] of Object.entries(o)) {
    if (/^p[1-5]$/.test(k) && typeof v === "string" && v) {
      base[k as PaletteKey] = v;
    }
  }
  return { base };
};

interface PaletteLayer {
  combo: VariantCombo;
  key: ComboKey;
  /** sparse slot → hex, iterated in tokens.palette slot order */
  decls: [PaletteKey, string][];
}

/**
 * The shared core: base palette (overrides.base beats slot.value) plus one
 * layer per combo (overrides.varianted beats cartridge varianted), combos
 * canonicalized, unknown keys dropped, sortCombos ordered.
 */
function paletteLayers(
  tokens: BrandTokens,
  overrides: LivePaletteOverrides | LegacyPaletteOverrides | undefined
): {
  reg: VariantRegistry;
  base: Record<PaletteKey, string>;
  layers: PaletteLayer[];
} {
  const reg = tokenRegistryFor(tokens);
  const ov = normalizeOverrides(overrides);

  const canon = (k: string): ComboKey | null => {
    const combo = parseComboKey(k);
    if (combo.length === 0) return null; // the base is `value`, never a key
    const known = combo.every((key) => reg.variants.some((v) => v.key === key));
    return known ? comboKey(reg, combo) : null; // unknown → ignored
  };

  const base = {} as Record<PaletteKey, string>;
  const bySlot = new Map<PaletteKey, Map<ComboKey, string>>();
  for (const slot of tokens.palette) {
    base[slot.key] = ov.base?.[slot.key] ?? slot.value;
    const m = new Map<ComboKey, string>();
    for (const source of [slot.varianted, ov.varianted?.[slot.key]]) {
      for (const [k, v] of Object.entries(source ?? {})) {
        if (typeof v !== "string" || !v) continue;
        const ck = canon(k);
        if (ck !== null) m.set(ck, v); // later source (overrides) wins
      }
    }
    if (m.size > 0) bySlot.set(slot.key, m);
  }

  const comboKeys = new Set<ComboKey>();
  for (const m of bySlot.values()) for (const k of m.keys()) comboKeys.add(k);
  const combos = sortCombos(reg, [...comboKeys].map(parseComboKey));

  const layers: PaletteLayer[] = combos.map((combo) => {
    const key = comboKey(reg, combo);
    const decls: [PaletteKey, string][] = [];
    for (const slot of tokens.palette) {
      const v = bySlot.get(slot.key)?.get(key);
      if (v !== undefined) decls.push([slot.key, v]);
    }
    return { combo, key, decls };
  });

  return { reg, base, layers };
}

/** one compact rule — the exact PaletteVars byte format the fleet ships */
const cssRule = (selector: string, decls: [string, string][]): string =>
  `${selector}{${decls.map(([k, v]) => `--${k}:${v}`).join(";")}}`;

/**
 * Emit the brand palette as CSS custom properties, layered by variant:
 *
 *   :root{--p1:…;--p2:…;--p3:…;--p4:…;--p5:…}          ← base = NIGHT
 *   @media (min-width: …){:root{…}}                     ← screen combos
 *   html[data-oc-theme="light"],<dawnScopes>{…}          ← dawn combo
 *   @media (min-width: …){html[…],<dawnScopes>{…}}       ← dawn+screen
 *   <nightScopes>{full base copy}                        ← keep-dark law
 *
 * Rules in sortCombos order (screen < theme < theme+screen), one line
 * each, joined by "\n". Equal work resolves by cascade: the dawn selector
 * out-specifies :root on the same html element, and nightScopes re-pin by
 * inheritance proximity. NO !important anywhere. With no varianted data
 * and no overrides the output is EXACTLY the single :root line (plus the
 * nightScopes copies) — byte-identical to the host's legacy PaletteVars.
 */
export function emitTokenVars(
  tokens: BrandTokens,
  opts?: EmitTokenVarsOptions
): string {
  const rootSelector = opts?.rootSelector ?? ":root";
  const dawnSelector = opts?.dawnSelector ?? 'html[data-oc-theme="light"]';
  const dawnScopes = opts?.dawnScopes ?? [];
  const nightScopes = opts?.nightScopes ?? [];

  const { reg, base, layers } = paletteLayers(tokens, opts?.overrides);
  const baseDecls: [string, string][] = tokens.palette.map((s) => [
    s.key,
    base[s.key],
  ]);

  const out: string[] = [cssRule(rootSelector, baseDecls)];
  for (const { combo, decls } of layers) {
    if (decls.length === 0) continue;
    const selector = combo.includes(DAWN_VARIANT.key)
      ? [dawnSelector, ...dawnScopes].join(",")
      : rootSelector;
    const rule = cssRule(selector, decls);
    const screen = comboScreenSpec(reg, combo);
    out.push(screen ? `@media ${mediaText(screen)}{${rule}}` : rule);
  }
  if (nightScopes.length > 0) {
    out.push(cssRule(nightScopes.join(","), baseDecls));
  }
  return out.join("\n");
}

/**
 * The read twin of emitTokenVars: the five effective hexes under a combo,
 * resolve()-based so it inherits the engine's ancestry and specificity —
 * [] is night; ["dawn"] is dawn with per-slot fallback to night;
 * ["dawn","tablet"] stacks tablet, dawn, then tablet+dawn. Overrides (KV)
 * beat the cartridge at every layer.
 */
export function effectivePalette(
  tokens: BrandTokens,
  combo: VariantCombo,
  overrides?: LivePaletteOverrides | LegacyPaletteOverrides
): Record<PaletteKey, string> {
  const { reg, base, layers } = paletteLayers(tokens, overrides);
  const settings: VariantedProps<Record<PaletteKey, string>> = {};
  for (const { key, decls } of layers) {
    settings[key] = Object.fromEntries(decls);
  }
  return resolve(reg, base, settings, combo);
}
