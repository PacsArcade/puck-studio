import { SimplePool } from "nostr-tools/pool";
import type { SubCloser } from "nostr-tools/pool";
import type { Event } from "nostr-tools/core";
import { finalizeEvent, generateSecretKey } from "nostr-tools/pure";
import { v2 as nip44v2 } from "nostr-tools/nip44";
import type { PresenceMessage, TransportStatus } from "./types";
import type { PresenceTransport } from "./transport";

export interface NostrTransportOptions {
  /** Relay URLs (wss://…). */
  relays: string[];
  /** Room discriminator — the ["t", roomId] tag and subscription filter. */
  roomId: string;
  /**
   * 32-byte room key, hex-encoded (64 chars). Used DIRECTLY as the
   * nip44 v2 conversation key — everyone holding it can read the room.
   */
  roomKey: string;
}

/** Ephemeral-range kind: relays broadcast but do not store. */
export const PRESENCE_KIND = 25050;

const BACKOFF_MIN_MS = 1000;
const BACKOFF_MAX_MS = 30000;
/** Ciphertexts beyond this are dropped before decrypt (DoS guard). */
const MAX_CONTENT_CHARS = 8192;

const hexToBytes = (hex: string): Uint8Array => {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new TypeError(
      "roomKey must be 64 hex chars (a 32-byte nip44 conversation key)"
    );
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

/**
 * Presence over nostr: kind-25050 ephemeral events tagged ["t", roomId],
 * content nip44-v2-encrypted with a shared raw room key, signed by a
 * throwaway per-instance key. publish NEVER throws; any failure moves
 * status to "down" and a jittered exponential backoff (1s→30s) redials.
 */
export const createNostrTransport = ({
  relays,
  roomId,
  roomKey,
}: NostrTransportOptions): PresenceTransport => {
  const conversationKey = hexToBytes(roomKey);
  const secretKey = generateSecretKey();
  const pool = new SimplePool();

  const listeners = new Set<(msg: PresenceMessage) => void>();
  const statusListeners = new Set<(status: TransportStatus) => void>();
  let status: TransportStatus = "connecting";
  let closed = false;
  let sub: SubCloser | null = null;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const setStatus = (next: TransportStatus): void => {
    if (status === next) return;
    status = next;
    for (const fn of [...statusListeners]) {
      try {
        fn(next);
      } catch {
        // listener errors never surface
      }
    }
  };

  const onEvent = (event: Event): void => {
    if (closed) return;
    if (status !== "open") setStatus("open");
    try {
      if (typeof event.content !== "string") return;
      if (event.content.length > MAX_CONTENT_CHARS) return;
      const plaintext = nip44v2.decrypt(event.content, conversationKey);
      const raw = JSON.parse(plaintext) as PresenceMessage;
      for (const fn of [...listeners]) {
        try {
          fn(raw);
        } catch {
          // subscriber errors never surface
        }
      }
    } catch {
      // undecryptable / unparseable → drop silently
    }
  };

  const scheduleReconnect = (): void => {
    if (closed || reconnectTimer !== null) return;
    attempt += 1;
    const cap = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** (attempt - 1));
    // Jitter into [cap/2, cap] so a fleet of editors never thunders.
    const delay = cap / 2 + Math.random() * (cap / 2);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (closed) return;
      setStatus("connecting");
      openSub();
    }, delay);
  };

  const openSub = (): void => {
    try {
      sub = pool.subscribe(
        relays,
        {
          kinds: [PRESENCE_KIND],
          "#t": [roomId],
          since: Math.floor(Date.now() / 1000) - 60,
        },
        {
          onevent: onEvent,
          oneose: () => {
            if (closed) return;
            attempt = 0; // a live subscription resets the backoff
            setStatus("open");
          },
          onclose: () => {
            if (closed) return;
            sub = null;
            setStatus("down");
            scheduleReconnect();
          },
        }
      );
    } catch {
      sub = null;
      setStatus("down");
      scheduleReconnect();
    }
  };

  openSub();

  return {
    publish(msg) {
      if (closed) return;
      try {
        const content = nip44v2.encrypt(JSON.stringify(msg), conversationKey);
        const event = finalizeEvent(
          {
            kind: PRESENCE_KIND,
            created_at: Math.floor(Date.now() / 1000),
            tags: [["t", roomId]],
            content,
          },
          secretKey
        );
        for (const relayPublish of pool.publish(relays, event)) {
          relayPublish.catch(() => {
            // per-relay rejection — the subscription's onclose owns status
          });
        }
      } catch {
        // NEVER throw out of publish: mark down and let the redial run
        setStatus("down");
        scheduleReconnect();
      }
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    status: () => status,
    onStatus(fn) {
      statusListeners.add(fn);
      return () => {
        statusListeners.delete(fn);
      };
    },
    close() {
      if (closed) return;
      closed = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      try {
        sub?.close();
      } catch {
        // already torn down
      }
      sub = null;
      try {
        pool.close(relays);
      } catch {
        // already torn down
      }
      setStatus("down");
      listeners.clear();
      statusListeners.clear();
    },
  };
};
