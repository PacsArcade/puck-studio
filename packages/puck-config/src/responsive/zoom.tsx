"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { artboardScale } from "./artboards";

/**
 * Canvas zoom (STUDIO RESPONSIVE batch): the mat + scaled-artboard pair
 * that replicates core's own Canvas mechanism — a wrapper carrying
 * `transform: scale(zoom)` whose height is compensated by `/ zoom`
 * (core: Canvas root height = zoomConfig.rootHeight = viewportHeight /
 * zoom) — rebuilt in userland so the HOST owns the zoom state:
 *
 *  - useCanvasZoom  — fit-vs-manual zoom state; fitZoom reuses the
 *    artboardScale primitive (never redeclared) via a ResizeObserver on
 *    the host's column element;
 *  - CanvasZoomer   — the mat (flex-centered, iframe stays the SOLE
 *    vertical scroller) + gesture surface (ctrl/cmd+wheel, touch pinch);
 *  - ZoomControls   — the floating pill cluster (host positions it);
 *  - FrameScrollbarStyles — house scrollbars inside iframe#preview-frame.
 *
 * External scaling is dnd-safe by core's own design: lib/dnd/
 * frame-pointer.ts measures the frame's real scale via
 * getBoundingClientRect().width / contentWindow.innerWidth at pointer
 * time, so a transform on an ancestor is always accounted for.
 */

// ── zoom math (pure, exported for tests) ───────────────────────────────────

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 2;

/** every zoom in the system passes through this: [0.25, 2]; junk → 1. */
export const clampZoom = (z: number): number =>
  Number.isFinite(z) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) : 1;

/** fit zoom = the artboardScale primitive over the measured column;
 *  an unmeasured column (0 width) means "no verdict yet" → 1. */
export const fitZoomFor = (colWidth: number, viewportWidth: number): number =>
  colWidth > 0 ? clampZoom(artboardScale(colWidth, viewportWidth)) : 1;

/** multiplicative wheel step: ×1.05 per notch, direction by deltaY sign
 *  (deltaY < 0 = wheel up = zoom in). deltaY 0 is a no-op. */
export const ZOOM_WHEEL_STEP = 1.05;
export const stepZoom = (current: number, deltaY: number): number => {
  if (deltaY === 0) return clampZoom(current);
  return clampZoom(
    deltaY < 0 ? current * ZOOM_WHEEL_STEP : current / ZOOM_WHEEL_STEP
  );
};

/** pinch: zoom scales with the ratio of finger distances. */
export const pinchZoom = (
  startZoom: number,
  startDist: number,
  currentDist: number
): number =>
  startDist > 0 && Number.isFinite(currentDist) && currentDist > 0
    ? clampZoom(startZoom * (currentDist / startDist))
    : clampZoom(startZoom);

/** core's height-compensation law (Canvas root: viewportHeight / zoom):
 *  the wrapper is laid out TALLER by 1/zoom so that after scale(zoom) it
 *  visually fills the mat — the iframe inside keeps the full height and
 *  stays the sole vertical scroller. */
export const compensatedHeight = (matHeight: number, zoom: number): number =>
  zoom > 0 ? matHeight / zoom : matHeight;

// ── shared frame plumbing ──────────────────────────────────────────────────

const PREVIEW_FRAME_SELECTOR = "iframe#preview-frame";

const getPreviewFrame = (): HTMLIFrameElement | null =>
  typeof document === "undefined"
    ? null
    : document.querySelector<HTMLIFrameElement>(PREVIEW_FRAME_SELECTOR);

/** TRUE while a Puck drag is in flight — core sets data-puck-dragging on
 *  the [data-puck-entry] element (DragDropContext dragstart) and removes
 *  it on dragend, in whichever document the entry lives. */
const isPuckDragActive = (): boolean => {
  if (typeof document === "undefined") return false;
  if (document.querySelector("[data-puck-dragging]")) return true;
  try {
    return Boolean(
      getPreviewFrame()?.contentDocument?.querySelector("[data-puck-dragging]")
    );
  } catch {
    return false; // cross-origin frame — no drag we could see anyway
  }
};

// ── useCanvasZoom ──────────────────────────────────────────────────────────

export type CanvasZoomApi = {
  mode: "fit" | "manual";
  /** the zoom in force: fitZoom while mode === "fit", else the manual one */
  zoom: number;
  /** what "Fit" would give right now (live via ResizeObserver) */
  fitZoom: number;
  /** clamp + switch to manual */
  setZoom: (z: number) => void;
  /** back to fit mode (fitZoom keeps tracking the column) */
  fit: () => void;
};

/**
 * Zoom state for the studio canvas. `columnRef` is the host's canvas
 * column — fitZoom = artboardScale(columnWidth, viewportWidth), observed
 * live; a viewport-width change while mode === "fit" recomputes by
 * construction (fitZoom is derived, not stored).
 */
