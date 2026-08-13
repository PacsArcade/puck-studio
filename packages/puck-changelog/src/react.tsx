"use client";

import { useCallback, useEffect, useRef } from "react";
import { createUsePuck, useGetPuck } from "@puckeditor/core";
import type { Data } from "@puckeditor/core";
import type { Changelog, ChangeOrigin } from "./types";
import type { ChangelogInternal } from "./changelog";

const usePuck = createUsePuck();

const INITIAL_KEY = "__puck_changelog_initial__";

/**
 * Drop every saved snapshot whose history entry no longer exists (Puck's
 * history slice truncates the redo tail on a new edit: `slice(0, index+1)`),
 * keeping the map bounded by the live history. The mount snapshot under
 * `initialKey` is always kept.
 *
 * @internal exported for tests only.
 */
export const _pruneSnapshots = (
  saved: Map<string, unknown>,
  liveIds: ReadonlySet<string>,
  initialKey: string = INITIAL_KEY
): void => {
  for (const key of [...saved.keys()]) {
    if (key !== initialKey && !liveIds.has(key)) saved.delete(key);
  }
};

export type ChangelogBridgeProps = {
  log: Changelog;
  /** Snapshot host view state (selection, scroll, active panel…). */
  captureViewState?: () => unknown;
  /** Restore a snapshot taken by captureViewState. */
  restoreViewState?: (saved: unknown) => void;
};

/**
 * ChangelogBridge — renders null; must live inside `<Puck>`.
 *
 * Rides Puck's own history slice rather than duplicating it, classifying
 * moves by ENTRY IDENTITY (not entry count — a new edit after undo
 * truncates the redo tail, so the count can shrink while the index moves
 * forward):
 * - the current entry's id has never been seen → a new edit recorded a
 *   fresh entry: capture host view state keyed by that id; never re-tag;
 * - the current entry is a known one and the index moved (Puck's
 *   undo/redo/setHistoryIndex dispatched a "set" that the changelog has
 *   just recorded as "editor") → re-tag that record's origin to
 *   "undo"/"redo" and restore the saved view state.
 *
 * The re-tag is targeted: it only fires when exactly ONE record was
 * appended since the bridge last looked AND that record's action is
 * "set". A zero-patch undo appends nothing (nothing to re-tag) and an
 * interleaved edit makes the tail ambiguous — both skip, so an unrelated
 * record is never mislabeled.
 *
 * The mount-seeded state (histories empty, or entries without ids from a
 * user-supplied initial history) is keyed under an internal initial key.
 *
 * Puck restores its own `ui` itself; the bridge only handles host view
 * state (Plasmic's UndoRecord = { changes, viewState } lesson).
 */
export const ChangelogBridge = ({
  log,
  captureViewState,
  restoreViewState,
}: ChangelogBridgeProps): null => {
  const histories = usePuck((s) => s.history.histories);
  const index = usePuck((s) => s.history.index);

  const saved = useRef(new Map<string, unknown>());
  const seen = useRef(new Set<string>());
  const prev = useRef<{ index: number; currentId: string | null } | null>(null);
  // Log revision as of the bridge's last look — the "before the history
  // move" baseline for the targeted re-tag.
  const revAtLastLook = useRef(0);

  useEffect(() => {
    const entry = histories[index] as { id?: string } | undefined;
    const currentId = entry?.id ?? null;

    const liveIds = new Set<string>();
    for (const h of histories) {
      const id = (h as { id?: string } | undefined)?.id;
      if (id) liveIds.add(id);
    }

    if (prev.current === null) {
      // Mount: snapshot the pre-history view state; seed the seen set so
      // pre-existing entries (initial history) never read as new edits.
      if (captureViewState) {
        saved.current.set(INITIAL_KEY, captureViewState());
      }
      for (const id of liveIds) seen.current.add(id);
      prev.current = { index, currentId };
      revAtLastLook.current = log.rev();
      return;
    }

    const { index: prevIndex, currentId: prevId } = prev.current;
    prev.current = { index, currentId };

    const isNewEntry = currentId !== null && !seen.current.has(currentId);
    for (const id of liveIds) seen.current.add(id);

    if (isNewEntry) {
      // New history entry recorded — snapshot view state against its id.
      // No re-tag: the edit's record is already correctly "editor" (or
      // whatever markNextOrigin tagged it).
      if (captureViewState) {
        saved.current.set(currentId, captureViewState());
      }
    } else if (index !== prevIndex || currentId !== prevId) {
      // Moved among known entries: undo (back) or redo (forward).
      const origin: ChangeOrigin = index < prevIndex ? "undo" : "redo";

      // Targeted re-tag: exactly one new record since the last look, and
      // it is the "set" the history move dispatched.
      const newRecords = log.rev() - revAtLastLook.current;
      const records = log.records();
      const last = records[records.length - 1];
      if (newRecords === 1 && last?.action === "set") {
        (log as ChangelogInternal)._retagLast?.(origin);
      }

      if (restoreViewState) {
        const key = currentId ?? INITIAL_KEY;
        if (saved.current.has(key)) {
          restoreViewState(saved.current.get(key));
        }
      }
    }

    // Bound both maps by the live history (redo-tail truncation drops
    // entries for good — their ids are never minted again).
    _pruneSnapshots(saved.current, liveIds);
    for (const id of [...seen.current]) {
      if (!liveIds.has(id)) seen.current.delete(id);
    }

    revAtLastLook.current = log.rev();
  }, [histories, index, log, captureViewState, restoreViewState]);

  return null;
};

/**
 * useApplyData — programmatic data entry point that keeps the log honest.
 *
 * Returns `(next, origin = "programmatic") => void`; tags the next record
 * with `origin` and dispatches Puck's own setData with
 * `recordHistory: true`, so the change lands in Puck's undo history AND
 * the changelog with the right attribution. Must be called inside <Puck>.
 *
 * Core's setData reducer SHALLOW-MERGES `action.data` over the current
 * data, so the hook always dispatches a complete top-level object
 * (root/content/zones) — `next` fully replaces the document; a `next`
 * without zones clears zones rather than silently keeping the old ones.
 */
export const useApplyData = (log: Changelog) => {
  const getPuck = useGetPuck();

  return useCallback(
    (next: Data, origin: ChangeOrigin = "programmatic") => {
      log.markNextOrigin(origin);
      getPuck().dispatch({
        type: "setData",
        data: {
          root: next.root,
          content: next.content,
          zones: (next as { zones?: Data["zones"] }).zones ?? {},
        },
        recordHistory: true,
      });
    },
    [log, getPuck]
  );
};
