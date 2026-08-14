import { act, cleanup, render } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@dnd-kit/react", () => {
  const original = jest.requireActual("@dnd-kit/react");
  return {
    ...original,
    DragDropProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    useDroppable: () => ({
      ref: () => undefined,
      setNodeRef: () => undefined,
      isOver: false,
    }),
    useDraggable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: () => undefined,
      isDragging: false,
    }),
  };
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }),
});

const originalConsoleError = console.error;
const consoleErrorSpy = jest
  .spyOn(console, "error")
  .mockImplementation((...args: unknown[]) => {
    if (
      args.some((arg) => String(arg).includes("Could not parse CSS stylesheet"))
    ) {
      return;
    }

    originalConsoleError(...(args as Parameters<typeof console.error>));
  });

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(global as any).ResizeObserver = ResizeObserver;

import { Puck, useGetPuck } from "@puckeditor/core";
import type { Config, Data } from "@puckeditor/core";
import type { PresenceClient } from "../presence";
import type { PresencePeer } from "../types";
import { PresenceBridge, PresenceChips, PresenceHalos } from "../react";

const config: Config = {
  components: {
    Text: {
      render: () => <div>Text</div>,
    },
  },
};

const makeData = (): Data => ({
  root: { props: {} },
  content: [],
  zones: {},
});

const flush = () => act(async () => {});

afterEach(() => cleanup());

afterAll(() => {
  consoleErrorSpy.mockRestore();
});

/** A scriptable stand-in for a real client (structural PresenceClient). */
const makeClient = (peers: PresencePeer[] = []) => {
  const subscribers = new Set<(peers: PresencePeer[]) => void>();
  const client = {
    setState: jest.fn(),
    peers: () => peers,
    subscribe: (fn: (peers: PresencePeer[]) => void) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    status: () => "open" as const,
    onStatus: () => () => {},
    close: jest.fn(),
    emit: (next: PresencePeer[]) => {
      peers = next;
      subscribers.forEach((fn) => fn(next));
    },
  };
  return client as PresenceClient & { emit: (next: PresencePeer[]) => void };
};

const makePeer = (overrides: Partial<PresencePeer> = {}): PresencePeer => ({
  sessionId: "peer-1",
  name: "Ada",
  color: "hsl(200, 70%, 62%)",
  slug: "home",
  selectedBlockId: null,
  targetBreakpoint: null,
  rev: 0,
  dirty: false,
  lastSeen: Date.now(),
  ...overrides,
});

describe("PresenceBridge inside <Puck>", () => {
  const setup = async (
    client: PresenceClient,
    bridgeProps: Partial<React.ComponentProps<typeof PresenceBridge>> = {}
  ) => {
    const harness: { getPuck?: ReturnType<typeof useGetPuck> } = {};

    const Tap = () => {
      harness.getPuck = useGetPuck();
      return null;
    };

    render(
      <Puck config={config} data={makeData()}>
        <PresenceBridge client={client} slug="home" {...bridgeProps} />
        <Tap />
      </Puck>
    );

    await flush();

    return harness as { getPuck: ReturnType<typeof useGetPuck> };
  };

  it("publishes the selected block id and the slug", async () => {
    const client = makeClient();
    const harness = await setup(client);

    await act(async () => {
      harness.getPuck().dispatch({
        type: "insert",
        componentType: "Text",
        destinationIndex: 0,
        destinationZone: "root:default-zone",
      });
    });

    const insertedId = (harness.getPuck().appState.data.content[0] as any).props
      .id;

    await act(async () => {
      harness.getPuck().dispatch({
        type: "setUi",
        ui: { itemSelector: { index: 0, zone: "root:default-zone" } },
      });
    });

    const calls = (client.setState as jest.Mock).mock.calls;
    expect(calls[calls.length - 1][0]).toMatchObject({
      slug: "home",
      selectedBlockId: insertedId,
    });

    // Deselect → null again.
    await act(async () => {
      harness.getPuck().dispatch({
        type: "setUi",
        ui: { itemSelector: null },
      });
    });
    const after = (client.setState as jest.Mock).mock.calls;
    expect(after[after.length - 1][0]).toMatchObject({
      selectedBlockId: null,
    });
  });

  it("maps viewport width to targetBreakpoint (1080/768 rungs, non-number null)", async () => {
    const client = makeClient();
    const harness = await setup(client);

    const setWidth = (width: number | "100%") =>
      act(async () => {
        const viewports = harness.getPuck().appState.ui.viewports;
        harness.getPuck().dispatch({
          type: "setUi",
          ui: {
            viewports: { ...viewports, current: { width, height: "auto" } },
          },
        });
      });

    const lastBreakpoint = () => {
      const calls = (client.setState as jest.Mock).mock.calls;
      return calls[calls.length - 1][0].targetBreakpoint;
    };

    await setWidth(1440);
    expect(lastBreakpoint()).toBe("desktop");
    await setWidth(1080);
    expect(lastBreakpoint()).toBe("desktop");
    await setWidth(800);
    expect(lastBreakpoint()).toBe("tablet");
    await setWidth(375);
    expect(lastBreakpoint()).toBe("phone");
    await setWidth("100%");
    expect(lastBreakpoint()).toBe(null);
  });

  it("bumps rev from the log and forwards dirty", async () => {
    const client = makeClient();
    let record: ((rec: { rev: number }) => void) | null = null;
    const log = {
      subscribe: (fn: (rec: { rev: number }) => void) => {
        record = fn;
        return () => {
          record = null;
        };
      },
    };

    await setup(client, { log, dirty: true });

    const calls = (client.setState as jest.Mock).mock.calls;
    expect(calls[calls.length - 1][0]).toMatchObject({ dirty: true });

    await act(async () => {
      record?.({ rev: 42 });
    });

    expect(client.setState).toHaveBeenCalledWith({ rev: 42 });
  });
});