export function useCanvasZoom(
  viewportWidth: number,
  columnRef: RefObject<HTMLElement | null>
): CanvasZoomApi {
  const [mode, setMode] = useState<"fit" | "manual">("fit");
  const [manualZoom, setManualZoom] = useState(1);
  const [colWidth, setColWidth] = useState(0);

  useEffect(() => {
    const el = columnRef.current;
    if (!el) return;
    const measure = () => setColWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [columnRef]);

  const fitZoom = fitZoomFor(colWidth, viewportWidth);
  const setZoom = useCallback((z: number): void => {
    setManualZoom(clampZoom(z));
    setMode("manual");
  }, []);
  const fit = useCallback((): void => setMode("fit"), []);

  return {
    mode,
    zoom: mode === "fit" ? fitZoom : manualZoom,
    fitZoom,
    setZoom,
    fit,
  };
}

// ── CanvasZoomer ───────────────────────────────────────────────────────────

export type CanvasZoomerProps = {
  /** the current viewport width in px (the artboard's layout width) */
  viewportWidth: number;
  /** the zoom in force (zoomApi.zoom) */
  zoom: number;
  /** absolute-zoom writer for gestures (ctrl/cmd+wheel, touch pinch) —
   *  hosts pass zoomApi.setZoom; omit for a gesture-less mat. */
  onZoom?: (z: number) => void;
  /** the host renders <Puck.Preview /> here — the iframe inside remains
   *  the SOLE vertical scroller. */
  children: ReactNode;
};

type PinchState = {
  startDist: number;
  startZoom: number;
  /** pointerIds captured on the mat (released on gesture end) */
  captured: number[];
  /** mat touch-action value to restore */
  prevTouchAction: string;
};

/**
 * The MAT: a flex-centering, vertically-non-scrolling ground holding ONE
 * inner wrapper at the viewport's true width, scaled with a CSS transform
 * (transformOrigin top center) and height-compensated by 1/zoom — core's
 * own Canvas mechanism, externalized. Horizontal overflow scrolls only
 * when the scaled artboard is wider than the mat.
 *
 * Gestures (when onZoom is given):
 *  - ctrl/cmd + wheel (trackpad pinch arrives as ctrl+wheel for free):
 *    non-passive, preventDefault, multiplicative step;
 *  - touch pinch via Pointer Events on the mat AND inside the preview
 *    iframe (post-load; in-frame coordinates are mapped through the
 *    frame's measured scale exactly like core's frame-pointer.ts).
 *    A pinch only engages on the second concurrent touch pointer with NO
 *    active drag (core marks drags with data-puck-dragging on the
 *    [data-puck-entry] element); touch-action locks to "none" on the mat
 *    only for the gesture's duration.
 */
export function CanvasZoomer({
  viewportWidth,
  zoom,
  onZoom,
  children,
}: CanvasZoomerProps) {
  const matRef = useRef<HTMLDivElement | null>(null);
  const [matSize, setMatSize] = useState({ width: 0, height: 0 });

  // live refs so the gesture effect never re-binds on zoom changes
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const onZoomRef = useRef(onZoom);
  onZoomRef.current = onZoom;

  // mat measurement (width → overflow-x decision, height → compensation)
  useEffect(() => {
    const mat = matRef.current;
    if (!mat) return;
    const measure = () =>
      setMatSize({ width: mat.clientWidth, height: mat.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(mat);
    return () => observer.disconnect();
  }, []);

  // gestures — one stable effect, state in refs
  const hasGestures = Boolean(onZoom);
  useEffect(() => {
    const mat = matRef.current;
    if (!mat || !hasGestures) return;

    // (a) ctrl/cmd + wheel — non-passive so preventDefault sticks
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      onZoomRef.current?.(stepZoom(zoomRef.current, e.deltaY));
    };
    mat.addEventListener("wheel", onWheel, { passive: false });

    // (b) touch pinch — Pointer Events, mat + (post-load) frame document
    const points = new Map<number, { x: number; y: number }>();
    let pinch: PinchState | null = null;

    /** top-window coordinates for a pointer event, mapping in-frame
     *  events through the frame's measured scale (frame-pointer.ts law:
     *  rect.width / contentWindow.innerWidth). */
    const toTopPoint = (e: PointerEvent): { x: number; y: number } | null => {
      const x = e.clientX;
      const y = e.clientY;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      const frame = getPreviewFrame();
      const targetDoc = (e.target as Node | null)?.ownerDocument;
      if (frame && targetDoc && targetDoc === frame.contentDocument) {
        const rect = frame.getBoundingClientRect();
        const scale = rect.width / (frame.contentWindow?.innerWidth || 1);
        const s = scale > 0 ? scale : 1;
        return { x: rect.left + x * s, y: rect.top + y * s };
      }
      return { x, y };
    };

    const dist = (): number => {
      const [a, b] = Array.from(points.values());
      if (!a || !b) return 0;
      return Math.hypot(b.x - a.x, b.y - a.y);
    };

    const endPinch = (): void => {
      if (!pinch) return;
      mat.style.touchAction = pinch.prevTouchAction;
      pinch.captured.forEach((id) => {
        try {
          mat.releasePointerCapture?.(id);
        } catch {
          /* pointer already gone */
        }
      });
      pinch = null;
    };

    const onPointerDown = (e: PointerEvent): void => {
      if (e.pointerType !== "touch") return;
      const p = toTopPoint(e);
      if (!p) return;
      points.set(e.pointerId, p);
      if (points.size !== 2 || pinch) return;
      if (isPuckDragActive()) return; // a drag owns these pointers
      const startDist = dist();
      if (!(startDist > 0)) return;
      const captured: number[] = [];
      // capture only mat-originated pointers (cross-document capture
      // is not a thing); in-frame pointers keep flowing via the frame
      // document's own listeners.
      if ((e.target as Node | null)?.ownerDocument === mat.ownerDocument) {
        try {
          mat.setPointerCapture?.(e.pointerId);
          captured.push(e.pointerId);
        } catch {
          /* capture unsupported — moves still arrive via listeners */
        }
      }
      pinch = {
        startDist,
        startZoom: zoomRef.current,
        captured,
        prevTouchAction: mat.style.touchAction || "",
      };
      mat.style.touchAction = "none";
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (!pinch || !points.has(e.pointerId)) return;
      const p = toTopPoint(e);
      if (!p) return;
      points.set(e.pointerId, p);
      if (isPuckDragActive()) {
        endPinch(); // a drag started mid-gesture — stand down
        return;
      }
      const d = dist();
      if (!(d > 0)) return;
      onZoomRef.current?.(pinchZoom(pinch.startZoom, pinch.startDist, d));
    };

    const onPointerEnd = (e: PointerEvent): void => {
      points.delete(e.pointerId);
      if (points.size < 2) endPinch();
    };

    const addPointerListeners = (t: EventTarget): void => {
      t.addEventListener("pointerdown", onPointerDown as EventListener);
      t.addEventListener("pointermove", onPointerMove as EventListener);
      t.addEventListener("pointerup", onPointerEnd as EventListener);
      t.addEventListener("pointercancel", onPointerEnd as EventListener);
    };
    const removePointerListeners = (t: EventTarget): void => {
      t.removeEventListener("pointerdown", onPointerDown as EventListener);
      t.removeEventListener("pointermove", onPointerMove as EventListener);
      t.removeEventListener("pointerup", onPointerEnd as EventListener);
      t.removeEventListener("pointercancel", onPointerEnd as EventListener);
    };

    addPointerListeners(mat);

    // in-frame attachment: the frame loads (and AutoFrame can remount)
    // after us, so re-check identity on frame load + a slow poll.
    let attachedDoc: Document | null = null;
    const attachFrameDoc = (): void => {
      let doc: Document | null = null;
      try {
        doc = getPreviewFrame()?.contentDocument ?? null;
      } catch {
        doc = null; // cross-origin — mat-only pinch
      }
      if (doc === attachedDoc) return;
      if (attachedDoc) removePointerListeners(attachedDoc);
      attachedDoc = doc;
      if (doc) addPointerListeners(doc);
    };
    attachFrameDoc();
    const frameEl = getPreviewFrame();
    frameEl?.addEventListener("load", attachFrameDoc);
    const framePoll = setInterval(attachFrameDoc, 1000);

    return () => {
      endPinch();
      mat.removeEventListener("wheel", onWheel);
      removePointerListeners(mat);
      if (attachedDoc) removePointerListeners(attachedDoc);
      frameEl?.removeEventListener("load", attachFrameDoc);
      clearInterval(framePoll);
    };
  }, [hasGestures]);

  const scaledWidth = viewportWidth * zoom;
  const overflowX: "auto" | "hidden" =
    matSize.width > 0 && scaledWidth > matSize.width + 1 ? "auto" : "hidden";

  return (
    <div
      ref={matRef}
      data-oc-zoom-mat
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        overflowY: "hidden",
        overflowX,
        background: "transparent",
        width: "100%",
        height: "100%",
      }}
    >
      <div
        data-oc-zoom-artboard
        style={{
          width: viewportWidth,
          flexShrink: 0,
          height:
            matSize.height > 0
              ? compensatedHeight(matSize.height, zoom)
              : "100%",
          transform: `scale(${zoom})`,
          transformOrigin: "top center",
          // subtle artboard ring — where the page ends and the mat begins
          boxShadow: "0 0 0 1px rgba(139,118,196,.18)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── ZoomControls ───────────────────────────────────────────────────────────

const ZOOM_PRESETS = [0.5, 0.75, 1] as const;

const CONTROL_PILL: React.CSSProperties = {
  border: "none",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 11,
  lineHeight: 1,
  cursor: "pointer",
  background: "transparent",
  color: "var(--puck-color-text-muted, #9a8fae)",
};

const CONTROL_PILL_ACTIVE: React.CSSProperties = {
  ...CONTROL_PILL,
  cursor: "default",
  fontWeight: 700,
  background: "var(--puck-color-interactive-soft, rgba(139,118,196,.22))",
  color: "var(--puck-color-text, #e9e3fa)",
};

/**
 * The floating zoom pill cluster: Fit · 50 · 75 · 100 · readout %.
 * A PLAIN component — the HOST positions it (no fixed positioning here).
 */
export function ZoomControls({ zoomApi }: { zoomApi: CanvasZoomApi }) {
  const { mode, zoom, setZoom, fit } = zoomApi;
  const presetActive = (p: number): boolean =>
    mode === "manual" && Math.abs(zoom - p) < 0.001;
  return (
    <div
      data-oc-zoom-controls
      role="group"
      aria-label="canvas zoom"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        padding: 3,
        borderRadius: 999,
        background: "rgba(18,16,31,.88)",
        border: "1px solid rgba(139,118,196,.45)",
        boxShadow: "0 10px 24px -12px rgba(0,0,0,.6)",
        backdropFilter: "blur(6px)",
      }}
    >
      <button
        type="button"
        onClick={fit}
        aria-pressed={mode === "fit"}
        style={mode === "fit" ? CONTROL_PILL_ACTIVE : CONTROL_PILL}
      >
        Fit
      </button>
      {ZOOM_PRESETS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => setZoom(p)}
          aria-pressed={presetActive(p)}
          style={presetActive(p) ? CONTROL_PILL_ACTIVE : CONTROL_PILL}
        >
          {Math.round(p * 100)}
        </button>
      ))}
      <span
        aria-live="polite"
        style={{
          padding: "4px 8px",
          fontSize: 11,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          color: "var(--puck-color-text-muted, #9a8fae)",
        }}
      >
        {Math.round(zoom * 100)}%
      </span>
    </div>
  );
}

