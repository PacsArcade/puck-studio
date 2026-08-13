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
import { createChangelog } from "../changelog";
import { ChangelogBridge, useApplyData, _pruneSnapshots } from "../react";
import type { Changelog } from "../types";

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
const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

afterEach(() => cleanup());

afterAll(() => {
  consoleErrorSpy.mockRestore();
});

type Harness = {
  getPuck: ReturnType<typeof useGetPuck>;
  applyData: ReturnType<typeof useApplyData>;
};

const setup = async (
  log: Changelog,
  bridgeProps: Partial<React.ComponentProps<typeof ChangelogBridge>> = {},
  data: Data = makeData()
) => {
  const harness: Partial<Harness> = {};

  const Tap = () => {
    harness.getPuck = useGetPuck();
    harness.applyData = useApplyData(log);
    return null;
  };

  render(
    <Puck
      config={config}
      data={data}
      onAction={(action, appState, prevAppState) =>
        log.onAction(action, appState, prevAppState)
      }
    >
      <ChangelogBridge log={log} {...bridgeProps} />
      <Tap />
    </Puck>
  );

  await flush();

  return harness as Harness;
};

const insert = (harness: Harness, index: number) =>
  act(async () => {
    harness.getPuck().dispatch({
      type: "insert",
      componentType: "Text",
      destinationIndex: index,
      destinationZone: "root:default-zone",
    });
  });

