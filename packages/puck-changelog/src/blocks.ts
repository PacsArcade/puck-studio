import type { Data } from "@puckeditor/core";
import type { Patch } from "./types";

type BlockLike = {
  type: string;
  props: Record<string, unknown> & { id: string };
};

/**
 * Structural block shape: `{ type, props: { id } }`. Shape only — an
 * empty-string id still matches the shape (so one id-less sibling does
 * not break slot detection for the rest of its array) but never
 * attributes (see blockId).
 */
const isBlockShaped = (v: unknown): v is BlockLike => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const b = v as { type?: unknown; props?: unknown };
  if (typeof b.type !== "string") return false;
  if (typeof b.props !== "object" || b.props === null) return false;
  return typeof (b.props as { id?: unknown }).id === "string";
};

/** Attributable id: non-empty string only, else null. */
const blockId = (v: unknown): string | null => {
  if (!isBlockShaped(v)) return null;
  return v.props.id !== "" ? v.props.id : null;
};

/**
 * Map patch paths to the ids of the blocks they touch, slot-aware.
 *
 * A value only counts as a block when it sits at a SLOT POSITION: an
 * element of `data.content`, of a `data.zones[*]` array, or of any array
 * whose members are all block-shaped (mirrors plugin-rails' isSlotArray
 * semantics — covers nested slot props like left/right/content without a
 * slot registry). Block-shaped objects stored as ordinary prop VALUES are
 * never attributed — they are data, not blocks.
 *
 * For each patch, walk `next` along the path and take the deepest
 * enclosing slot-position block (props.id). If the patch adds/replaces a
 * whole block AT a slot position, its own id counts too. Paths that no
 * longer resolve (removals) fall back to the deepest block on the
 * resolvable prefix. Empty-string ids neither attribute nor crash — the
 * change falls through to the nearest valid enclosing block.
 */
export const changedBlockIds = (patches: Patch[], next: Data): string[] => {
  const ids = new Set<string>();
  const zones: unknown = (next as { zones?: unknown }).zones;

  /** Is `arr`, found at `parent[seg]`, a slot array? */
  const isSlotArray = (
    arr: unknown,
    parent: unknown,
    seg: string | number
  ): boolean => {
    if (!Array.isArray(arr)) return false;
    // The root content array and root zone arrays are slots by position,
    // even when empty or when a member is malformed.
    if (parent === next && seg === "content") return true;
    if (zones !== undefined && parent === zones) return true;
    // Elsewhere: an array is a slot iff every member is block-shaped.
    return arr.length > 0 && arr.every(isBlockShaped);
  };

  for (const patch of patches) {
    let node: unknown = next;
    let nodeInSlot = false; // node is an element of a slot array
    let nodeIsSlot = false; // node is itself a slot array
    let enclosing: string | null = null;
    // Slot status of the position the FULL path addresses; null while the
    // walk cannot know it (broke before the last segment).
    let targetInSlot: boolean | null = null;

    const lastIndex = patch.path.length - 1;

    for (let i = 0; i < patch.path.length; i++) {
      const seg = patch.path[i];

      if (nodeInSlot) {
        const id = blockId(node);
        if (id) enclosing = id;
      }

      if (typeof node !== "object" || node === null) {
        node = undefined;
        break;
      }

      const parent = node;
      const child = (parent as Record<string | number, unknown>)[seg];
      const childInSlot = nodeIsSlot; // only true when parent is a slot array

      if (i === lastIndex) targetInSlot = childInSlot;

      node = child;
      nodeInSlot = childInSlot;
      nodeIsSlot = isSlotArray(child, parent, seg);

      if (node === undefined) break;
    }

    if (node !== undefined && nodeInSlot) {
      const id = blockId(node);
      if (id) enclosing = id;
    }

    // A block added/replaced wholesale counts as its own change — but
    // only when the patch lands at a slot position.
    if ((patch.op === "add" || patch.op === "replace") && targetInSlot) {
      const id = blockId(patch.value);
      if (id) ids.add(id);
    }

    if (enclosing) ids.add(enclosing);
  }

  return [...ids];
};
