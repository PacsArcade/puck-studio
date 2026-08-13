import type { Data } from "@puckeditor/core";
import type { Patch } from "./types";

/** Instrumentation hook: counts every node the differ enters. */
export type DiffStats = { visits: number };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Reference-pruned structural diff.
 *
 * If `prev[key] === next[key]` by identity the differ does not descend —
 * which makes diffing a structurally-shared update (the only kind Puck's
 * reducer produces) proportional to the changed spine, not the tree size.
 *
 * Array diffing is naive (index-based) for v0.1: a move becomes
 * replace/remove+add. The semantic action string on the ChangeRecord
 * carries the intent.
 */
export const refDiff = (
  prev: unknown,
  next: unknown,
  stats?: DiffStats
): { patches: Patch[]; inverse: Patch[] } => {
  const patches: Patch[] = [];
  const inverse: Patch[] = [];

  const walk = (p: unknown, n: unknown, path: (string | number)[]): void => {
    if (stats) stats.visits += 1;

    if (p === n) return;

    if (Array.isArray(p) && Array.isArray(n)) {
      const common = Math.min(p.length, n.length);

      for (let i = 0; i < common; i++) {
        walk(p[i], n[i], [...path, i]);
      }

      if (n.length > p.length) {
        // Forward: append the extra items (ascending keeps indices valid).
        for (let i = p.length; i < n.length; i++) {
          patches.push({ op: "add", path: [...path, i], value: n[i] });
        }
        // Inverse: remove them again, top index first so indices stay valid.
        for (let i = n.length - 1; i >= p.length; i--) {
          inverse.push({ op: "remove", path: [...path, i] });
        }
      } else if (p.length > n.length) {
        // Forward: remove trailing items, top index first.
        for (let i = p.length - 1; i >= n.length; i--) {
          patches.push({ op: "remove", path: [...path, i] });
        }
        // Inverse: add them back in ascending order.
        for (let i = n.length; i < p.length; i++) {
          inverse.push({ op: "add", path: [...path, i], value: p[i] });
        }
      }

      return;
    }

    if (isPlainObject(p) && isPlainObject(n)) {
      for (const key of Object.keys(p)) {
        if (!(key in n)) {
          patches.push({ op: "remove", path: [...path, key] });
          inverse.push({ op: "add", path: [...path, key], value: p[key] });
        } else {
          walk(p[key], n[key], [...path, key]);
        }
      }

      for (const key of Object.keys(n)) {
        if (!(key in p)) {
          patches.push({ op: "add", path: [...path, key], value: n[key] });
          inverse.push({ op: "remove", path: [...path, key] });
        }
      }

      return;
    }

    // Kind change or scalar change: replace wholesale.
    patches.push({ op: "replace", path, value: n });
    inverse.push({ op: "replace", path, value: p });
  };

  walk(prev, next, []);

  return { patches, inverse };
};

/**
 * diff(prev, next) — the public differ over Puck Data trees.
 *
 * `applyPatches(prev, patches)` deep-equals `next`;
 * `applyPatches(next, inverse)` deep-equals `prev`.
 */
export const diff = (
  prev: Data,
  next: Data
): { patches: Patch[]; inverse: Patch[] } => refDiff(prev, next);
