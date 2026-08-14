"use client";

import { useEffect, useRef, useState } from "react";
import { createUsePuck } from "@puckeditor/core";
import type { UiState } from "@puckeditor/core";
import {
  comboKey,
  definedAt,
  resolve,
  screenComboForWidth,
  type Provenance,
  type ProvenanceState,
  type VariantCombo,
} from "@pacsarcade/variant-engine";
import ColorField from "../color-field";
import { colorCss, type BrandTokens } from "../tokens";
import { styleProvenance } from "./provenance";
import {
  DEFAULT_STYLE,
  registryFor,
  type BreakpointKey,
  type StyleProps,
  type StyleVariants,
} from "./schema";

/**
 * The responsive editing surface (Phase 2 steps 2 + 4):
 *  - ViewportBar — three pills (Phone/Tablet/Desktop) driving Puck's own
 *    ui.viewports, so the iframe preview resizes and media queries fire
 *    for real;
 *  - useTargetBreakpoint — classifies the current viewport width against
 *    the brand's breakpoints: the TARGET a style edit writes to;
 *  - UnifiedStyleField — THE style field (Phase 2 step 4): one set of
 *    controls hosted on the `style` prop that routes writes to the base
 *    (its own onChange) or to the styleVariants sibling (a replace
 *    dispatch), with a provenance dot + popover per control that explains
 *    where every value comes from, offers the lawful clear, and jumps to
 *    the defining breakpoint;
 *  - PreviewSizer — a width-constrained container for iframe-less hosts.
 */

const usePuck = createUsePuck();

const useViewportWidth = (): number | "100%" =>
  usePuck((s) => s.appState.ui.viewports.current.width);

/**
 * The breakpoint a style edit targets right now: viewport width >=
 * desktopMin → "desktop", >= tabletMin → "tablet", else null = base.
 * A "100%" viewport has no known width — treated as base.
 */
export function useTargetBreakpoint(tokens: BrandTokens): BreakpointKey | null {
  const width = useViewportWidth();
  if (typeof width !== "number") return null;
  if (width >= tokens.breakpoints.desktopMin) return "desktop";
  if (width >= tokens.breakpoints.tabletMin) return "tablet";
  return null;
}

// ── ViewportBar ────────────────────────────────────────────────────────────

/** "phone" is the base (no breakpoint); tablet/desktop map to BreakpointKey. */
export type ViewportPresetKey = "phone" | BreakpointKey;

export type ViewportPreset = {
  key: ViewportPresetKey;
  label: string;
  width: number;
};

/** THE one definition of the three studio viewports — ViewportBar pills and
 *  the artboard rail both read this list; never redeclare it. */
export const VIEWPORT_PRESETS: ViewportPreset[] = [
  { key: "phone", label: "Phone", width: 390 },
  { key: "tablet", label: "Tablet", width: 820 },
  { key: "desktop", label: "Desktop", width: 1280 },
];

/** Three pills dispatching Puck's setUi with a FULL viewports object
 *  (setUi shallow-merges top-level UiState keys — mirror core's Canvas). */
export function ViewportBar() {
  const dispatch = usePuck((s) => s.dispatch);
  const current = useViewportWidth();
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {VIEWPORT_PRESETS.map((preset) => {
        const active = current === preset.width;
        return (
          <button
            key={preset.label}
            type="button"
            onClick={() =>
              dispatch({
                type: "setUi",
                ui: (prev: UiState): Partial<UiState> => ({
                  viewports: {
                    ...prev.viewports,
                    current: { width: preset.width, height: "auto" },
                  },
                }),
              })
            }
            style={{
              borderRadius: 999,
              padding: "4px 12px",
              fontSize: 12,
              cursor: active ? "default" : "pointer",
              border: active
                ? "1px solid var(--puck-color-azure-05, #3479ac)"
                : "1px solid var(--puck-color-grey-09, #c9c9c9)",
              background: active
                ? "var(--puck-color-azure-11, #e9f4fc)"
                : "transparent",
              fontWeight: active ? 700 : 400,
            }}
          >
            {preset.label} {preset.width}
          </button>
        );
      })}
    </div>
  );
}

// ── PreviewSizer ───────────────────────────────────────────────────────────

