import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
} from "@testing-library/react";
import "@testing-library/jest-dom";

/**
 * Artboard matrix specs (Phase 2 step 3). No real srcdoc iframes — jsdom
 * never loads them — so ArtboardRail is exercised through the getMountNode
 * seam, with @puckeditor/core mocked (createUsePuck reads a plain state
 * object; Render becomes a marker div carrying its data).
 */

const mockDispatch = jest.fn();
let mockViewportWidth: number | "100%" = 390;
const mockPageData = { root: {}, content: [] };

jest.mock("@puckeditor/core", () => ({
  __esModule: true,
  createUsePuck:
    () =>
    <T,>(selector: (s: unknown) => T): T =>
      selector({
        config: { components: {} },
        dispatch: mockDispatch,
        appState: {
          data: mockPageData,
          ui: {
            viewports: {
              current: { width: mockViewportWidth, height: "auto" },
            },
          },
        },
      }),
  Render: () => <div data-testid="companion-render" />,
}));

import { STARTER } from "../tokens";
import {
  ArtboardRail,
  artboardScale,
  collectHostHeadStyles,
  useDebouncedValue,
  type ViewportPresetKey,
} from "../responsive";

// ── collectHostHeadStyles ──────────────────────────────────────────────────

describe("collectHostHeadStyles", () => {
  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("clones non-empty styles + stylesheet links, dedupes hrefs, marks clones", () => {
    document.head.innerHTML = [
      "<style>.a{color:red}</style>",
      "<style>   </style>", // empty — filtered
      '<link rel="stylesheet" href="/site.css" />',
      '<link rel="stylesheet" href="/site.css" />', // duplicate href — deduped
      '<link rel="stylesheet" href="/other.css" />',
      '<link rel="icon" href="/favicon.ico" />', // not a stylesheet
    ].join("");

    const clones = collectHostHeadStyles(document);

    expect(clones).toHaveLength(3);
    clones.forEach((clone) => {
      expect(clone.getAttribute("data-oc-artboard-mirror")).toBe("1");
    });
    const hrefs = clones
      .filter((clone) => clone.tagName === "LINK")
      .map((clone) => clone.getAttribute("href"));
    expect(hrefs).toEqual(["/site.css", "/other.css"]);
    // the SOURCE head is never mutated (no marks left behind)
    expect(
      document.head.querySelectorAll("[data-oc-artboard-mirror]")
    ).toHaveLength(0);
  });

  it("never re-mirrors a mirror, and stays idempotent when the target head is pre-cleared", () => {
    document.head.innerHTML = "<style>.a{color:red}</style>";
    const frameDoc = document.implementation.createHTMLDocument("frame");

    // first mount
    frameDoc.head.append(...collectHostHeadStyles(document));
    expect(frameDoc.head.querySelectorAll("style")).toHaveLength(1);

    // second mount (StrictMode): caller clears marked nodes, then re-appends
    frameDoc.head
      .querySelectorAll("[data-oc-artboard-mirror]")
      .forEach((node) => node.remove());
    frameDoc.head.append(...collectHostHeadStyles(document));
    expect(frameDoc.head.querySelectorAll("style")).toHaveLength(1);

    // and if a mirror somehow sat in the SOURCE head, it is skipped
    const stray = document.createElement("style");
    stray.innerHTML = ".stray{}";
    stray.setAttribute("data-oc-artboard-mirror", "1");
    document.head.append(stray);
    expect(collectHostHeadStyles(document)).toHaveLength(1);
  });
});

// ── artboardScale ──────────────────────────────────────────────────────────

describe("artboardScale", () => {
  it("divides column width by breakpoint width", () => {
    expect(artboardScale(640, 1280)).toBe(0.5);
    expect(artboardScale(410, 820)).toBe(0.5);
  });

  it("never upscales past 1 and never goes negative", () => {
    expect(artboardScale(2000, 1280)).toBe(1);
    expect(artboardScale(1280, 1280)).toBe(1);
    expect(artboardScale(0, 1280)).toBe(0);
    expect(artboardScale(-50, 1280)).toBe(0);
  });
});

// ── useDebouncedValue ──────────────────────────────────────────────────────

