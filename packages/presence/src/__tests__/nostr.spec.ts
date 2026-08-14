/**
 * Nostr transport specs — the pool module is mocked (no live relay);
 * nip44 + event signing run UNMOCKED (pure js), so the encrypt→decrypt
 * roundtrip is the real thing.
 */

type SubscribeCall = {
  relays: string[];
  filter: Record<string, unknown>;
  params: {
    onevent: (event: unknown) => void;
    oneose?: () => void;
    onclose?: (reasons: { url: string; reason: string }[]) => void;
  };
};

type MockPool = {
  subscribeCalls: SubscribeCall[];
  published: { relays: string[]; event: any }[];
  closedSubs: number;
  closedRelays: string[][];
};

const mockPools: MockPool[] = [];

jest.mock("nostr-tools/pool", () => ({
  __esModule: true,
  SimplePool: class {
    subscribeCalls: SubscribeCall[] = [];
    published: { relays: string[]; event: any }[] = [];
    closedSubs = 0;
    closedRelays: string[][] = [];

    constructor() {
      mockPools.push(this as unknown as MockPool);
    }

    subscribe(
      relays: string[],
      filter: Record<string, unknown>,
      params: SubscribeCall["params"]
    ) {
      this.subscribeCalls.push({ relays, filter, params });
      return {
        close: () => {
          this.closedSubs++;
        },
      };
    }

    publish(relays: string[], event: unknown) {
      this.published.push({ relays, event });
      return [Promise.resolve("ok")];
    }

    close(relays: string[]) {
      this.closedRelays.push(relays);
    }
  },
}));

import { v2 as nip44v2 } from "nostr-tools/nip44";
import { verifyEvent } from "nostr-tools/pure";
import { createNostrTransport, PRESENCE_KIND } from "../nostr";
import type { PresenceMessage } from "../types";

const RELAYS = ["wss://relay-one.example", "wss://relay-two.example"];
const ROOM_ID = "oc-room-7";
const ROOM_KEY = "a".repeat(64);
const keyBytes = new Uint8Array(32).fill(0xaa);

const msg: PresenceMessage = {
  v: 1,
  type: "presence",
  ts: 1700000000000,
  sessionId: "sess-a",
  name: "Ada",
  color: "hsl(200, 70%, 62%)",
  slug: "home",
  selectedBlockId: "blk-1",
  targetBreakpoint: "desktop",
  rev: 4,
  dirty: true,
};

const lastPool = (): MockPool => mockPools[mockPools.length - 1];