/** Centered width-constrained container tracking the current viewport. */
export function PreviewSizer({ children }: { children: React.ReactNode }) {
  const width = useViewportWidth();
  const px = typeof width === "number" ? `${width}px` : "100%";
  return (
    <div
      style={{ width: `min(100%, ${px})`, margin: "0 auto", height: "100%" }}
    >
      {children}
    </div>
  );
}

// ── ResponsiveStyleField ───────────────────────────────────────────────────

const ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};
const LABEL: React.CSSProperties = {
  fontSize: 11,
  width: 76,
  flexShrink: 0,
  color: "var(--puck-color-grey-04, #5a5a5a)",
};

function Dot({
  setHere,
  source,
  onClear,
}: {
  setHere: boolean;
  source: string;
  onClear: () => void;
}) {
  if (setHere) {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span
          title="set here"
          aria-label="set here"
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "var(--gold-2, #EBCB77)",
            flexShrink: 0,
          }}
        />
        <button
          type="button"
          title="clear this override"
          aria-label="clear this override"
          onClick={onClear}
          style={{
            border: "none",
            background: "none",
            cursor: "pointer",
            padding: 0,
            fontSize: 12,
            lineHeight: 1,
            color: "var(--puck-color-grey-04, #5a5a5a)",
          }}
        >
          ×
        </button>
      </span>
    );
  }
  return (
    <span
      title={`from ${source}`}
      aria-label={`from ${source}`}
      style={{ display: "flex", alignItems: "center", gap: 4 }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "var(--puck-color-grey-09, #c9c9c9)",
          flexShrink: 0,
        }}
      />
      <span
        style={{ fontSize: 9, color: "var(--puck-color-grey-05, #9a8fae)" }}
      >
        {source}
      </span>
    </span>
  );
}

/**
 * @deprecated Phase 2 step 4 — superseded by UnifiedStyleField, which
 * hosts the same controls on the `style` prop and writes styleVariants
 * through a sibling replace dispatch. Kept exported (unregistered) for
 * hosts that still mount it on a styleVariants custom field; the clear
 * law (delete the key, never write 0) is identical.
 */
export function ResponsiveStyleField({
  value,
  onChange,
  tokens,
}: {
  value: StyleVariants | undefined;
  onChange: (value: StyleVariants) => void;
  tokens: BrandTokens;
}) {
  const target = useTargetBreakpoint(tokens);
  const width = useViewportWidth();
  const selected = usePuck((s) => s.selectedItem);

  if (!target) {
    return (
      <div
        style={{
          fontSize: 12,
          lineHeight: 1.5,
          color: "var(--puck-color-grey-04, #5a5a5a)",
        }}
      >
        Editing the <b>base</b> (phone) style — use the Style field above.
        Switch the viewport to Tablet or Desktop to add screen overrides.
      </div>
    );
  }

  const reg = registryFor(tokens);
  const targetKey = comboKey(reg, [target]);
  const activeCombo =
    typeof width === "number" ? screenComboForWidth(reg, width) : [target];
  const base: StyleProps = {
    ...DEFAULT_STYLE,
    ...((selected?.props as { style?: Partial<StyleProps> } | undefined)
      ?.style ?? {}),
  };
  const settings: StyleVariants = value ?? {};
  const layer: Partial<StyleProps> = settings[targetKey] ?? {};
  const effective = resolve(reg, base, settings, activeCombo);

  const setProp = <K extends keyof StyleProps>(
    prop: K,
    v: StyleProps[K]
  ): void => {
    onChange({ ...settings, [targetKey]: { ...layer, [prop]: v } });
  };
  /** clear-override DELETES the key (never writes 0); empty layers drop. */
  const clearProp = (prop: keyof StyleProps): void => {
    const nextLayer = { ...layer };
    delete nextLayer[prop];
    const next: StyleVariants = { ...settings };
    if (Object.keys(nextLayer).length === 0) delete next[targetKey];
    else next[targetKey] = nextLayer;
    onChange(next);
  };

  const dot = (prop: keyof StyleProps): React.ReactNode => {
    const d = definedAt(reg, base, settings, [target], prop);
    return (
      <Dot
        setHere={d.state === "set" && d.source === targetKey}
        source={d.source}
        onClear={() => clearProp(prop)}
      />
    );
  };

  const bounds = tokens.type.bounds;
  const numberRow = (
    label: string,
    prop: "size" | "kerning" | "lineHeight" | "spaceAbove" | "spaceBelow",
    min: number,
    max: number,
    step = 1
  ): React.ReactNode => (
    <div style={ROW}>
      <span style={LABEL}>{label}</span>
      <input
        type="number"
        value={effective[prop]}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setProp(prop, Number(e.currentTarget.value))}
        style={{ width: 72 }}
      />
      {dot(prop)}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--puck-color-grey-05, #9a8fae)",
        }}
      >
        overrides at {target}
      </div>

      <div style={ROW}>
        <span style={LABEL}>Font</span>
        <select
          value={effective.font}
          onChange={(e) =>
            setProp("font", e.currentTarget.value as StyleProps["font"])
          }
          style={{ flexGrow: 1 }}
        >
          <option value="default">Default</option>
          {Object.entries(tokens.fonts).map(([key, f]) => (
            <option key={key} value={key}>
              {f.label}
            </option>
          ))}
        </select>
        {dot("font")}
      </div>

      {numberRow("Size", "size", 0, bounds.sizePx[1])}
      {numberRow(
        "Kerning",
        "kerning",
        bounds.kerningPx[0],
        bounds.kerningPx[1]
      )}
      {numberRow("Line height", "lineHeight", 0, bounds.lineHeight[1], 0.1)}

      <div style={{ ...ROW, alignItems: "flex-start" }}>
        <span style={{ ...LABEL, paddingTop: 4 }}>Colour</span>
        <div style={{ flexGrow: 1 }}>
          <ColorField
            value={effective.color}
            onChange={(v) => setProp("color", v)}
            tokens={tokens}
          />
        </div>
        {dot("color")}
      </div>

      {numberRow("Space above", "spaceAbove", 0, tokens.spacing.maxPx)}
      {numberRow("Space below", "spaceBelow", 0, tokens.spacing.maxPx)}
    </div>
  );
}

