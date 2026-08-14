"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createUsePuck, Render } from "@puckeditor/core";
import type { Config, Data, Metadata, UiState } from "@puckeditor/core";
import type { BrandTokens } from "../tokens";
import {
  useTargetBreakpoint,
  VIEWPORT_PRESETS,
  type ViewportPresetKey,
} from "./field";

/**
 * The ARTBOARD MATRIX (Phase 2 step 3): while the Admiral edits ONE
 * breakpoint in Puck's canvas, ArtboardRail shows the OTHER two as live
 * read-only companions. Each companion is a real srcdoc iframe at the
 * breakpoint's true width — native media queries fire for real — scaled
 * down with a CSS transform, fed <Render> through a portal (the same
 * mechanism as core's AutoFrame, rebuilt in userland: nothing private is
 * imported). Clicking a companion focuses that breakpoint via the exact
 * setUi payload a ViewportBar pill dispatches.
 */

const usePuck = createUsePuck();

const MIRROR_ATTR = "data-oc-artboard-mirror";

const FRAME_SRCDOC =
  '<!DOCTYPE html><html><head></head><body><div id="frame-root"></div></body></html>';

// ── helpers ────────────────────────────────────────────────────────────────

/**
 * Clone every non-empty <style> and <link rel=stylesheet> from a document's
 * head — the host's styles, so companions render with the host's CSS.
 * Link clones are deduped by href; every clone is marked with
 * data-oc-artboard-mirror="1" so a caller can clear previous mirrors from
 * the target head before appending (idempotent across StrictMode's double
 * mount — the CALLER clears, this function never mutates the source head).
 */
export function collectHostHeadStyles(doc: Document): HTMLElement[] {
  const clones: HTMLElement[] = [];
  const seenHrefs = new Set<string>();
  doc.head
    .querySelectorAll<HTMLElement>('style, link[rel="stylesheet"]')
    .forEach((el) => {
      if (el.hasAttribute(MIRROR_ATTR)) return; // never mirror a mirror
      if (el.tagName === "STYLE" && !el.innerHTML.trim()) return;
      if (el.tagName === "LINK") {
        const href = (el as HTMLLinkElement).href;
        if (!href || seenHrefs.has(href)) return;
        seenHrefs.add(href);
      }
      const clone = el.cloneNode(true) as HTMLElement;
      clone.setAttribute(MIRROR_ATTR, "1");
      clones.push(clone);
    });
  return clones;
}

/** Fit a bpWidth-wide artboard into a colWidth column: never upscale. */
export function artboardScale(colWidth: number, bpWidth: number): number {
  if (bpWidth <= 0) return 1;
  return Math.min(1, Math.max(0, colWidth / bpWidth));
}

/**
 * Trailing debounce: returns the last value that has been stable for `ms`.
 * Bumping `flushSignal` (any change) adopts the CURRENT value immediately —
 * the rail bumps it on undo/redo so time-travel lands without the lag.
 */
export function useDebouncedValue<T>(value: T, ms: number, flushSignal = 0): T {
  const [debounced, setDebounced] = useState(value);
  const flushRef = useRef(flushSignal);
  useEffect(() => {
    if (flushRef.current !== flushSignal) {
      flushRef.current = flushSignal;
      setDebounced(value);
      return;
    }
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms, flushSignal]);
  return debounced;
}

/** class + data-* only: theme carriers, never id/style/lang plumbing. */
function copyThemeAttributes(source: Element, target: Element): void {
  Array.from(source.attributes).forEach((attr) => {
    if (attr.name === "class" || attr.name.startsWith("data-")) {
      target.setAttribute(attr.name, attr.value);
    }
  });
}

/** The FULL viewports object — setUi shallow-merges top-level UiState keys,
 *  so the payload mirrors ViewportBar's pill dispatch exactly. */
const viewportUi =
  (width: number) =>
  (prev: UiState): Partial<UiState> => ({
    viewports: {
      ...prev.viewports,
      current: { width, height: "auto" },
    },
  });

// ── CompanionFrame ─────────────────────────────────────────────────────────

export type CompanionFrameProps = {
  /** the breakpoint's true width — the iframe's layout width in px */
  width: number;
  label: string;
  /** CSS transform scale fitting the frame into its column */
  scale: number;
  config: Config;
  data: Partial<Data>;
  metadata?: Metadata;
  /** click anywhere on the wrapper → focus this breakpoint */
  onFocus: () => void;
  /** TEST SEAM: portal target instead of the srcdoc iframe's frame-root
   *  (jsdom never loads srcdoc). When provided, the onLoad path is skipped. */
  getMountNode?: () => HTMLElement | null;
};

