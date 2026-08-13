"use client";

import { useCallback, useEffect, useRef } from "react";
import { createUsePuck, useGetPuck } from "@puckeditor/core";
import type { Data } from "@puckeditor/core";
import type { Changelog, ChangeOrigin } from "./types";
import type { ChangelogInternal } from "./changelog";

const usePuck = createUsePuck();

const INITIAL_KEY = "__puck_changelog_initial__";

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
 * Rides Puck's own history slice rather than duplicating it:
 * - a new history entry → capture host view state keyed by the entry id;
 * - the index moving back/forward (Puck's undo/redo dispatches a "set"
 *   that the changelog has just recorded as "editor") → re-tag that
 *   record's origin to "undo"/"redo" and restore the saved view state.
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
  const prev = useRef<{ index: number; count: number } | null>(null);

  useEffect(() => {
    const count = histories.length;

    if (prev.current === null) {
      // Mount: snapshot the pre-history view state.
      if (captureViewState) {
        saved.current.set(INITIAL_KEY, captureViewState());
      }
      prev.current = { index, count };
      return;
    }

    const { index: prevIndex, count: prevCount } = prev.current;
    prev.current = { index, count };

    if (count > prevCount) {
      // New history entry recorded — snapshot view state against its id.
      const entry = histories[count - 1];
      const key = entry?.id ?? `history-${count - 1}`;
      if (captureViewState) {
        saved.current.set(key, captureViewState());
      }
      return;
    }

    if (count === prevCount && index !== prevIndex) {
      // Puck moved through its history: the "set" it dispatched is the
      // newest record in the log — flip its origin.
      const origin: ChangeOrigin = index < prevIndex ? "undo" : "redo";
      (log as ChangelogInternal)._retagLast?.(origin);

      if (restoreViewState) {
        const entry = histories[index];
        const key = entry?.id ?? INITIAL_KEY;
        if (saved.current.has(key)) {
          restoreViewState(saved.current.get(key));
        }
      }
    }
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
 */
export const useApplyData = (log: Changelog) => {
  const getPuck = useGetPuck();

  return useCallback(
    (next: Data, origin: ChangeOrigin = "programmatic") => {
      log.markNextOrigin(origin);
      getPuck().dispatch({
        type: "setData",
        data: next,
        recordHistory: true,
      });
    },
    [log, getPuck]
  );
};
