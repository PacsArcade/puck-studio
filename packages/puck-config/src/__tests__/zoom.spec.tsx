import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { useRef } from "react";

/**
 * Canvas zoom specs (STUDIO RESPONSIVE batch). The math is pure and
 * tested directly; CanvasZoomer's gesture layer is exercised through
 * real DOM events on the mat (jsdom has no PointerEvent constructor, so
 * pinch events are plain Events carrying the pointer fields — the
 * handlers only read properties, never instanceof). FrameScrollbarStyles
 * goes through its getDoc seam, CompanionFrame's getMountNode pattern.
 */

import {
  CanvasZoomer,
  clampZoom,
  compensatedHeight,
  fitZoomFor,
  FRAME_SCROLLBAR_CSS,
  FRAME_SCROLLBAR_STYLE_ATTR,
  FrameScrollbarStyles,
  injectFrameScrollbarStyles,
  pinchZoom,
  stepZoom,
  useCanvasZoom,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_WHEEL_STEP,
  ZoomControls,
} from "../responsive";

afterEach(() => {
  cleanup();
  document.body
    .querySelectorAll("[data-puck-dragging]")
    .forEach((el) => el.remove());
});

// ── pure math ──────────────────────────────────────────────────────────────

describe("clampZoom", () => {
  it("clamps into [0.25, 2] and maps junk to 1", () => {
    expect(clampZoom(0.1)).toBe(ZOOM_MIN);
    expect(clampZoom(5)).toBe(ZOOM_MAX);
    expect(clampZoom(0.75)).toBe(0.75);
    expect(clampZoom(NaN)).toBe(1);
    expect(clampZoom(Infinity)).toBe(1);
  });
});

describe("fitZoomFor", () => {
  it("is artboardScale over the measured column, clamped", () => {
    expect(fitZoomFor(640, 1280)).toBe(0.5); // scale down to fit
    expect(fitZoomFor(2000, 1280)).toBe(1); // NEVER upscale
    expect(fitZoomFor(100, 1280)).toBe(ZOOM_MIN); // clamp floor
  });

  it("returns 1 for an unmeasured (0-width) column", () => {
    expect(fitZoomFor(0, 1280)).toBe(1);
  });
});

describe("compensatedHeight", () => {
  it("applies core's rootHeight law: matHeight / zoom", () => {
    expect(compensatedHeight(800, 0.5)).toBe(1600);
    expect(compensatedHeight(800, 2)).toBe(400);
    expect(compensatedHeight(800, 1)).toBe(800);
  });

  it("guards zoom <= 0", () => {
    expect(compensatedHeight(800, 0)).toBe(800);
  });
});

describe("stepZoom", () => {
  it("zooms IN on wheel-up (deltaY < 0), OUT on wheel-down", () => {
    expect(stepZoom(1, -100)).toBeCloseTo(ZOOM_WHEEL_STEP);
    expect(stepZoom(1, 100)).toBeCloseTo(1 / ZOOM_WHEEL_STEP);
    expect(stepZoom(1, 0)).toBe(1);
  });

  it("clamps at both rails", () => {
    expect(stepZoom(ZOOM_MAX, -100)).toBe(ZOOM_MAX);
    expect(stepZoom(ZOOM_MIN, 100)).toBe(ZOOM_MIN);
  });
});

describe("pinchZoom", () => {
  it("scales zoom by the finger-distance ratio, clamped", () => {
    expect(pinchZoom(0.5, 100, 200)).toBe(1);
    expect(pinchZoom(1, 200, 100)).toBe(0.5);
    expect(pinchZoom(1, 100, 1000)).toBe(ZOOM_MAX);
  });

  it("degenerate distances change nothing", () => {
    expect(pinchZoom(0.8, 0, 100)).toBe(0.8);
    expect(pinchZoom(0.8, 100, 0)).toBe(0.8);
    expect(pinchZoom(0.8, 100, NaN)).toBe(0.8);
  });
});

// ── useCanvasZoom ──────────────────────────────────────────────────────────