// ── UnifiedStyleField (Phase 2 step 4: the self-explaining inspector) ──────

/** provenance-state → dot paint. Filled = a real value exists somewhere in
 *  the block's data; outline-only = the value comes from a default. */
const DOT_PAINT: Record<
  ProvenanceState,
  { background: string; border: string }
> = {
  "set-here": {
    background: "var(--gold-2, #EBCB77)",
    border: "var(--gold-2, #EBCB77)",
  },
  override: { background: "#8B76C4", border: "#8B76C4" },
  base: {
    background: "var(--puck-color-grey-09, #c9c9c9)",
    border: "var(--puck-color-grey-09, #c9c9c9)",
  },
  "block-default": {
    background: "transparent",
    border: "var(--puck-color-grey-09, #c9c9c9)",
  },
  "brand-default": {
    background: "transparent",
    border: "rgba(139,118,196,.55)",
  },
};

const dotTitle = (prov: Provenance<StyleProps>): string => {
  switch (prov.state) {
    case "set-here":
      return "set here";
    case "override":
      return `from ${prov.source}`;
    case "base":
      return "from base";
    case "block-default":
      return "block default";
    case "brand-default":
      return "brand default";
  }
};

/** human name of a provenance source — what "reverts to …" and the source
 *  line print. */
const sourceLabel = (prov: Provenance<StyleProps>): string => {
  if (prov.state === "block-default") return "block default";
  if (prov.state === "brand-default") return "brand default";
  return prov.source === "base" ? "base" : prov.source;
};

/** display text for a value in the popover (null = nothing to show) */
const valueText = (
  prop: keyof StyleProps,
  v: StyleProps[keyof StyleProps] | undefined,
  tokens: BrandTokens
): string | null => {
  if (v === undefined) return null;
  if (prop === "font") {
    const key = String(v);
    return key === "default" ? "Default" : tokens.fonts[key]?.label ?? key;
  }
  if (prop === "color" || prop === "lineHeight") return String(v);
  return `${v}px`;
};

const POPOVER_CARD: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 4px)",
  zIndex: 10,
  minWidth: 200,
  background: "#12101f",
  border: "1px solid rgba(139,118,196,.45)",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 11,
  lineHeight: 1.5,
  color: "#cfc7e6",
  textAlign: "left",
  boxShadow: "0 12px 30px -12px rgba(0, 0, 0, .6)",
};