// ── FrameScrollbarStyles ───────────────────────────────────────────────────

export const FRAME_SCROLLBAR_STYLE_ATTR = "data-oc-frame-scrollbars";

/** unscoped on purpose — it lives INSIDE the preview frame's document. */
export const FRAME_SCROLLBAR_CSS = [
  "::-webkit-scrollbar{width:10px}",
  "::-webkit-scrollbar-thumb{background:rgba(139,118,196,.35);border-radius:8px}",
  "::-webkit-scrollbar-track{background:transparent}",
  "::-webkit-scrollbar-button{display:none}",
  "html{scrollbar-width:thin;scrollbar-color:rgba(139,118,196,.35) transparent}",
].join("\n");

/** idempotent: one <style data-oc-frame-scrollbars> per document, ever. */
export function injectFrameScrollbarStyles(doc: Document): void {
  if (!doc.head) return;
  if (doc.head.querySelector(`style[${FRAME_SCROLLBAR_STYLE_ATTR}]`)) return;
  const style = doc.createElement("style");
  style.setAttribute(FRAME_SCROLLBAR_STYLE_ATTR, "1");
  style.textContent = FRAME_SCROLLBAR_CSS;
  doc.head.appendChild(style);
}

/**
 * Effect component: house scrollbars inside iframe#preview-frame
 * (same-origin srcdoc). Injection re-runs on frame load and on a slow
 * poll (AutoFrame can remount the document), and is idempotent per
 * document. `getDoc` is the test seam — CompanionFrame's getMountNode
 * pattern (jsdom never loads srcdoc).
 */
export function FrameScrollbarStyles({
  getDoc,
}: {
  /** TEST SEAM: resolve the target document directly */
  getDoc?: () => Document | null;
}) {
  useEffect(() => {
    const resolve =
      getDoc ??
      ((): Document | null => {
        try {
          return getPreviewFrame()?.contentDocument ?? null;
        } catch {
          return null; // cross-origin — nothing to style
        }
      });
    const inject = (): void => {
      const doc = resolve();
      if (doc) injectFrameScrollbarStyles(doc);
    };
    inject();
    if (getDoc) return; // seam mode: the test drives re-runs
    const frameEl = getPreviewFrame();
    frameEl?.addEventListener("load", inject);
    const poll = setInterval(inject, 1000);
    return () => {
      frameEl?.removeEventListener("load", inject);
      clearInterval(poll);
    };
  }, [getDoc]);
  return null;
}
