import type { Data } from "@puckeditor/core";
import type { Patch } from "./types";

type BlockLike = {
  type: string;
  props: Record<string, unknown> & { id: string };
};

/**
 * A block is any `{ type, props: { id } }` object — the same generic
 * detection plugin-rails uses for slot arrays, so nested slots
 * (content/left/right/a/b/c… — any array of blocks under props) are
 * covered without a slot registry.
 */
export const isBlock = (v: unknown): v is BlockLike => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const b = v as { type?: unknown; props?: unknown };
  if (typeof b.type !== "string") return false;
  if (typeof b.props !== "object" || b.props === null) return false;
  return typeof (b.props as { id?: unknown }).id === "string";
};

/**
 * Map patch paths to the ids of the blocks they touch, slot-aware.
 *
 * For each patch, walk `next` along the path and take the deepest
 * enclosing block (props.id). If the patch adds/replaces a whole block,
 * its own id counts too. Paths that no longer resolve (removals) fall
 * back to the deepest block on the resolvable prefix.
 */
export const changedBlockIds = (patches: Patch[], next: Data): string[] => {
  const ids = new Set<string>();

  for (const patch of patches) {
    let node: unknown = next;
    let enclosing: string | null = null;

    for (const seg of patch.path) {
      if (isBlock(node)) enclosing = node.props.id;
      if (typeof node !== "object" || node === null) {
        node = undefined;
        break;
      }
      node = (node as Record<string | number, unknown>)[seg];
      if (node === undefined) break;
    }

    if (isBlock(node)) enclosing = node.props.id;

    if (
      (patch.op === "add" || patch.op === "replace") &&
      isBlock(patch.value)
    ) {
      ids.add(patch.value.props.id);
    }

    if (enclosing) ids.add(enclosing);
  }

  return [...ids];
};
