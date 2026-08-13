/**
 * @pacsarcade/puck-changelog — framework-free surface.
 *
 * React pieces (ChangelogBridge, useApplyData) live in
 * `@pacsarcade/puck-changelog/react`.
 */

export type {
  Patch,
  ChangeOrigin,
  ChangeRecord,
  SerializedLog,
  ChangelogOptions,
  Changelog,
} from "./types";
export { createChangelog } from "./changelog";
export { diff } from "./diff";
export { applyPatches } from "./apply";
export { changedBlockIds } from "./blocks";
