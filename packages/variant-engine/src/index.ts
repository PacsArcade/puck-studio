import type { ScreenSpec } from "./screen";

/**
 * @pacsarcade/variant-engine — variants + breakpoints (Phase 2 step 2).
 *
 * Framework-free and zero-dependency: a registry of VARIANT DIMENSIONS, a
 * small combo algebra (which layers apply where, in what order, and where a
 * value was defined), and a CSS emitter. React, Puck, and the brand live
 * in the consumers (puck-config, plugin-rails) — this package is pure data.
 *
 * v0.1 ships the "screen" kind (breakpoints). "group", "toggle", and
 * "interaction" are reserved in the type so stored combo keys stay stable
 * when those dimensions arrive; the specificity ranking already orders them.
 *
 * Layer model (Plasmic-inspired, house-built): a block's props are a BASE
 * plus sparse per-combo override layers (VariantedProps). resolve() merges
 * base → ancestors → target in specificity order; a value PRESENT in a
 * layer always wins (even 0) — "clear an override" means DELETE the key,
 * a rule the field layer enforces (it never writes 0 to mean "unset").
 */

export type VariantKind = "screen" | "group" | "toggle" | "interaction";

export interface VariantDef {
  /** unique key within the registry — appears in combo keys, so stable */
  key: string;
  kind: VariantKind;
  /** dimension name — variants in one group are alternatives */
  group: string;
  /** width window, for kind "screen" */
  screen?: ScreenSpec;
  /** CSS selector suffixes (":hover"…), for kind "interaction" (reserved) */
  selectors?: string[];
}

export type ResponsiveStrategy = "mobileFirst" | "desktopFirst" | "unknown";

export interface VariantRegistry {
  variants: VariantDef[];
  strategy: ResponsiveStrategy;
}

/** A set of active variant keys. [] is the base. */
export type VariantCombo = string[];

/** Canonical serialized combo: registry-sorted keys, "+"-joined. "" = base. */
export type ComboKey = string;

/** Sparse per-combo override layers over a base T. Base is NOT stored here. */
export type VariantedProps<T> = Partial<Record<ComboKey, Partial<T>>>;

/**
 * Build a registry and infer the responsive strategy from its screen specs:
 * every spec min-width-only → mobileFirst; every spec max-width-only →
 * desktopFirst; anything else (mixed, banded, or NO screen variants at
 * all) → unknown, which disables screen-ancestry inference and leaves
 * media-block order as given.
 */
export function createRegistry(variants: VariantDef[]): VariantRegistry {
  const screens = variants.filter((v) => v.kind === "screen" && v.screen);
  let strategy: ResponsiveStrategy = "unknown";
  if (screens.length > 0) {
    const allMin = screens.every(
      (v) =>
        v.screen!.minWidth !== undefined && v.screen!.maxWidth === undefined
    );
    const allMax = screens.every(
      (v) =>
        v.screen!.maxWidth !== undefined && v.screen!.minWidth === undefined
    );
    strategy = allMin ? "mobileFirst" : allMax ? "desktopFirst" : "unknown";
  }
  return { variants, strategy };
}

const byKey = (reg: VariantRegistry, key: string): VariantDef | undefined =>
  reg.variants.find((v) => v.key === key);

/**
 * Canonical combo key: keys sorted by registry position (unknown keys
 * last, alphabetically), joined with "+". comboKey(reg, []) === "".
 */
export function comboKey(reg: VariantRegistry, combo: VariantCombo): ComboKey {
  const pos = (k: string): number => {
    const i = reg.variants.findIndex((v) => v.key === k);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...combo]
    .sort((a, b) => pos(a) - pos(b) || (a < b ? -1 : a > b ? 1 : 0))
    .join("+");
}

export const parseComboKey = (key: ComboKey): VariantCombo =>
  key.split("+").filter(Boolean);

