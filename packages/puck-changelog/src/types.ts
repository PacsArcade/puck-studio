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
   * Feed this to `<Puck onAction>`. Skips ui-only and zone-registration
   * actions, and any action where data identity is unchanged.
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
  /** Tag only the next record with `origin`, then reset to "editor". */
  markNextOrigin(origin: ChangeOrigin): void;
  /** Apply records' forward patches over a base data tree. */
  replay(base: Data, recs: readonly ChangeRecord[]): Data;
  /** JSON-safe snapshot: { version, rev, base, records }. */
  serialize(): SerializedLog;
}