describe("useDebouncedValue", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const mount = () =>
    renderHook(
      ({ value, flush }: { value: string; flush: number }) =>
        useDebouncedValue(value, 300, flush),
      { initialProps: { value: "a", flush: 0 } }
    );

  it("trails: holds the old value until ms elapse", () => {
    const { result, rerender } = mount();
    rerender({ value: "b", flush: 0 });
    expect(result.current).toBe("a");
    act(() => jest.advanceTimersByTime(299));
    expect(result.current).toBe("a");
    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe("b");
  });

  it("collapses rapid changes to the last value", () => {
    const { result, rerender } = mount();
    rerender({ value: "b", flush: 0 });
    act(() => jest.advanceTimersByTime(200));
    rerender({ value: "c", flush: 0 });
    act(() => jest.advanceTimersByTime(200));
    expect(result.current).toBe("a"); // "b"'s timer was cancelled
    act(() => jest.advanceTimersByTime(100));
    expect(result.current).toBe("c");
  });

  it("bumping the flush signal adopts the current value immediately", () => {
    const { result, rerender } = mount();
    rerender({ value: "b", flush: 1 });
    expect(result.current).toBe("b"); // no timer advance needed
  });
});

// ── ArtboardRail ───────────────────────────────────────────────────────────

describe("ArtboardRail", () => {
  afterEach(() => {
    cleanup();
    mockDispatch.mockClear();
    mockViewportWidth = 390;
  });

  const seam = () => {
    const nodes: Record<ViewportPresetKey, HTMLElement> = {
      phone: document.createElement("div"),
      tablet: document.createElement("div"),
      desktop: document.createElement("div"),
    };
    return { nodes, getMountNode: (key: ViewportPresetKey) => nodes[key] };
  };

  /** the UiState slice a functional setUi updater receives */
  const prevUi = {
    viewports: {
      current: { width: 390 as number | "100%", height: "auto" },
      options: [{ width: 360, height: "auto" }],
      controlsVisible: true,
    },
  };

  it("renders the two non-active companions at viewport 390 (phone active)", () => {
    const { nodes, getMountNode } = seam();
    const { getByText, queryByText, container } = render(
      <ArtboardRail tokens={STARTER} getMountNode={getMountNode} />
    );

    getByText("Tablet 820 — click to edit");
    getByText("Desktop 1280 — click to edit");
    expect(queryByText(/Phone 390/)).toBeNull();

    const frames = container.querySelectorAll("iframe");
    expect(frames).toHaveLength(2);
    expect(frames[0].style.width).toBe("820px");
    expect(frames[1].style.width).toBe("1280px");
    expect(frames[0].title).toBe("Tablet artboard");
    expect(frames[0].style.pointerEvents).toBe("none");

    // the portals landed in the seam nodes — one live Render per companion
    expect(
      nodes.tablet.querySelector('[data-testid="companion-render"]')
    ).not.toBeNull();
    expect(
      nodes.desktop.querySelector('[data-testid="companion-render"]')
    ).not.toBeNull();
    expect(
      nodes.phone.querySelector('[data-testid="companion-render"]')
    ).toBeNull();

    // a well-defined numeric viewport dispatches nothing on mount
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("shows phone + desktop companions when tablet is active", () => {
    mockViewportWidth = 820;
    const { getMountNode } = seam();
    const { getByText, queryByText } = render(
      <ArtboardRail tokens={STARTER} getMountNode={getMountNode} />
    );
    getByText("Phone 390 — click to edit");
    getByText("Desktop 1280 — click to edit");
    expect(queryByText(/Tablet 820/)).toBeNull();
  });

  it("wrapper click dispatches the preset's FULL viewports setUi payload", () => {
    const { getMountNode } = seam();
    const { getByText } = render(
      <ArtboardRail tokens={STARTER} getMountNode={getMountNode} />
    );

    fireEvent.click(getByText("Tablet 820 — click to edit"));

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const action = mockDispatch.mock.calls[0][0];
    expect(action.type).toBe("setUi");
    // functional updater carries the WHOLE viewports object forward
    expect(action.ui(prevUi)).toEqual({
      viewports: {
        current: { width: 820, height: "auto" },
        options: [{ width: 360, height: "auto" }],
        controlsVisible: true,
      },
    });
  });

  it("pins an unmeasured '100%' viewport to the Phone preset on mount", () => {
    mockViewportWidth = "100%";
    const { getMountNode } = seam();
    render(<ArtboardRail tokens={STARTER} getMountNode={getMountNode} />);

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const action = mockDispatch.mock.calls[0][0];
    expect(action.type).toBe("setUi");
    expect(action.ui(prevUi).viewports.current).toEqual({
      width: 390,
      height: "auto",
    });
  });

  it("subscribes to the change log and unsubscribes on unmount", () => {
    const unsubscribe = jest.fn();
    const log = { subscribe: jest.fn(() => unsubscribe) };
    const { getMountNode } = seam();

    const { unmount } = render(
      <ArtboardRail tokens={STARTER} log={log} getMountNode={getMountNode} />
    );
    expect(log.subscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
