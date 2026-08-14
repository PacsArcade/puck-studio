import { MemoryHub, createMemoryTransport } from "../transport";
import type { PresenceTransport } from "../transport";
import { createPresence } from "../presence";
import type { PresenceIdentityInput } from "../presence";
import type { PresenceMessage } from "../types";

const idA: PresenceIdentityInput = {
  sessionId: "sess-a",
  name: "Ada",
  color: "hsl(200, 70%, 62%)",
};
const idB: PresenceIdentityInput = {
  sessionId: "sess-b",
  name: "Bob",
  color: "hsl(20, 70%, 62%)",
};

const presenceMsg = (
  sessionId: string,
  extra: Partial<PresenceMessage> = {}
): PresenceMessage =>
  ({
    v: 1,
    type: "presence",
    ts: Date.now(),
    sessionId,
    name: "X",
    color: "hsl(1, 70%, 62%)",
    slug: "home",
    selectedBlockId: null,
    targetBreakpoint: null,
    rev: 0,
    dirty: false,
    ...extra,
  } as PresenceMessage);

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("createPresence over a MemoryHub", () => {
  it("two clients discover each other (announce at birth + announce-back)", () => {
    const hub = new MemoryHub();
    const a = createPresence(createMemoryTransport(hub), { identity: idA });
    const b = createPresence(createMemoryTransport(hub), { identity: idB });

    // b announced at birth — a sees b synchronously.
    expect(a.peers().map((p) => p.sessionId)).toEqual(["sess-b"]);
    // a announces back on the debounce, not a full heartbeat.
    expect(b.peers()).toEqual([]);
    jest.advanceTimersByTime(250);
    expect(b.peers().map((p) => p.sessionId)).toEqual(["sess-a"]);
    expect(b.peers()[0]).toMatchObject({ name: "Ada", color: idA.color });

    a.close();
    b.close();
  });

  it("setState debounces trailing and coalesces into one merged publish", () => {
    const hub = new MemoryHub();
    const transport = createMemoryTransport(hub);
    const publishSpy = jest.spyOn(transport, "publish");
    const a = createPresence(transport, { identity: idA });

    const publishesAtBirth = publishSpy.mock.calls.length;

    a.setState({ slug: "home" });
    jest.advanceTimersByTime(100);
    a.setState({ selectedBlockId: "blk-1" });
    jest.advanceTimersByTime(100);
    a.setState({ dirty: true });

    // Trailing edge: nothing yet, even 249ms after the LAST call.
    jest.advanceTimersByTime(249);
    expect(publishSpy.mock.calls.length).toBe(publishesAtBirth);

    jest.advanceTimersByTime(1);
    expect(publishSpy.mock.calls.length).toBe(publishesAtBirth + 1);
    expect(publishSpy.mock.calls[publishesAtBirth][0]).toMatchObject({
      v: 1,
      type: "presence",
      sessionId: "sess-a",
      slug: "home",
      selectedBlockId: "blk-1",
      dirty: true,
    });

    a.close();
  });

  it("heartbeats keep a silent-but-alive peer in the table", () => {
    const hub = new MemoryHub();
    const a = createPresence(createMemoryTransport(hub), { identity: idA });
    const b = createPresence(createMemoryTransport(hub), { identity: idB });

    // Three heartbeat periods pass — well beyond the 45s TTL in total.
    jest.advanceTimersByTime(3 * 15000 + 5000);
    expect(a.peers().map((p) => p.sessionId)).toEqual(["sess-b"]);
    expect(b.peers().map((p) => p.sessionId)).toEqual(["sess-a"]);

    a.close();
    b.close();
  });

  it("expires a peer by RECEIPT time after TTL silence and notifies", () => {
    const hub = new MemoryHub();
    const a = createPresence(createMemoryTransport(hub), { identity: idA });
    const injector = createMemoryTransport(hub);
    const seen = jest.fn();
    a.subscribe(seen);

    // A future event ts must NOT extend the peer's life — receipt clock only.
    injector.publish(
      presenceMsg("peer-x", { ts: Date.now() + 10 * 60 * 1000 })
    );
    expect(a.peers().map((p) => p.sessionId)).toEqual(["peer-x"]);

    jest.advanceTimersByTime(44000);
    expect(a.peers().map((p) => p.sessionId)).toEqual(["peer-x"]);

    jest.advanceTimersByTime(16000); // past TTL + sweep interval
    expect(a.peers()).toEqual([]);
    expect(seen).toHaveBeenLastCalledWith([]);

    a.close();
  });

  it("bye removes a peer immediately", () => {
    const hub = new MemoryHub();
    const a = createPresence(createMemoryTransport(hub), { identity: idA });
    const injector = createMemoryTransport(hub);
    const seen = jest.fn();
    a.subscribe(seen);

    injector.publish(presenceMsg("peer-x"));
    expect(a.peers()).toHaveLength(1);

    injector.publish({
      v: 1,
      type: "bye",
      sessionId: "peer-x",
      ts: Date.now(),
    });
    expect(a.peers()).toEqual([]);
    expect(seen).toHaveBeenLastCalledWith([]);

    a.close();
  });

  it("close sends bye, stops heartbeat + debounce timers, detaches", () => {
    const hub = new MemoryHub();
    const transport = createMemoryTransport(hub);
    const publishSpy = jest.spyOn(transport, "publish");
    const a = createPresence(transport, { identity: idA });
    const b = createPresence(createMemoryTransport(hub), { identity: idB });

    jest.advanceTimersByTime(250);
    expect(b.peers()).toHaveLength(1);

    a.setState({ slug: "pending" }); // debounce in flight at close time
    a.close();

    // bye went out and removed us over there, immediately.
    expect(publishSpy.mock.calls.map((c) => c[0].type)).toContain("bye");
    expect(b.peers()).toEqual([]);

    // No heartbeat, no trailing debounce publish, ever again.
    const publishesAtClose = publishSpy.mock.calls.length;
    jest.advanceTimersByTime(120000);
    expect(publishSpy.mock.calls.length).toBe(publishesAtClose);

    b.close(); // the only remaining timers were b's own
    expect(jest.getTimerCount()).toBe(0);
  });

  it("a throwing transport never surfaces", () => {
    const bad: PresenceTransport = {
      publish: () => {
        throw new Error("boom");
      },
      subscribe: () => () => {},
      status: () => "open",
      onStatus: () => () => {},
      close: () => {},
    };

    expect(() => {
      const a = createPresence(bad, { identity: idA });
      a.setState({ slug: "home" });
      jest.advanceTimersByTime(60000); // debounce + heartbeats all fire
      a.close(); // bye also goes through the throwing publish
    }).not.toThrow();
  });

  it("drops unknown v/type, oversized and self messages silently", () => {
    const hub = new MemoryHub();
    const a = createPresence(createMemoryTransport(hub), { identity: idA });
    const injector = createMemoryTransport(hub);

    injector.publish({ ...presenceMsg("peer-1"), v: 2 } as never);
    injector.publish({
      v: 1,
      type: "cursor",
      sessionId: "peer-2",
      ts: Date.now(),
    } as never);
    injector.publish(presenceMsg("peer-3", { name: "x".repeat(3000) }));
    injector.publish(presenceMsg("sess-a")); // our own sessionId echoed back

    expect(a.peers()).toEqual([]);

    // A well-formed message still lands — the guards are surgical.
    injector.publish(presenceMsg("peer-4"));
    expect(a.peers().map((p) => p.sessionId)).toEqual(["peer-4"]);

    a.close();
  });
});