/** Does ancestor's screen window contain descendant's (per strategy)? */
const impliesScreen = (
  strategy: ResponsiveStrategy,
  ancestor: ScreenSpec,
  descendant: ScreenSpec
): boolean => {
  if (strategy === "mobileFirst")
    return (
      ancestor.minWidth !== undefined &&
      descendant.minWidth !== undefined &&
      ancestor.minWidth <= descendant.minWidth
    );
  if (strategy === "desktopFirst")
    return (
      ancestor.maxWidth !== undefined &&
      descendant.maxWidth !== undefined &&
      ancestor.maxWidth >= descendant.maxWidth
    );
  return false;
};

/**
 * Is `maybeAncestor` an ancestor of (i.e. also in effect under) `combo`?
 *
 * Base [] is an ancestor of everything. A variant key counts when it is a
 * member of `combo`, or — for screen variants under a known strategy —
 * when some member's screen window implies it: under mobileFirst, tablet
 * (minWidth 768) is an ancestor of desktop (minWidth 1080), because any
 * width that is >=1080 is also >=768.
 */
export function isAncestorCombo(
  reg: VariantRegistry,
  combo: VariantCombo,
  maybeAncestor: VariantCombo
): boolean {
  return maybeAncestor.every((key) => {
    if (combo.includes(key)) return true;
    const anc = byKey(reg, key);
    if (!anc || anc.kind !== "screen" || !anc.screen) return false;
    return combo.some((ck) => {
      const desc = byKey(reg, ck);
      if (!desc || desc.kind !== "screen" || !desc.screen) return false;
      return impliesScreen(reg.strategy, anc.screen!, desc.screen!);
    });
  });
}

/** Screen variants ordered least → most specific for the strategy. */
const screenOrder = (reg: VariantRegistry): VariantDef[] => {
  const screens = reg.variants.filter((v) => v.kind === "screen" && v.screen);
  if (reg.strategy === "mobileFirst")
    return [...screens].sort(
      (a, b) => (a.screen!.minWidth ?? 0) - (b.screen!.minWidth ?? 0)
    );
  if (reg.strategy === "desktopFirst")
    return [...screens].sort(
      (a, b) => (b.screen!.maxWidth ?? 0) - (a.screen!.maxWidth ?? 0)
    );
  return screens;
};

/**
 * Specificity rank tuple, compared array-lexicographically:
 * [interactionSelCount, interactionRank, groupCount, groupRankSum,
 *  screenCount, screenRankSum]
 * — interactions outrank everything (they carry selectors), then
 * group/toggle dimensions, then screens; within screens the strategy's
 * order ranks (mobileFirst: ascending minWidth), so base ([] → all zeros)
 * < tablet < desktop is guaranteed under mobileFirst.
 */
const comboRank = (reg: VariantRegistry, combo: VariantCombo): number[] => {
  const screens = screenOrder(reg);
  let interactionSelCount = 0;
  let interactionRank = 0;
  let groupCount = 0;
  let groupRankSum = 0;
  let screenCount = 0;
  let screenRankSum = 0;
  for (const key of combo) {
    const v = byKey(reg, key);
    if (!v) continue;
    const regIndex = reg.variants.indexOf(v);
    if (v.kind === "interaction") {
      interactionSelCount += v.selectors?.length ?? 1;
      interactionRank += regIndex;
    } else if (v.kind === "screen") {
      screenCount += 1;
      const si = screens.indexOf(v);
      screenRankSum += (si === -1 ? regIndex : si) + 1;
    } else {
      // "group" and "toggle" share the group slot of the tuple
      groupCount += 1;
      groupRankSum += regIndex;
    }
  }
  return [
    interactionSelCount,
    interactionRank,
    groupCount,
    groupRankSum,
    screenCount,
    screenRankSum,
  ];
};

const cmpRanks = (a: number[], b: number[]): number => {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
};

/**
 * Order combos base-first, least → most specific (stable: equal ranks keep
 * their input order). This is CSS source order for emitBlockCss and merge
 * order for resolve — equal specificity, later wins, no !important.
 */
