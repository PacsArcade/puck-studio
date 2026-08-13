import type { AppState, Data, PuckAction } from "@puckeditor/core";

/**
 * A single structural change, immer-compatible:
 * `{ op, path, value }` where `path` addresses into a Puck `Data` tree.
 *
 * - `add`     — insert `value` at `path` (splice for arrays, set for objects)
 * - `remove`  — delete the node at `path` (splice for arrays)
 * - `replace` — overwrite the node at `path` with `value`
 */
export type Patch = {
  op: "add" | "remove" | "replace";
  path: (string | number)[];
  value?: unknown;
};

/** Who caused a change. `markNextOrigin` tags the next record; default "editor". */
export type ChangeOrigin =
  | "editor"
  | "programmatic"
  | "copilot"
  | "undo"
  | "redo"
  | "load";

/** One entry in the change log: forward patches, inverse patches, attribution. */
export interface ChangeRecord {
  /** Monotonic revision number (baseRev + n). */
  rev: number;
  /** Wall-clock ms at record time. */
  t: number;
  /** Who caused it. */
  origin: ChangeOrigin;
  /** The Puck action type that produced it (semantic intent, e.g. "move"). */
  action: string;
  /** Forward patches: applyPatches(prevData, patches) === nextData. */
  patches: Patch[];
  /** Inverse patches: applyPatches(nextData, inverse) === prevData. */
  inverse: Patch[];
  /** Ids of the blocks (props.id) enclosing the change, slot-aware. */
  blockIds: string[];
}

/** JSON-safe snapshot of the whole log. */
export interface SerializedLog {
  version: 1;
  rev: number;
  base: { rev: number; data: Data };
  records: ChangeRecord[];
}

export interface ChangelogOptions {
  /** Revision number the initial data sits at. Default 0. */
  baseRev?: number;
  /** Ring buffer size; on overflow the oldest record folds into base. Default 500. */
  maxRecords?: number;
  /** Called for every appended record (same as subscribe). */
  onRecord?: (rec: ChangeRecord) => void;
}

export interface Changelog {
  /**
   * Feed this to `<Puck onAction>`. Skips ui-only actions and any action
   * where the data is unchanged (same identity or deep-equal). Zone
   * registration actions ARE recorded when they change `data.zones`
   * (core really mutates zones through its zone cache).
   */
  onAction(
    action: PuckAction,
    appState: AppState,
    prevAppState: AppState
  ): void;
  /** Current revision number. */
  rev(): number;
  /** The retained records, oldest first. */
  records(): readonly ChangeRecord[];
  /** The fold base: replay(base().data, records()) === current data. */
  base(): { rev: number; data: Data };
  /** Stream every new record. Returns an unsubscribe function. */
  subscribe(fn: (rec: ChangeRecord) => void): () => void;
  /**
   * Tag the NEXT data-action attempt with `origin`, then reset to
   * "editor". The tag is a one-shot consumed by the next non-setUi
   * action even when that action turns out to record nothing (identity
   * unchanged or zero patches) — a no-op tagged apply wastes its tag
   * rather than mislabeling a later unrelated edit.
   */
  markNextOrigin(origin: ChangeOrigin): void;
  /** Apply records' forward patches over a base data tree. */
  replay(base: Data, recs: readonly ChangeRecord[]): Data;
  /**
   * JSON-safe snapshot: { version, rev, base, records }. Records are
   * deep-copied, so later in-place retags never mutate a snapshot.
   * JSON-safety holds only for JSON-safe payload values (Puck Data is
   * JSON; the copy is a guard, not a license).
   */
  serialize(): SerializedLog;
}