describe("changelog inside <Puck>", () => {
  it("streams an editor-origin record for a dispatched insert", async () => {
    const log = createChangelog(makeData());
    const harness = await setup(log);

    const revBefore = log.rev();

    await insert(harness, 0);

    expect(log.rev()).toBe(revBefore + 1);

    const records = log.records();
    const rec = records[records.length - 1];
    const insertedId = (harness.getPuck().appState.data.content[0] as any).props
      .id;

    expect(rec.action).toBe("insert");
    expect(rec.origin).toBe("editor");
    expect(rec.patches.some((p) => p.op === "add")).toBe(true);
    expect(rec.blockIds).toContain(insertedId);
  });

  it("useApplyData tags programmatic edits and rides the public dispatch", async () => {
    const initial = makeData();
    const log = createChangelog(initial);
    const harness = await setup(log, {}, initial);

    const next: Data = {
      ...initial,
      content: [{ type: "Text", props: { id: "prog-1" } }],
    };

    await act(async () => {
      harness.applyData(next, "copilot");
    });

    const records = log.records();
    const rec = records[records.length - 1];

    expect(rec.action).toBe("setData");
    expect(rec.origin).toBe("copilot");
    expect(rec.blockIds).toContain("prog-1");
    expect(harness.getPuck().appState.data.content).toHaveLength(1);
  });

  it("re-tags Puck's undo as origin undo and restores host view state", async () => {
    const log = createChangelog(makeData());

    const harness = {} as Harness;

    // Return the id of the newest history entry at snapshot time, so the
    // test can verify WHICH snapshot gets restored without assuming how
    // many mount-time entries Puck creates.
    const captureViewState = jest.fn(() => {
      const h = harness.getPuck ? harness.getPuck().history.histories : [];
      return h.length ? `view:${h[h.length - 1]?.id}` : "view:initial";
    });
    const restoreViewState = jest.fn();

    Object.assign(
      harness,
      await setup(log, { captureViewState, restoreViewState })
    );

    // Two edits, each given time for Puck's debounced (250ms) history record
    await insert(harness, 0);
    await wait(350);
    await insert(harness, 1);
    await wait(350);

    const histories = harness.getPuck().history.histories;
    expect(histories.length).toBeGreaterThanOrEqual(2);
    // The bridge snapshots view state at mount and per new entry
    expect(captureViewState.mock.calls.length).toBeGreaterThanOrEqual(3);

    const revBefore = log.rev();

    await act(async () => {
      harness.getPuck().history.back();
    });
    await flush();

    // The undo dispatched a "set" that the changelog recorded...
    expect(log.rev()).toBe(revBefore + 1);

    const records = log.records();
    const rec = records[records.length - 1];

    // ...and the bridge re-tagged it.
    expect(rec.action).toBe("set");
    expect(rec.origin).toBe("undo");

    // Host view state restored from the snapshot of the entry we undid to
    const landedIndex = harness.getPuck().history.index;
    expect(restoreViewState).toHaveBeenCalledTimes(1);
    expect(restoreViewState).toHaveBeenCalledWith(
      `view:${histories[landedIndex]?.id}`
    );

    // Redo re-tags the other way
    await act(async () => {
      harness.getPuck().history.forward();
    });
    await flush();

    const after = log.records();
    expect(after[after.length - 1].origin).toBe("redo");
  });

  it("classifies an edit after undo as a new entry, never a redo (redo-tail truncation)", async () => {
    const log = createChangelog(makeData());
    const captureViewState = jest.fn(() => "view");
    const restoreViewState = jest.fn();
    const harness = await setup(log, { captureViewState, restoreViewState });

    await insert(harness, 0);
    await wait(350);
    await insert(harness, 1);
    await wait(350);

    await act(async () => {
      harness.getPuck().history.back();
    });
    await flush();

    const recsAfterUndo = log.records();
    expect(recsAfterUndo[recsAfterUndo.length - 1].origin).toBe("undo");
    expect(restoreViewState).toHaveBeenCalledTimes(1);

    const capturesBefore = captureViewState.mock.calls.length;

    // A fresh edit after undo TRUNCATES the redo tail: the history count
    // shrinks or stays flat while the index moves FORWARD — the trap that
    // breaks count-based classification into a bogus "redo".
    await insert(harness, 0);
    await wait(350);

    const records = log.records();
    const last = records[records.length - 1];
    expect(last.action).toBe("insert");
    expect(last.origin).toBe("editor"); // not "redo"

    // The new entry got its own view-state snapshot...
    expect(captureViewState.mock.calls.length).toBe(capturesBefore + 1);
    // ...and no bogus restore fired.
    expect(restoreViewState).toHaveBeenCalledTimes(1);
  });

  it("skips the re-tag when the history move's set is not the only new record", async () => {
    const log = createChangelog(makeData());
    const harness = await setup(log);

    await insert(harness, 0);
    await wait(350);
    await insert(harness, 1);
    await wait(350);

    // Interleave: an edit whose debounced history entry is still pending,
    // then an immediate undo. TWO records land before the bridge looks
    // (the insert and the undo's "set") — the tail is ambiguous, so the
    // bridge must not blindly re-tag the last record.
    await act(async () => {
      harness.getPuck().dispatch({
        type: "insert",
        componentType: "Text",
        destinationIndex: 2,
        destinationZone: "root:default-zone",
      });
      harness.getPuck().history.back();
    });
    await flush();

    const records = log.records();
    const last = records[records.length - 1];
    expect(last.action).toBe("set");
    expect(last.origin).toBe("editor"); // left untouched: skip, don't guess
  });

  it("useApplyData fully replaces the document — a next without zones clears zones", async () => {
    const initial: Data = {
      root: { props: {} },
      content: [],
      zones: {
        "band-1:extras": [{ type: "Text", props: { id: "z-1" } }],
      },
    };
    const log = createChangelog(initial);
    const harness = await setup(log, {}, initial);

    // Core's setData shallow-merges: without the bridge sending a complete
    // top-level object, the stale zones would silently survive.
    const next = {
      root: { props: {} },
      content: [{ type: "Text", props: { id: "solo" } }],
    } as Data;

    await act(async () => {
      harness.applyData(next);
    });

    const data = harness.getPuck().appState.data;
    expect(data.content).toHaveLength(1);
    expect((data as any).zones ?? {}).toEqual({});

    const records = log.records();
    expect(records[records.length - 1].origin).toBe("programmatic");
  });
});

describe("_pruneSnapshots", () => {
  it("drops snapshots whose entries left the history, keeps live ids and the initial key", () => {
    const saved = new Map<string, unknown>([
      ["__puck_changelog_initial__", "v0"],
      ["h1", "v1"],
      ["h2", "v2"],
      ["h3", "v3"],
    ]);

    // h2 truncated out of the history (undo-then-edit).
    _pruneSnapshots(saved, new Set(["h1", "h3"]));

    expect([...saved.keys()]).toEqual([
      "__puck_changelog_initial__",
      "h1",
      "h3",
    ]);
    expect(saved.get("h1")).toBe("v1");
  });

  it("bounds the map: only the initial key survives a full truncation", () => {
    const saved = new Map<string, unknown>([
      ["__puck_changelog_initial__", "v0"],
      ["h1", "v1"],
    ]);

    _pruneSnapshots(saved, new Set());

    expect([...saved.keys()]).toEqual(["__puck_changelog_initial__"]);
  });
});
