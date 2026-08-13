import type { Data } from "@puckeditor/core";
import type { Patch } from "./types";

type Container = Record<string, unknown> | unknown[];

const isContainer = (v: unknown): v is Container =>
  typeof v === "object" && v !== null;

/**
 * Apply a patch list immutably, preserving structural sharing: only the
 * spines touched by patches are cloned (copy-on-write, memoized per run),
 * every untouched subtree keeps its identity.
 *
 * Patch values are inserted by reference — treat Data as immutable
 * (Puck's own convention) and this is safe.
 */
export const applyPatches = (data: Data, patches: Patch[]): Data => {
  if (patches.length === 0) return data;

  const cloned = new WeakSet<object>();

  const clone = (v: Container): Container => {
    if (cloned.has(v)) return v;
    const c: Container = Array.isArray(v) ? v.slice() : { ...v };
    cloned.add(c);
    return c;
  };

  let root: unknown = data;

  for (const patch of patches) {
    const { op, path } = patch;

    if (path.length === 0) {
      if (op !== "replace") {
        throw new Error(`applyPatches: cannot ${op} at the document root`);
      }
      root = patch.value;
      continue;
    }

    if (!isContainer(root)) {
      throw new Error("applyPatches: document root is not a container");
    }

    root = clone(root);
    let node: Container = root as Container;

    for (let i = 0; i < path.length - 1; i++) {
      const seg = path[i];
      const child = (node as Record<string | number, unknown>)[seg];

      if (!isContainer(child)) {
        throw new Error(
          `applyPatches: path not found: ${path.join(".")} (at "${seg}")`
        );
      }

      const nextChild = clone(child);
      (node as Record<string | number, unknown>)[seg] = nextChild;
      node = nextChild;
    }

    const last = path[path.length - 1];

    if (op === "replace") {
      (node as Record<string | number, unknown>)[last] = patch.value;
    } else if (op === "add") {
      if (Array.isArray(node)) {
        node.splice(last as number, 0, patch.value);
      } else {
        (node as Record<string | number, unknown>)[last] = patch.value;
      }
    } else {
      if (Array.isArray(node)) {
        node.splice(last as number, 1);
      } else {
        delete (node as Record<string, unknown>)[last as string];
      }
    }
  }

  return root as Data;
};