describe("useCanvasZoom", () => {
  const setup = (viewportWidth: number) =>
    renderHook(
      ({ w }: { w: number }) => {
        // jsdom clientWidth is 0 → colWidth stays unmeasured → fitZoom 1
        const columnRef = useRef<HTMLElement | null>(null);
        return useCanvasZoom(w, columnRef);
      },
      { initialProps: { w: viewportWidth } }
    );

  it("starts in fit mode with the live fitZoom", () => {
    const { result } = setup(1280);
    expect(result.current.mode).toBe("fit");
    expect(result.current.zoom).toBe(result.current.fitZoom);
  });

  it("setZoom clamps and switches to manual; fit() returns to fit", () => {
    const { result } = setup(1280);
    act(() => result.current.setZoom(0.5));
    expect(result.current.mode).toBe("manual");
    expect(result.current.zoom).toBe(0.5);

    act(() => result.current.setZoom(9));
    expect(result.current.zoom).toBe(ZOOM_MAX);
    act(() => result.current.setZoom(0.01));
    expect(result.current.zoom).toBe(ZOOM_MIN);

    act(() => result.current.fit());
    expect(result.current.mode).toBe("fit");
    expect(result.current.zoom).toBe(result.current.fitZoom);
  });

  it("a viewport width change while manual keeps the manual zoom", () => {
    const { result, rerender } = setup(1280);
    act(() => result.current.setZoom(0.75));
    rerender({ w: 390 });
    expect(result.current.mode).toBe("manual");
    expect(result.current.zoom).toBe(0.75);
  });
});

// ── CanvasZoomer ───────────────────────────────────────────────────────────

const getMat = (container: HTMLElement): HTMLElement => {
  const mat = container.querySelector<HTMLElement>("[data-oc-zoom-mat]");
  if (!mat) throw new Error("mat not rendered");
  return mat;
};

describe("CanvasZoomer", () => {
  it("renders the artboard at the viewport width, scaled, ringed", () => {
    const { container } = render(
      <CanvasZoomer viewportWidth={820} zoom={0.75}>
        <div>page</div>
      </CanvasZoomer>
    );
    const artboard = container.querySelector<HTMLElement>(
      "[data-oc-zoom-artboard]"
    );
    expect(artboard).toBeTruthy();
    expect(artboard!.style.width).toBe("820px");
    expect(artboard!.style.transform).toBe("scale(0.75)");
    expect(artboard!.style.transformOrigin).toBe("top center");
    expect(artboard!.style.boxShadow).toContain("rgba(139,118,196,.18)");
    // the mat never scrolls vertically — the iframe stays the scroller
    expect(getMat(container).style.overflowY).toBe("hidden");
  });

  it("ctrl+wheel steps zoom (direction by deltaY) and preventDefaults", () => {
    const onZoom = jest.fn();
    const { container } = render(
      <CanvasZoomer viewportWidth={820} zoom={1} onZoom={onZoom}>
        <div />
      </CanvasZoomer>
    );
    const mat = getMat(container);

    const wheelIn = new WheelEvent("wheel", {
      ctrlKey: true,
      deltaY: -100,
      bubbles: true,
      cancelable: true,
    });
    mat.dispatchEvent(wheelIn);
    expect(wheelIn.defaultPrevented).toBe(true);
    expect(onZoom).toHaveBeenLastCalledWith(stepZoom(1, -100));

    const wheelOut = new WheelEvent("wheel", {
      metaKey: true,
      deltaY: 100,
      bubbles: true,
      cancelable: true,
    });
    mat.dispatchEvent(wheelOut);
    expect(onZoom).toHaveBeenLastCalledWith(stepZoom(1, 100));
  });

  it("plain wheel (no ctrl/cmd) is left alone", () => {
    const onZoom = jest.fn();
    const { container } = render(
      <CanvasZoomer viewportWidth={820} zoom={1} onZoom={onZoom}>
        <div />
      </CanvasZoomer>
    );
    const wheel = new WheelEvent("wheel", {
      deltaY: -100,
      bubbles: true,
      cancelable: true,
    });
    getMat(container).dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
    expect(onZoom).not.toHaveBeenCalled();
  });

  /** jsdom has no PointerEvent — a plain Event carrying pointer fields
   *  exercises the same listeners (they only read properties). */
  const pointer = (
    target: EventTarget,
    type: string,
    fields: Record<string, unknown>
  ): void => {
    const e = new Event(type, { bubbles: true });
    Object.assign(e, { pointerType: "touch" }, fields);
    target.dispatchEvent(e);
  };

  it("two-finger pinch drives onZoom by the distance ratio", () => {
    const onZoom = jest.fn();
    const { container } = render(
      <CanvasZoomer viewportWidth={820} zoom={1} onZoom={onZoom}>
        <div />
      </CanvasZoomer>
    );
    const mat = getMat(container);
    pointer(mat, "pointerdown", { pointerId: 1, clientX: 0, clientY: 0 });
    pointer(mat, "pointerdown", { pointerId: 2, clientX: 100, clientY: 0 });
    // gesture engaged: touch-action locked on the mat
    expect(mat.style.touchAction).toBe("none");
    pointer(mat, "pointermove", { pointerId: 2, clientX: 200, clientY: 0 });
    expect(onZoom).toHaveBeenLastCalledWith(pinchZoom(1, 100, 200));
    // lifting a finger ends the gesture and restores touch-action
    pointer(mat, "pointerup", { pointerId: 2 });
    expect(mat.style.touchAction).toBe("");
  });

  it("bails when a Puck drag is active (data-puck-dragging present)", () => {
    const dragMarker = document.createElement("div");
    dragMarker.setAttribute("data-puck-dragging", "true");
    document.body.appendChild(dragMarker);

    const onZoom = jest.fn();
    const { container } = render(
      <CanvasZoomer viewportWidth={820} zoom={1} onZoom={onZoom}>
        <div />
      </CanvasZoomer>
    );
    const mat = getMat(container);
    pointer(mat, "pointerdown", { pointerId: 1, clientX: 0, clientY: 0 });
    pointer(mat, "pointerdown", { pointerId: 2, clientX: 100, clientY: 0 });
    expect(mat.style.touchAction || "").toBe(""); // never engaged
    pointer(mat, "pointermove", { pointerId: 2, clientX: 200, clientY: 0 });
    expect(onZoom).not.toHaveBeenCalled();
  });
});