export function sortCombos(
  reg: VariantRegistry,
  combos: VariantCombo[]
): VariantCombo[] {
  return combos
    .map((combo, i) => ({ combo, rank: comboRank(reg, combo), i }))
    .sort((a, b) => cmpRanks(a.rank, b.rank) || a.i - b.i)
    .map((x) => x.combo);
}

/**
 * The override layers that apply under `activeCombo`, least → most
 * specific: every stored layer whose combo is an ancestor of (or equal
 * to) the active combo. The base is not in the stack — resolve() adds it.
 */
export function activeStack<T>(
  reg: VariantRegistry,
  settings: VariantedProps<T>,
  activeCombo: VariantCombo
): { combo: VariantCombo; values: Partial<T> }[] {
  const applicable: { combo: VariantCombo; values: Partial<T> }[] = [];
  for (const [key, values] of Object.entries(settings)) {
    if (!values) continue;
    const combo = parseComboKey(key);
    if (combo.length === 0) continue;
    if (isAncestorCombo(reg, activeCombo, combo)) {
      applicable.push({ combo, values: values as Partial<T> });
    }
  }
  return applicable
    .map((layer, i) => ({ layer, rank: comboRank(reg, layer.combo), i }))
    .sort((a, b) => cmpRanks(a.rank, b.rank) || a.i - b.i)
    .map((x) => x.layer);
}

/**
 * Effective props under `activeCombo`: base, then each applicable layer in
 * specificity order, last wins. Sparse merge — a key ABSENT from a layer
 * inherits; a key PRESENT always wins, including 0 / "" / false (the
 * "never write 0 to mean unset" rule lives in the field layer, not here).
 */
export function resolve<T extends object>(
  reg: VariantRegistry,
  base: T,
  settings: VariantedProps<T>,
  activeCombo: VariantCombo
): T {
  const out: T = { ...base };
  for (const { values } of activeStack(reg, settings, activeCombo)) {
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined) (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

/**
 * Where does `prop`'s value at `targetCombo` come from?
 * - "set" + source=target's key: the target layer defines it (gold dot);
 * - "inherited" + source: the nearest ancestor layer (or "base") that
 *   defines it (dim dot: "from base" / "from tablet").
 * Targeting the base ([]) reports {state:"set", source:"base"}.
 */
export function definedAt<T extends object>(
  reg: VariantRegistry,
  base: T,
  settings: VariantedProps<T>,
  targetCombo: VariantCombo,
  prop: keyof T
): {
  state: "set" | "inherited";
  source: ComboKey | "base";
  value: T[keyof T] | undefined;
} {
  const has = (obj: object, p: PropertyKey): boolean =>
    Object.prototype.hasOwnProperty.call(obj, p) &&
    (obj as Record<PropertyKey, unknown>)[p] !== undefined;

  const targetKey = comboKey(reg, targetCombo);
  if (targetCombo.length > 0) {
    const layer = settings[targetKey];
    if (layer && has(layer, prop)) {
      return {
        state: "set",
        source: targetKey,
        value: (layer as Record<PropertyKey, unknown>)[prop] as T[keyof T],
      };
    }
  }
  const stack = activeStack(reg, settings, targetCombo).filter(
    ({ combo }) => comboKey(reg, combo) !== targetKey
  );
  for (let i = stack.length - 1; i >= 0; i--) {
    const { combo, values } = stack[i];
    if (has(values, prop)) {
      return {
        state: "inherited",
        source: comboKey(reg, combo),
        value: (values as Record<PropertyKey, unknown>)[prop] as T[keyof T],
      };
    }
  }
  return {
    state: targetCombo.length === 0 ? "set" : "inherited",
    source: "base",
    value: base[prop],
  };
}

export {
  matchesWidth,
  screenComboForWidth,
  screenVariantsFromBreakpoints,
} from "./screen";
export type { ScreenSpec } from "./screen";
export { cssClassName, emitBlockCss, mediaText } from "./css";
export type { CssLayer } from "./css";
