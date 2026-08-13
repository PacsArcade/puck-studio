import type { AppState, Data, PuckAction } from "@puckeditor/core";
import { applyPatches } from "./apply";
import { changedBlockIds } from "./blocks";
import { refDiff } from "./diff";
import type {
  Changelog,
  ChangelogOptions,
  ChangeOrigin,
  ChangeRecord,
  SerializedLog,
} from "./types";

/**
 * Actions that never touch data — not worth a diff.
 *
 * Note: registerZone/unregisterZone are NOT skipped. Core's
 * unregisterZoneAction deletes the zone's content out of `data.zones`
 * (into a module-level cache) and registerZoneAction restores it
 * (core/reducer/actions/register-zone.ts) — real data mutations that must
 * be recorded or `replay(base, records)` stops equalling current data.
 * True no-op zone actions are suppressed by the identity and zero-patch
 * early returns below.
 */
const SKIP_ACTIONS = new Set(["setUi"]);

/** Deep-copy a JSON-safe value (records hold JSON-safe Puck Data). */
const deepCopy = <T>(v: T): T =>
  typeof structuredClone === "function"
    ? structuredClone(v)
    : (JSON.parse(JSON.stringify(v)) as T);

const DEFAULT_MAX_RECORDS = 500;

/**
 * Package-internal surface. The React bridge uses `_retagLast` to flip
 * the origin of the "set" record that Puck's own undo/redo just produced.
 * Not part of the public Changelog contract.
 */
export interface ChangelogInternal extends Changelog {
  /** @internal */
  _retagLast(origin: ChangeOrigin): void;
}

/**
 * createChangelog — the engine.
 *
 * Feed `log.onAction` to `<Puck onAction>`. Every data-touching action
 * becomes a ChangeRecord (forward + inverse patches, block attribution,
 * origin tag) in a ring buffer. On overflow the evicted record folds into
 * the base, so `replay(base().data, records())` ALWAYS deep-equals the
 * current data.
 */
export const createChangelog = (
  initialData: Data,
  opts: ChangelogOptions = {}
): Changelog => {
  const maxRecords = opts.maxRecords ?? DEFAULT_MAX_RECORDS;

  if (maxRecords < 1) {
    throw new Error("createChangelog: maxRecords must be >= 1");
  }

  let base: { rev: number; data: Data } = {
    rev: opts.baseRev ?? 0,
    data: initialData,
  };
  let rev = base.rev;
  let pendingOrigin: ChangeOrigin | null = null;

  const records: ChangeRecord[] = [];
  const subscribers = new Set<(rec: ChangeRecord) => void>();

  const log: ChangelogInternal = {
    onAction(action: PuckAction, appState: AppState, prevAppState: AppState) {
      if (SKIP_ACTIONS.has(action.type)) return;

      // Every data-action ATTEMPT consumes the pending origin — even one
      // that records nothing (identity-unchanged or zero-patch). A no-op
      // tagged apply wastes its tag rather than leaking it onto the next
      // unrelated human edit.
      const origin = pendingOrigin ?? "editor";
      pendingOrigin = null;

      // Identity check: Puck's reducer returns the same data reference
      // when an action didn't touch data.
      if (appState.data === prevAppState.data) return;

      const { patches, inverse } = refDiff(prevAppState.data, appState.data);

      // New identity but deep-equal — nothing actually changed.
      if (patches.length === 0) return;

      rev += 1;

      const rec: ChangeRecord = {
        rev,
        t: Date.now(),
        origin,
        action: action.type,
        patches,
        inverse,
        // Union of forward-against-next and inverse-against-prev so
        // removed blocks are attributed too (a pure forward walk can't
        // see a block that is no longer in `next`).
        blockIds: [
          ...new Set([
            ...changedBlockIds(patches, appState.data),
            ...changedBlockIds(inverse, prevAppState.data),
          ]),
        ],
      };

      records.push(rec);

      if (records.length > maxRecords) {
        const evicted = records.shift() as ChangeRecord;
        base = {
          rev: evicted.rev,
          data: applyPatches(base.data, evicted.patches),
        };
      }

      opts.onRecord?.(rec);
      subscribers.forEach((fn) => fn(rec));
    },

    rev: () => rev,

    records: () => records,

    base: () => base,

    subscribe(fn: (rec: ChangeRecord) => void) {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },

    markNextOrigin(origin: ChangeOrigin) {
      pendingOrigin = origin;
    },

    replay(baseData: Data, recs: readonly ChangeRecord[]) {
      return recs.reduce((d, r) => applyPatches(d, r.patches), baseData);
    },

    serialize(): SerializedLog {
      // Records are deep-copied so the snapshot is isolated from later
      // in-place mutation (the React bridge's targeted retag flips
      // `origin` on the live record). JSON-safety of the copy holds only
      // for JSON-safe payload values — Puck Data is JSON, so this is a
      // guard, not a license to log arbitrary objects.
      return {
        version: 1,
        rev,
        base: { rev: base.rev, data: base.data },
        records: deepCopy(records),
      };
    },

    _retagLast(origin: ChangeOrigin) {
      const last = records[records.length - 1];
      if (last) last.origin = origin;
    },
  };

  return log;
};