describe("PresenceChips", () => {
  it("renders one chip per peer with initial, color and name·slug title", () => {
    const client = makeClient([
      makePeer(),
      makePeer({
        sessionId: "peer-2",
        name: "bob",
        color: "#22cc88",
        slug: "about",
      }),
    ]);

    const { getByTitle, container } = render(<PresenceChips client={client} />);

    expect(container.querySelectorAll("span")).toHaveLength(2);

    const ada = getByTitle("Ada·home");
    expect(ada).toHaveTextContent("A");
    // jsdom normalizes hsl(200, 70%, 62%) to its rgb equivalent
    expect(ada.style.background).toContain("rgb(90, 181, 226)");

    const bob = getByTitle("bob·about");
    expect(bob).toHaveTextContent("B"); // initial is uppercased
  });

  it("renders nothing for a null client or an empty room", () => {
    const empty = render(<PresenceChips client={null} />);
    expect(empty.container).toBeEmptyDOMElement();

    const alone = render(<PresenceChips client={makeClient([])} />);
    expect(alone.container).toBeEmptyDOMElement();
  });

  it("re-renders when the peer list changes", () => {
    const client = makeClient([]);
    const { container } = render(<PresenceChips client={client} />);
    expect(container).toBeEmptyDOMElement();

    act(() => {
      client.emit([makePeer()]);
    });
    expect(container.querySelectorAll("span")).toHaveLength(1);
  });
});

describe("PresenceHalos", () => {
  const styleEl = () => document.getElementById("oc-presence-halos");

  it("injects one head style with a halo per same-slug selecting peer", () => {
    const client = makeClient([
      makePeer({ selectedBlockId: "blk-1" }),
      makePeer({
        sessionId: "peer-2",
        name: "Bob",
        color: "#22cc88",
        selectedBlockId: "blk_2-x",
      }),
      // Different slug — no halo here.
      makePeer({
        sessionId: "peer-3",
        slug: "about",
        selectedBlockId: "blk-3",
      }),
      // No selection — no halo.
      makePeer({ sessionId: "peer-4", selectedBlockId: null }),
    ]);

    const { unmount } = render(<PresenceHalos client={client} slug="home" />);

    const css = styleEl()?.textContent ?? "";
    expect(css).toContain(
      '[data-puck-component="blk-1"]{outline:2px solid hsl(200, 70%, 62%) !important;outline-offset:3px;border-radius:2px}'
    );
    expect(css).toContain('[data-puck-component="blk_2-x"]');
    expect(css).toContain("#22cc88");
    expect(css).not.toContain("blk-3");

    unmount();
    expect(styleEl()).toBeNull(); // cleaned up
  });

  it("REJECTS a malicious block id and a malicious color", () => {
    const client = makeClient([
      makePeer({ selectedBlockId: 'x"]{}body{display:none}' }),
      makePeer({
        sessionId: "peer-2",
        selectedBlockId: "blk-ok",
        color: "red;}body{display:none}",
      }),
      makePeer({
        sessionId: "peer-3",
        selectedBlockId: "blk-fine",
        color: "hsl(120, 70%, 62%)",
      }),
    ]);

    render(<PresenceHalos client={client} slug="home" />);

    const css = styleEl()?.textContent ?? "";
    expect(css).not.toContain("display:none");
    expect(css).not.toContain("body");
    expect(css).not.toContain("blk-ok"); // bad color kills the whole rule
    expect(css).toContain('[data-puck-component="blk-fine"]'); // good peer intact
  });

  it("renders nothing for a null client", () => {
    render(<PresenceHalos client={null} slug="home" />);
    expect(styleEl()?.textContent ?? "").toBe("");
  });
});