export function CompanionFrame({
  width,
  label,
  scale,
  config,
  data,
  metadata,
  onFocus,
  getMountNode,
}: CompanionFrameProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (getMountNode) setMountNode(getMountNode());
  }, [getMountNode]);

  const onFrameLoad = (): void => {
    const frameDoc = frameRef.current?.contentDocument;
    if (!frameDoc) return;
    // theme carriers (class + data-*) from the host's html/body
    copyThemeAttributes(document.documentElement, frameDoc.documentElement);
    copyThemeAttributes(document.body, frameDoc.body);
    // clear previous mirrors (StrictMode double mount), then mirror afresh
    frameDoc.head
      .querySelectorAll(`[${MIRROR_ATTR}]`)
      .forEach((node) => node.remove());
    frameDoc.head.append(...collectHostHeadStyles(document));
    setMountNode(frameDoc.getElementById("frame-root"));
  };

  // Height: track frame-root's scrollHeight into the iframe's own height so
  // the scaled artboard shows the whole page. |Δ| ≤ 1px is ignored — the
  // resize itself can nudge scrollHeight and feed back forever otherwise.
  useEffect(() => {
    if (!mountNode || getMountNode) return;
    const iframe = frameRef.current;
    if (!iframe) return;
    const RO =
      mountNode.ownerDocument.defaultView?.ResizeObserver ??
      (typeof ResizeObserver !== "undefined" ? ResizeObserver : undefined);
    if (!RO) return;
    let applied = 0;
    const sync = () => {
      const next = mountNode.scrollHeight;
      if (Math.abs(next - applied) > 1) {
        applied = next;
        iframe.style.height = `${next}px`;
      }
    };
    const observer = new RO(sync);
    observer.observe(mountNode);
    sync();
    return () => observer.disconnect();
  }, [mountNode, getMountNode]);

  return (
    <div
      onClick={onFocus}
      style={{
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 10,
          color: "var(--puck-color-grey-05, #9a8fae)",
          marginBottom: 4,
          whiteSpace: "nowrap",
        }}
      >
        {label} {width} — click to edit
      </div>
      <iframe
        ref={frameRef}
        title={`${label} artboard`}
        tabIndex={-1}
        srcDoc={FRAME_SRCDOC}
        onLoad={getMountNode ? undefined : onFrameLoad}
        style={{
          width: `${width}px`,
          border: 0,
          pointerEvents: "none",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
      {mountNode &&
        createPortal(
          <Render config={config} data={data} metadata={metadata} />,
          mountNode
        )}
    </div>
  );
}

// ── ArtboardRail ───────────────────────────────────────────────────────────

/** Structural slice of @pacsarcade/puck-changelog's Changelog — origin is
 *  all the rail reads. ChangeRecord.blockIds deliberately unused in v0.1 —
 *  no consumer yet. */
export type ArtboardLog = {
  subscribe(fn: (rec: { origin: string }) => void): () => void;
};

const RAIL_GAP = 10;

export function ArtboardRail({
  tokens,
  height = 320,
  log,
  getMountNode,
}: {
  tokens: BrandTokens;
  height?: number;
  log?: ArtboardLog;
  /** TEST SEAM: per-preset portal targets, forwarded to CompanionFrame */
  getMountNode?: (key: ViewportPresetKey) => HTMLElement | null;
}) {
  const config = usePuck((s) => s.config);
  const data = usePuck((s) => s.appState.data);
  const viewportWidth = usePuck(
    (s) => s.appState.ui.viewports.current.width
  ) as number | "100%";
  const dispatch = usePuck((s) => s.dispatch);

  // The breakpoint under edit; companions are the other two presets.
  const activeKey: ViewportPresetKey = useTargetBreakpoint(tokens) ?? "phone";
  const companions = VIEWPORT_PRESETS.filter((p) => p.key !== activeKey);

  // Mount: a "100%" viewport has no width, so "active" would be ambiguous —
  // pin it to the Phone preset once.
  useEffect(() => {
    if (typeof viewportWidth !== "number") {
      dispatch({ type: "setUi", ui: viewportUi(VIEWPORT_PRESETS[0].width) });
    }
    // mount-only: reads the INITIAL width by design
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Data feed: debounced so keystrokes don't re-render two artboards each,
  // flushed instantly on undo/redo via the changelog's origin stream.
  const [flushCounter, setFlushCounter] = useState(0);
  useEffect(() => {
    if (!log) return;
    return log.subscribe((rec) => {
      if (rec.origin === "undo" || rec.origin === "redo") {
        setFlushCounter((c) => c + 1);
      }
    });
  }, [log]);
  const feedData = useDebouncedValue(data, 300, flushCounter);

  // Pane width → column width → per-preset scale.
  const railRef = useRef<HTMLDivElement | null>(null);
  const [paneWidth, setPaneWidth] = useState(0);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const measure = () => setPaneWidth(rail.clientWidth);
    if (typeof ResizeObserver === "undefined") {
      measure();
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    measure();
    return () => observer.disconnect();
  }, []);
  const colWidth = Math.max(0, (paneWidth - RAIL_GAP) / 2);

  return (
    <div
      ref={railRef}
      style={{
        display: "flex",
        gap: RAIL_GAP,
        height,
        overflow: "hidden",
        background: "transparent",
      }}
    >
      {companions.map((preset) => (
        <CompanionFrame
          key={preset.key}
          width={preset.width}
          label={preset.label}
          scale={artboardScale(colWidth, preset.width)}
          config={config}
          data={feedData}
          onFocus={() =>
            dispatch({ type: "setUi", ui: viewportUi(preset.width) })
          }
          getMountNode={getMountNode && (() => getMountNode(preset.key))}
        />
      ))}
    </div>
  );
}