beforeEach(() => {
  mockPools.length = 0;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("createNostrTransport", () => {
  it("rejects a roomKey that is not 64 hex chars", () => {
    expect(() =>
      createNostrTransport({ relays: RELAYS, roomId: ROOM_ID, roomKey: "ab" })
    ).toThrow(TypeError);
  });

  it("subscribes with the room filter and publishes signed kind-25050 events", () => {
    const transport = createNostrTransport({
      relays: RELAYS,
      roomId: ROOM_ID,
      roomKey: ROOM_KEY,
    });
    const pool = lastPool();

    expect(pool.subscribeCalls).toHaveLength(1);
    const { relays, filter } = pool.subscribeCalls[0];
    expect(relays).toEqual(RELAYS);
    expect(filter.kinds).toEqual([PRESENCE_KIND]);
    expect(filter["#t"]).toEqual([ROOM_ID]);
    const nowSec = Math.floor(Date.now() / 1000);
    expect(filter.since).toBeGreaterThanOrEqual(nowSec - 61);
    expect(filter.since).toBeLessThanOrEqual(nowSec - 59);

    transport.publish(msg);

    expect(pool.published).toHaveLength(1);
    const { relays: pubRelays, event } = pool.published[0];
    expect(pubRelays).toEqual(RELAYS);
    expect(event.kind).toBe(25050);
    expect(event.tags).toEqual([["t", ROOM_ID]]);
    expect(verifyEvent(event)).toBe(true); // throwaway key really signed it

    // Content is nip44 v2 ciphertext under the RAW room key — decryptable
    // with the key bytes alone.
    const plaintext = nip44v2.decrypt(event.content, keyBytes);
    expect(JSON.parse(plaintext)).toEqual(msg);

    transport.close();
  });

  it("roundtrips: one transport's published event decrypts in another's onevent", () => {
    const sender = createNostrTransport({
      relays: RELAYS,
      roomId: ROOM_ID,
      roomKey: ROOM_KEY,
    });
    const senderPool = lastPool();
    const receiver = createNostrTransport({
      relays: RELAYS,
      roomId: ROOM_ID,
      roomKey: ROOM_KEY,
    });
    const receiverPool = lastPool();

    const received: PresenceMessage[] = [];
    receiver.subscribe((m) => received.push(m));

    sender.publish(msg);
    receiverPool.subscribeCalls[0].params.onevent(
      senderPool.published[0].event
    );

    expect(received).toEqual([msg]);

    sender.close();
    receiver.close();
  });

  it("drops undecryptable and oversized events silently", () => {
    const transport = createNostrTransport({
      relays: RELAYS,
      roomId: ROOM_ID,
      roomKey: ROOM_KEY,
    });
    const pool = lastPool();
    const received: PresenceMessage[] = [];
    transport.subscribe((m) => received.push(m));
    const { onevent } = pool.subscribeCalls[0].params;

    expect(() => {
      onevent({ kind: 25050, content: "not-nip44-at-all", tags: [] });
      onevent({ kind: 25050, content: "x".repeat(10000), tags: [] });
      onevent({ kind: 25050, content: 42, tags: [] });
    }).not.toThrow();

    expect(received).toEqual([]);
    transport.close();
  });

  it("walks connecting → open (eose) → down (close) and back", () => {
    const transport = createNostrTransport({
      relays: RELAYS,
      roomId: ROOM_ID,
      roomKey: ROOM_KEY,
    });
    const pool = lastPool();
    const seen: string[] = [];
    transport.onStatus((s) => seen.push(s));

    expect(transport.status()).toBe("connecting");

    pool.subscribeCalls[0].params.oneose?.();
    expect(transport.status()).toBe("open");

    pool.subscribeCalls[0].params.onclose?.([
      { url: RELAYS[0], reason: "gone" },
      { url: RELAYS[1], reason: "gone" },
    ]);
    expect(transport.status()).toBe("down");

    jest.advanceTimersByTime(1000); // first redial ≤ 1s
    expect(transport.status()).toBe("connecting");
    expect(pool.subscribeCalls).toHaveLength(2);

    expect(seen).toEqual(["open", "down", "connecting"]);
    transport.close();
  });

  it("backs off exponentially with jitter in [cap/2, cap], capped at 30s", () => {
    const transport = createNostrTransport({
      relays: RELAYS,
      roomId: ROOM_ID,
      roomKey: ROOM_KEY,
    });
    const pool = lastPool();

    const closeCurrent = () => {
      const call = pool.subscribeCalls[pool.subscribeCalls.length - 1];
      call.params.onclose?.([{ url: RELAYS[0], reason: "gone" }]);
    };

    // Attempts 1..3: caps 1s, 2s, 4s — never before cap/2, always by cap.
    for (const cap of [1000, 2000, 4000]) {
      const subsBefore = pool.subscribeCalls.length;
      closeCurrent();
      jest.advanceTimersByTime(cap / 2 - 1);
      expect(pool.subscribeCalls.length).toBe(subsBefore);
      jest.advanceTimersByTime(cap / 2 + 1);
      expect(pool.subscribeCalls.length).toBe(subsBefore + 1);
    }

    // Grind the attempt counter well past the cap: 8s 16s 30s 30s…
    for (let i = 0; i < 4; i++) {
      closeCurrent();
      jest.advanceTimersByTime(30000);
    }

    // Attempt counter is deep past the ceiling — the delay must still be ≤30s.
    const subsBefore = pool.subscribeCalls.length;
    closeCurrent();
    jest.advanceTimersByTime(14999);
    expect(pool.subscribeCalls.length).toBe(subsBefore); // ≥ cap/2
    jest.advanceTimersByTime(15001);
    expect(pool.subscribeCalls.length).toBe(subsBefore + 1); // ≤ cap

    transport.close();
  });

  it("a live eose resets the backoff to the 1s rung", () => {
    const transport = createNostrTransport({
      relays: RELAYS,
      roomId: ROOM_ID,
      roomKey: ROOM_KEY,
    });
    const pool = lastPool();
    const current = () =>
      pool.subscribeCalls[pool.subscribeCalls.length - 1].params;

    // Climb two rungs...
    current().onclose?.([{ url: RELAYS[0], reason: "x" }]);
    jest.advanceTimersByTime(1000);
    current().onclose?.([{ url: RELAYS[0], reason: "x" }]);
    jest.advanceTimersByTime(2000);

    // ...then connect for real: eose resets the ladder.
    current().oneose?.();
    expect(transport.status()).toBe("open");

    const subsBefore = pool.subscribeCalls.length;
    current().onclose?.([{ url: RELAYS[0], reason: "x" }]);
    jest.advanceTimersByTime(1000); // back on the 1s rung, not 4s
    expect(pool.subscribeCalls.length).toBe(subsBefore + 1);

    transport.close();
  });

  it("close() closes the sub and the pool, stops the redial, and publish becomes a no-op", () => {
    const transport = createNostrTransport({
      relays: RELAYS,
      roomId: ROOM_ID,
      roomKey: ROOM_KEY,
    });
    const pool = lastPool();

    // A live sub gets closed on transport.close().
    const live = createNostrTransport({
      relays: RELAYS,
      roomId: ROOM_ID,
      roomKey: ROOM_KEY,
    });
    const livePool = lastPool();
    live.close();
    expect(livePool.closedSubs).toBe(1);

    // Put a reconnect in flight (the pool already dropped the sub), then close.
    pool.subscribeCalls[0].params.onclose?.([{ url: RELAYS[0], reason: "x" }]);
    transport.close();

    expect(pool.closedSubs).toBe(0); // nothing live left to close
    expect(pool.closedRelays).toEqual([RELAYS]);
    expect(transport.status()).toBe("down");
    expect(jest.getTimerCount()).toBe(0);

    jest.advanceTimersByTime(60000);
    expect(pool.subscribeCalls).toHaveLength(1); // no zombie redial

    transport.publish(msg);
    expect(pool.published).toEqual([]);
  });
});
