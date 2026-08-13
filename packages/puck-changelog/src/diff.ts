import type { Data } from "@puckeditor/core";
import type { Patch } from "./types";

/** Instrumentation hook: counts every node the differ enters. */
export type DiffStats = { visits: number };

/**
 * Plain objects only: `{}` literals and null-prototype objects. Anything
 * carrying another constructor (Date, Map, Set, class instances…) is an
 * opaque LEAF to the differ — `Object.keys` would lie about its contents
 * (a Date has no enumerable keys), so descending would yield zero patches
 * for genuinely different values.
 */
const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/**
 * Reference-pruned structural diff.
 *
 * If `prev[key] === next[key]` by identity the differ does not descend.
 * That helps exactly as much as the producer shares structure: Puck's
 * insert/move/reorder/duplicate-shaped updates keep most subtree
 * identities, so those diffs track the changed spine plus sibling
 * fan-out. But core's walkAppState rebuilds identities wholesale on hot
 * actions (set, setData, remove), and a rebuilt-but-deep-equal subtree
 * must be fully walked to prove it yields zero patches — the worst case
 * is the whole tree, not the changed spine.
 *
 * Non-plain objects (Date, Map, class instances) are leaves: when not
 * strictly equal they become a `replace` patch carrying the value as-is.
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

  // One mutable path buffer, push/pop per descent; copied only when a
  // patch is emitted. Keeps the walk allocation-light on deep trees.
  const path: (string | number)[] = [];

  const walk = (p: unknown, n: unknown): void => {
    if (stats) stats.visits += 1;

    if (p === n) return;

    if (Array.isArray(p) && Array.isArray(n)) {
      const common = Math.min(p.length, n.length);

      for (let i = 0; i < common; i++) {
        path.push(i);
        walk(p[i], n[i]);
        path.pop();
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
          path.push(key);
          walk(p[key], n[key]);
          path.pop();
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

    // Leaf: scalars, kind changes, and non-plain objects — replace
    // wholesale. Non-identical leaves always emit (two distinct Dates
    // with equal time still produce a replace: conservative, never a
    // silent zero-patch).
    patches.push({ op: "replace", path: [...path], value: n });
    inverse.push({ op: "replace", path: [...path], value: p });
  };

  walk(prev, next);

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
