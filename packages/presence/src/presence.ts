import type {
  PresenceMessage,
  PresencePeer,
  PresenceState,
  TransportStatus,
} from "./types";
import type { PresenceTransport } from "./transport";

/** The identity slice of the broadcast state (see identity.ts). */
export interface PresenceIdentityInput {
  sessionId: string;
  name: string;
  color: string;
}

export interface PresenceOptions {
  identity: PresenceIdentityInput;
  /** Full-state broadcast interval. Default 15000. */
  heartbeatMs?: number;
  /** Drop a peer after this much RECEIPT-clock silence. Default 45000. */
  peerTtlMs?: number;
  /** Trailing debounce for setState publishes. Default 250. */
  debounceMs?: number;
}

export interface PresenceClient {
  /** Merge a partial state and publish it (debounced, trailing edge). */
  setState(partial: Partial<Omit<PresenceState, "sessionId">>): void;
  /** Live peers — excludes self and anything past the TTL. */
  peers(): PresencePeer[];
  /** Notified with the fresh peer list on every peer-table change. */
  subscribe(fn: (peers: PresencePeer[]) => void): () => void;
  /** Transport status pass-through. */
  status(): TransportStatus;
  /** Transport status transitions pass-through. */
  onStatus(fn: (status: TransportStatus) => void): () => void;
  /** Send bye, stop all timers, detach from the transport. Idempotent. */
  close(): void;
}

/** Incoming messages larger than this (JSON chars) are dropped. */
const MAX_MESSAGE_CHARS = 2048;

const BREAKPOINTS = ["phone", "tablet", "desktop", null] as const;

/** Strict wire-schema check — anything unknown is dropped silently. */
const isPresenceMessage = (raw: unknown): raw is PresenceMessage => {
  if (typeof raw !== "object" || raw === null) return false;
  const msg = raw as Record<string, unknown>;
  if (msg.v !== 1) return false;
  if (typeof msg.ts !== "number") return false;
  if (typeof msg.sessionId !== "string" || msg.sessionId === "") return false;
  if (msg.type === "bye") return true;
  if (msg.type !== "presence") return false;
  return (
    typeof msg.name === "string" &&
    typeof msg.color === "string" &&
    typeof msg.slug === "string" &&
    (msg.selectedBlockId === null || typeof msg.selectedBlockId === "string") &&
    (BREAKPOINTS as readonly unknown[]).includes(msg.targetBreakpoint) &&
    typeof msg.rev === "number" &&
    typeof msg.dirty === "boolean"
  );
};

/**
 * The transport-agnostic presence client.
 *
 * - broadcasts the full state every `heartbeatMs` (and once at creation);
 * - `setState` merges + publishes on a trailing `debounceMs` debounce;
 * - tracks peers by sessionId, expiring them `peerTtlMs` after the last
 *   RECEIPT (local clock — event timestamps are never trusted);
 * - a first-seen peer triggers a debounced announce-back so a newcomer
 *   never waits a whole heartbeat to see us;
 * - `bye` removes a peer immediately;
 * - every transport.publish is wrapped — a throwing transport never
 *   surfaces (fail-soft: presence is decoration, not truth).
 */
export const createPresence = (
  transport: PresenceTransport,
  {
    identity,
    heartbeatMs = 15000,
    peerTtlMs = 45000,
    debounceMs = 250,
  }: PresenceOptions
): PresenceClient => {
  let state: PresenceState = {
    sessionId: identity.sessionId,
    name: identity.name,
    color: identity.color,
    slug: "",
    selectedBlockId: null,
    targetBreakpoint: null,
    rev: 0,
    dirty: false,
  };

  const peerTable = new Map<string, PresencePeer>();
  const subscribers = new Set<(peers: PresencePeer[]) => void>();
  let closed = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const safePublish = (msg: PresenceMessage): void => {
    try {
      transport.publish(msg);
    } catch {
      // fail-soft: a throwing transport never surfaces
    }
  };

  const publishState = (): void => {
    if (closed) return;
    safePublish({ v: 1, type: "presence", ts: Date.now(), ...state });
  };

  const schedulePublish = (): void => {
    if (closed) return;
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      publishState();
    }, debounceMs);
  };

  const livePeers = (): PresencePeer[] => {
    const now = Date.now();
    const list: PresencePeer[] = [];
    for (const peer of peerTable.values()) {
      if (now - peer.lastSeen < peerTtlMs) list.push(peer);
    }
    return list;
  };

  const notify = (): void => {
    const snapshot = livePeers();
    for (const fn of [...subscribers]) {
      try {
        fn(snapshot);
      } catch {
        // subscriber errors never break the client
      }
    }
  };

  const sweep = (): void => {
    const now = Date.now();
    let removed = false;
    for (const [id, peer] of peerTable) {
      if (now - peer.lastSeen >= peerTtlMs) {
        peerTable.delete(id);
        removed = true;
      }
    }
    if (removed) notify();
  };

  const onMessage = (raw: unknown): void => {
    if (closed) return;
    try {
      if (JSON.stringify(raw).length > MAX_MESSAGE_CHARS) return;
    } catch {
      return; // unstringifiable → hostile or broken; drop
    }
    if (!isPresenceMessage(raw)) return;
    if (raw.sessionId === state.sessionId) return; // never track self

    if (raw.type === "bye") {
      if (peerTable.delete(raw.sessionId)) notify();
      return;
    }

    const { v: _v, type: _type, ts: _ts, ...peerState } = raw;
    const firstSeen = !peerTable.has(raw.sessionId);
    peerTable.set(raw.sessionId, { ...peerState, lastSeen: Date.now() });
    // Announce back (debounced) so a newcomer discovers us immediately.
    if (firstSeen) schedulePublish();
    notify();
  };

  const unsubscribeTransport = transport.subscribe(onMessage);
  const heartbeatTimer = setInterval(publishState, heartbeatMs);
  const sweepTimer = setInterval(
    sweep,
    Math.max(1000, Math.floor(peerTtlMs / 3))
  );

  publishState(); // announce at birth

  return {
    setState(partial) {
      if (closed) return;
      const { sessionId: _ignored, ...rest } =
        partial as Partial<PresenceState>;
      state = { ...state, ...rest };
      schedulePublish();
    },
    peers: livePeers,
    subscribe(fn) {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
    status: () => transport.status(),
    onStatus: (fn) => transport.onStatus(fn),
    close() {
      if (closed) return;
      closed = true;
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      clearInterval(heartbeatTimer);
      clearInterval(sweepTimer);
      safePublish({
        v: 1,
        type: "bye",
        sessionId: state.sessionId,
        ts: Date.now(),
      });
      unsubscribeTransport();
      subscribers.clear();
      peerTable.clear();
    },
  };
};