const POPOVER_LINK: React.CSSProperties = {
  border: "none",
  background: "none",
  padding: 0,
  font: "inherit",
  color: "#8B76C4",
  textDecoration: "underline",
  cursor: "pointer",
};

function ProvenancePopover({
  prov,
  prop,
  tokens,
  revertsTo,
  onClear,
  jumpLabel,
  onJump,
}: {
  prov: Provenance<StyleProps>;
  prop: keyof StyleProps;
  tokens: BrandTokens;
  /** what the value falls back to if cleared (set-here only) */
  revertsTo: string | null;
  onClear: () => void;
  /** breakpoint name the source line links to; null = not jumpable */
  jumpLabel: string | null;
  onJump: () => void;
}) {
  const name = sourceLabel(prov);
  const sourceNode =
    jumpLabel !== null ? (
      <button type="button" style={POPOVER_LINK} onClick={onJump}>
        {name}
      </button>
    ) : (
      <b style={{ color: "#e9e3fa" }}>{name}</b>
    );
  const text = valueText(prop, prov.value, tokens);
  const swatch =
    prop === "color" && typeof prov.value === "string"
      ? colorCss(tokens, prov.value)
      : undefined;

  return (
    <div
      role="dialog"
      aria-label={`where ${String(prop)} comes from`}
      style={POPOVER_CARD}
    >
      <div>
        {prov.state === "set-here" ? (
          <>Set at {sourceNode}</>
        ) : (
          <>From {sourceNode}</>
        )}
      </div>

      {text !== null && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 4,
            color: "#e9e3fa",
          }}
        >
          {swatch && (
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: swatch,
                border: "1px solid rgba(255, 255, 255, .25)",
                flexShrink: 0,
              }}
            />
          )}
          <span>{text}</span>
        </div>
      )}

      {prov.overriddenAbove.length > 0 && (
        <div style={{ marginTop: 6, color: "#9a8fae" }}>
          Also overridden at: {prov.overriddenAbove.join(", ")}
        </div>
      )}

      {prov.state === "set-here" && revertsTo !== null && (
        <button
          type="button"
          onClick={onClear}
          style={{
            marginTop: 8,
            width: "100%",
            borderRadius: 7,
            border: "1px solid rgba(139,118,196,.45)",
            background: "rgba(139,118,196,.14)",
            color: "#e9e3fa",
            fontSize: 11,
            padding: "4px 8px",
            cursor: "pointer",
          }}
        >
          Clear — reverts to {revertsTo}
        </button>
      )}
      {prov.state === "block-default" && (
        <div style={{ marginTop: 6, color: "#9a8fae" }}>
          This block&apos;s built-in style — set a value to override it.
        </div>
      )}
      {prov.state === "brand-default" && (
        <div style={{ marginTop: 6, color: "#9a8fae" }}>
          Comes from the brand stylesheet — set a value to override it.
        </div>
      )}
    </div>
  );
}

function ProvenanceDot({
  prov,
  prop,
  tokens,
  open,
  onToggle,
  onClose,
  revertsTo,
  onClear,
  jumpLabel,
  onJump,
}: {
  prov: Provenance<StyleProps>;
  prop: keyof StyleProps;
  tokens: BrandTokens;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  revertsTo: string | null;
  onClear: () => void;
  jumpLabel: string | null;
  onJump: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  // dismiss: outside mousedown + Escape (only wired while open)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const paint = DOT_PAINT[prov.state];
  const title = dotTitle(prov);

  return (
    <span
      ref={ref}
      style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}
    >
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-expanded={open}
        onClick={onToggle}
        style={{
          width: 16,
          height: 16,
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          background: "none",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            boxSizing: "border-box",
            background: paint.background,
            border: `1px solid ${paint.border}`,
          }}
        />
      </button>
      {open && (
        <ProvenancePopover
          prov={prov}
          prop={prop}
          tokens={tokens}
          revertsTo={revertsTo}
          onClear={onClear}
          jumpLabel={jumpLabel}
          onJump={onJump}
        />
      )}
    </span>
  );
}

