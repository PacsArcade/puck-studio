"use client";

import { createUsePuck } from "@puckeditor/core";
import type { UiState } from "@puckeditor/core";
import {
  comboKey,
  definedAt,
  resolve,
  screenComboForWidth,
} from "@pacsarcade/variant-engine";
import ColorField from "../color-field";
import type { BrandTokens } from "../tokens";
import {
  DEFAULT_STYLE,
  registryFor,
  type BreakpointKey,
  type StyleProps,
  type StyleVariants,
} from "./schema";

/**
 * The responsive editing surface (Phase 2 step 2):
 *  - ViewportBar — three pills (Phone/Tablet/Desktop) driving Puck's own
 *    ui.viewports, so the iframe preview resizes and media queries fire
 *    for real;
 *  - useTargetBreakpoint — classifies the current viewport width against
 *    the brand's breakpoints: the TARGET a style edit writes to;
 *  - ResponsiveStyleField — the styleVariants custom field: same controls
 *    as the base Style Inspector, showing the EFFECTIVE value at the
 *    target, with a defined-dot per control (gold "set here" with a ×
 *    that DELETES the override key — clear-override deletes, never
 *    writes 0 — vs dim "from base"/"from tablet");
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

const VIEWPORT_PRESETS: { label: string; width: number }[] = [
  { label: "Phone", width: 390 },
  { label: "Tablet", width: 820 },
  { label: "Desktop", width: 1280 },
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
