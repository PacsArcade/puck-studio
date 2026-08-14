import type { PresenceMessage, TransportStatus } from "./types";

/**
 * The seam between the presence client and the wire. Implementations:
 * `createNostrTransport` (@pacsarcade/presence/nostr) for production,
 * `createMemoryTransport` for tests and single-process demos.
 */
export interface PresenceTransport {
  /** Fire-and-forget send. MUST NOT throw — failures are swallowed. */
  publish(msg: PresenceMessage): void;
  /** Stream incoming messages. Returns an unsubscribe function. */
  subscribe(fn: (msg: PresenceMessage) => void): () => void;
  /** Current connection state. */
  status(): TransportStatus;
  /** Stream status transitions. Returns an unsubscribe function. */
  onStatus(fn: (status: TransportStatus) => void): () => void;
  /** Tear down the transport. Idempotent. */
  close(): void;
}

type HubMember = { deliver: (msg: PresenceMessage) => void };

/**
 * In-process message bus connecting any number of memory transports —
 * each publish is delivered synchronously to every OTHER member.
 */
export class MemoryHub {
  private members = new Set<HubMember>();

  join(member: HubMember): () => void {
    this.members.add(member);
    return () => {
      this.members.delete(member);
    };
  }

  broadcast(from: HubMember, msg: PresenceMessage): void {
    for (const member of [...this.members]) {
      if (member === from) continue;
      try {
        member.deliver(msg);
      } catch {
        // a broken receiver never breaks the sender
      }
    }
  }
}

/**
 * A transport over a `MemoryHub`. Pass the same hub to several transports
 * to wire clients together; omit it for an isolated (loopback-free) one.
 */
export const createMemoryTransport = (
  hub: MemoryHub = new MemoryHub()
): PresenceTransport => {
  const listeners = new Set<(msg: PresenceMessage) => void>();
  const statusListeners = new Set<(status: TransportStatus) => void>();
  let status: TransportStatus = "open";

  const member: HubMember = {
    deliver: (msg) => {
      if (status !== "open") return;
      for (const fn of [...listeners]) {
        try {
          fn(msg);
        } catch {
          // subscriber errors never surface into the hub
        }
      }
    },
  };

  const leave = hub.join(member);

  return {
    publish(msg) {
      if (status !== "open") return;
      try {
        hub.broadcast(member, msg);
      } catch {
        // fire-and-forget: never throws out
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
      if (status === "down") return;
      status = "down";
      leave();
      for (const fn of [...statusListeners]) {
        try {
          fn("down");
        } catch {
          // never throws out
        }
      }
      listeners.clear();
      statusListeners.clear();
    },
  };
};
