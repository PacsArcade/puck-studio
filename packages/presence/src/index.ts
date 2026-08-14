/**
 * @pacsarcade/presence — framework-free surface.
 *
 * React pieces (usePresence, PresenceBridge, PresenceChips, PresenceHalos)
 * live in `@pacsarcade/presence/react`; the nostr transport lives in
 * `@pacsarcade/presence/nostr` (requires the optional nostr-tools peer).
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