/**
 * THE style field (Phase 2 step 4) — hosted on the `style` prop of every
 * styled block; replaces the old base-object-field + dead-end-message
 * pair with ONE set of controls that always edits "what you're looking
 * at":
 *
 *  - WRITE ROUTING: target base (phone) → the field's own onChange (the
 *    dense `style` object, exactly as the object field wrote it); target
 *    tablet/desktop → a SIBLING write to styleVariants via the same
 *    replace dispatch core's createOnChange uses (selector looked up at
 *    click time, sparse merge into the target layer);
 *  - CLEAR LAWS: at a breakpoint, clear DELETES the key (a present 0
 *    would WIN the sparse merge — the never-write-0 law) and an emptied
 *    layer drops its combo key; at the BASE, 0/"default" IS the unset
 *    sentinel, so clear writes DEFAULT_STYLE[prop] — never-write-0 is an
 *    override-layer law, not a base law;
 *  - PROVENANCE: a dot per control (gold set-here / lavender override /
 *    grey base / outline block- and brand-default) opening a popover that
 *    names the source, shows the value, warns about layers above, offers
 *    the lawful clear, and jumps the viewport to the defining breakpoint.
 *
 * PAYLOAD-UNCHANGED: both props keep their exact shapes (`style` dense,
 * `styleVariants` sparse & optional) — only the editing surface moved.
 */
