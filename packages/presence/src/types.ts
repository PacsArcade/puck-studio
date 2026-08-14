/** Transport connection state. */
export type TransportStatus = "connecting" | "open" | "down";

/** The full presence state one session broadcasts. */
export interface PresenceState {
  /** Stable id for this editing session (tab), never persisted. */
  sessionId: string;
  /** Display name (identity). */
  name: string;
  /** Identity color (hex or hsl). */
  color: string;
  /** Which page/document the session is editing. */
  slug: string;
  /** props.id of the currently selected block, or null. */
  selectedBlockId: string | null;
  /** The artboard breakpoint the session is targeting. */
  targetBreakpoint: "phone" | "tablet" | "desktop" | null;
  /** Latest changelog revision the session has seen. */
  rev: number;
  /** Unsaved changes flag. */
  dirty: boolean;
}

/** A remote session as tracked locally. `lastSeen` is RECEIPT time (local clock). */
export interface PresencePeer extends PresenceState {
  lastSeen: number;
}

/** The wire protocol. Unknown `v`/`type` values are dropped silently. */
export type PresenceMessage =
  | ({ v: 1; type: "presence"; ts: number } & PresenceState)
  | { v: 1; type: "bye"; sessionId: string; ts: number };
