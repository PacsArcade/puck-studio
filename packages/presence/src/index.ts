/**
 * @frens-earth/presence — framework-free surface.
 *
 * React pieces (usePresence, PresenceBridge, PresenceChips, PresenceHalos)
 * live in `@frens-earth/presence/react`; the nostr transport lives in
 * `@frens-earth/presence/nostr` (requires the optional nostr-tools peer).
 */

export type {
  TransportStatus,
  PresenceState,
  PresencePeer,
  PresenceMessage,
} from "./types";
export type { PresenceTransport } from "./transport";
export { MemoryHub, createMemoryTransport } from "./transport";
export type {
  PresenceClient,
  PresenceOptions,
  PresenceIdentityInput,
} from "./presence";
export { createPresence } from "./presence";
export type { PresenceIdentity } from "./identity";
export { loadIdentity, saveIdentity, colorFor, newSessionId } from "./identity";