export function UnifiedStyleField({
  value,
  onChange,
  tokens,
  blockType,
}: {
  value: StyleProps | undefined;
  onChange: (value: StyleProps) => void;
  tokens: BrandTokens;
  blockType: string;
}) {
  const target = useTargetBreakpoint(tokens);
  const width = useViewportWidth();
  const dispatch = usePuck((s) => s.dispatch);
  const selected = usePuck((s) => s.selectedItem);
  const getSelectorForId = usePuck((s) => s.getSelectorForId);
  const [openProp, setOpenProp] = useState<keyof StyleProps | null>(null);

  const reg = registryFor(tokens);
  const targetCombo: VariantCombo = target ? [target] : [];
  const targetKey = target ? comboKey(reg, targetCombo) : "";
  const base: StyleProps = { ...DEFAULT_STYLE, ...(value ?? {}) };
  const settings: StyleVariants =
    (selected?.props as { styleVariants?: StyleVariants } | undefined)
      ?.styleVariants ?? {};
  const layer: Partial<StyleProps> = target ? settings[targetKey] ?? {} : {};
  const activeCombo =
    typeof width === "number" ? screenComboForWidth(reg, width) : targetCombo;
  const effective = resolve(reg, base, settings, activeCombo);

  /** styleVariants lives on a SIBLING prop, so breakpoint writes re-drive
   *  the exact mechanism core's createOnChange uses: getSelectorForId at
   *  click time (never a stale index) → one replace dispatch carrying the
   *  whole item with only styleVariants swapped. `style` is untouched. */
  const writeVariants = (next: StyleVariants): void => {
    if (!selected) return;
    const selector = getSelectorForId(selected.props.id);
    if (!selector) return;
    dispatch({
      type: "replace",
      destinationIndex: selector.index,
      destinationZone: selector.zone,
      data: { ...selected, props: { ...selected.props, styleVariants: next } },
    });
  };

  const setProp = <K extends keyof StyleProps>(
    prop: K,
    v: StyleProps[K]
  ): void => {
    if (!target) {
      onChange({ ...base, [prop]: v });
      return;
    }
    writeVariants({ ...settings, [targetKey]: { ...layer, [prop]: v } });
  };

  /** next styleVariants if `prop` were cleared at the target breakpoint:
   *  DELETE the key (never write 0); an emptied layer drops its combo key. */
  const variantsWithoutProp = (prop: keyof StyleProps): StyleVariants => {
    const nextLayer = { ...layer };
    delete nextLayer[prop];
    const next: StyleVariants = { ...settings };
    if (Object.keys(nextLayer).length === 0) delete next[targetKey];
    else next[targetKey] = nextLayer;
    return next;
  };

  const clearProp = (prop: keyof StyleProps): void => {
    setOpenProp(null);
    if (!target) {
      // base clear writes the unset sentinel — DEFAULT_STYLE[prop] —
      // because 0/"default" IS "unset" in the base object (the
      // never-write-0 law protects override layers, not the base).
      onChange({ ...base, [prop]: DEFAULT_STYLE[prop] } as StyleProps);
      return;
    }
    writeVariants(variantsWithoutProp(prop));
  };

  const provFor = (prop: keyof StyleProps): Provenance<StyleProps> =>
    styleProvenance(tokens, blockType, base, settings, targetCombo, prop);

  /** name of what a set-here value REVERTS to when cleared — provenance
   *  recomputed with the target's key removed (breakpoint) or the base
   *  value replaced by its sentinel (base). */
  const revertsTo = (prop: keyof StyleProps): string => {
    if (target) {
      return sourceLabel(
        styleProvenance(
          tokens,
          blockType,
          base,
          variantsWithoutProp(prop),
          targetCombo,
          prop
        )
      );
    }
    return sourceLabel(
      styleProvenance(
        tokens,
        blockType,
        { ...base, [prop]: DEFAULT_STYLE[prop] } as StyleProps,
        settings,
        targetCombo,
        prop
      )
    );
  };

  /** where "go to source" lands: an ANCESTOR breakpoint layer → its
   *  preset; base while targeting a breakpoint → phone; the target itself
   *  and the defaults are not jumpable. */
  const jumpKeyFor = (
    prov: Provenance<StyleProps>
  ): ViewportPresetKey | null => {
    if (prov.source === "base") return target ? "phone" : null;
    if (prov.source === "default") return null;
    return prov.source === targetKey
      ? null
      : (prov.source as ViewportPresetKey);
  };

  /** the ViewportBar preset payload, verbatim — one jump, popover closes. */
  const jumpTo = (key: ViewportPresetKey): void => {
    const preset = VIEWPORT_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    dispatch({
      type: "setUi",
      ui: (prev: UiState): Partial<UiState> => ({
        viewports: {
          ...prev.viewports,
          current: { width: preset.width, height: "auto" },
        },
      }),
    });
    setOpenProp(null);
  };

  const dot = (prop: keyof StyleProps): React.ReactNode => {
    const prov = provFor(prop);
    const jumpKey = jumpKeyFor(prov);
    return (
      <ProvenanceDot
        prov={prov}
        prop={prop}
        tokens={tokens}
        open={openProp === prop}
        onToggle={() => setOpenProp((prev) => (prev === prop ? null : prop))}
        onClose={() => setOpenProp(null)}
        revertsTo={prov.state === "set-here" ? revertsTo(prop) : null}
        onClear={() => clearProp(prop)}
        jumpLabel={jumpKey}
        onJump={() => jumpKey && jumpTo(jumpKey)}
      />
    );
  };

  const bounds = tokens.type.bounds;
  const numberRow = (
    label: string,
    prop: "size" | "kerning" | "lineHeight" | "spaceAbove" | "spaceBelow",
    min: number,
    max: number,
    step = 1
  ): React.ReactNode => (
    <div style={ROW}>
      <span style={LABEL}>{label}</span>
      <input
        type="number"
        value={effective[prop]}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setProp(prop, Number(e.currentTarget.value))}
        style={{ width: 72 }}
      />
      {dot(prop)}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--puck-color-grey-05, #9a8fae)",
        }}
      >
        {target ? `editing ${target} overrides` : "editing base (phone)"}
      </div>

      <div style={ROW}>
        <span style={LABEL}>Font</span>
        <select
          value={effective.font}
          onChange={(e) =>
            setProp("font", e.currentTarget.value as StyleProps["font"])
          }
          style={{ flexGrow: 1 }}
        >
          <option value="default">Default</option>
          {Object.entries(tokens.fonts).map(([key, f]) => (
            <option key={key} value={key}>
              {f.label}
            </option>
          ))}
        </select>
        {dot("font")}
      </div>

      {numberRow("Size", "size", 0, bounds.sizePx[1])}
      {numberRow(
        "Kerning",
        "kerning",
        bounds.kerningPx[0],
        bounds.kerningPx[1]
      )}
      {numberRow("Line height", "lineHeight", 0, bounds.lineHeight[1], 0.1)}

      <div style={{ ...ROW, alignItems: "flex-start" }}>
        <span style={{ ...LABEL, paddingTop: 4 }}>Colour</span>
        <div style={{ flexGrow: 1 }}>
          <ColorField
            value={effective.color}
            onChange={(v) => setProp("color", v)}
            tokens={tokens}
          />
        </div>
        {dot("color")}
      </div>

      {numberRow("Space above", "spaceAbove", 0, tokens.spacing.maxPx)}
      {numberRow("Space below", "spaceBelow", 0, tokens.spacing.maxPx)}
    </div>
  );
}