// ── ZoomControls ───────────────────────────────────────────────────────────

describe("ZoomControls", () => {
  const api = (over: Partial<Parameters<typeof ZoomControls>[0]["zoomApi"]>) =>
    ({
      mode: "fit" as const,
      zoom: 1,
      fitZoom: 1,
      setZoom: jest.fn(),
      fit: jest.fn(),
      ...over,
    } as Parameters<typeof ZoomControls>[0]["zoomApi"]);

  it("renders the pill cluster with a % readout and wires the presets", () => {
    const zoomApi = api({ mode: "manual", zoom: 0.75 });
    const { getByText } = render(<ZoomControls zoomApi={zoomApi} />);
    expect(getByText("75%")).toBeInTheDocument();
    expect(getByText("75")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(getByText("50"));
    expect(zoomApi.setZoom).toHaveBeenCalledWith(0.5);
    fireEvent.click(getByText("Fit"));
    expect(zoomApi.fit).toHaveBeenCalled();
  });

  it("marks Fit active in fit mode", () => {
    const { getByText } = render(<ZoomControls zoomApi={api({})} />);
    expect(getByText("Fit")).toHaveAttribute("aria-pressed", "true");
  });
});

// ── FrameScrollbarStyles ───────────────────────────────────────────────────

describe("FrameScrollbarStyles", () => {
  const styleCount = (doc: Document): number =>
    doc.head.querySelectorAll(`style[${FRAME_SCROLLBAR_STYLE_ATTR}]`).length;

  it("injects the house scrollbar sheet once, idempotently (seam)", () => {
    const doc = document.implementation.createHTMLDocument("frame");
    const getDoc = () => doc;

    const { rerender, unmount } = render(
      <FrameScrollbarStyles getDoc={getDoc} />
    );
    expect(styleCount(doc)).toBe(1);

    // re-render + a second mount (frame reload path) stay idempotent
    rerender(<FrameScrollbarStyles getDoc={getDoc} />);
    injectFrameScrollbarStyles(doc);
    injectFrameScrollbarStyles(doc);
    expect(styleCount(doc)).toBe(1);

    const css = doc.head.querySelector(`style[${FRAME_SCROLLBAR_STYLE_ATTR}]`)!
      .textContent!;
    expect(css).toBe(FRAME_SCROLLBAR_CSS);
    expect(css).toContain("::-webkit-scrollbar");
    expect(css).toContain("scrollbar-width:thin");
    expect(css).toContain("rgba(139,118,196,.35)");
    unmount();
  });

  it("survives a null document (frame not up yet)", () => {
    expect(() =>
      render(<FrameScrollbarStyles getDoc={() => null} />)
    ).not.toThrow();
  });
});
