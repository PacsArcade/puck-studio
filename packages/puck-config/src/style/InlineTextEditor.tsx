"use client";

import { useEffect, useRef, useState } from "react";
import { createUsePuck, useGetPuck } from "@puckeditor/core";
import {
  comboKey,
  resolve,
  screenComboForWidth,
  type VariantCombo,
} from "@frens-earth/variant-engine";
import ColorField from "../color-field";
import type { BrandTokens } from "../tokens";
import { useTargetBreakpoint } from "../responsive/field";
import {
  DEFAULT_STYLE,
  registryFor,
  type StyleProps,
  type StyleVariants,
} from "../responsive/schema";

/**
 * InlineTextEditor (T-340) — double-click-to-edit-in-place for the
 * package's single-string text blocks (Heading first; Eyebrow/Text/
 * PullQuote/Button/Quote share this same adapter, see index.tsx).
 *
 * STEP 0 DECISION (documented again here, verbatim reasoning; see
 * SUMMARY.md for the full evidence trail): a hand-wired contentEditable
 * span, NOT the installed `richtext` field type. Both the native
 * `richtext` field (Tiptap) and core's own internal `InlineTextField`
 * (packages/core/components/InlineTextField, wired automatically into
 * DropZone's render pass via `field.contentEditable: true`) commit on
 * EVERY keystroke through a store write and have no "uncommitted session"
 * concept — neither gives Escape-reverts / commit-on-blur-as-one-entry
 * for free, which review-r3 requires. A hand-wired span, using the exact
 * same "fresh item + selector read, replace dispatch" contract
 * UnifiedStyleField's writeVariants already established (responsive/
 * field.tsx), is the SMALLER diff: one write primitive (useFieldWriter
 * below) serves text commits AND the toolbar's style commits, with a
 * local draft ref standing in for the "uncommitted session". The DOM
 * technique (imperative content sync via a ref, not React children, to
 * dodge the classic contentEditable+React caret-reset bug) is borrowed
 * from core's own InlineTextField, credited here rather than reinvented
 * blind. The stored prop shape is untouched: this component receives and
 * writes a plain string for the target field; `style` stays StyleProps.
 */

const usePuck = createUsePuck();

/** Same read `field.tsx`'s private useViewportWidth uses — that hook
 *  itself isn't exported, so this is the identical PUBLIC read, not a
 *  fork of write logic. 390 is the phone preset (VIEWPORT_PRESETS) — L3
 *  stays read-only, this never activates at that width. */
function useViewportWidthLocal(): number | "100%" {
  return usePuck((s) => s.appState.ui.viewports.current.width);
}

type GetPuck = ReturnType<typeof useGetPuck>;

/**
 * THE write primitive — every inline commit (text content AND the
 * toolbar's style edits) goes through this. Fresh-read-at-write-time
 * (never a render-time closure over stale props), by component id rather
 * than "current selection" (inline edits don't require the sidebar to
 * already have this block selected). Same dispatch shape core's own
 * createOnChange (Fields/index.tsx) and UnifiedStyleField's writeVariants
 * use: {type:"replace", destinationIndex, destinationZone, data}.
 */
function writeField(
  getPuck: GetPuck,
  componentId: string,
  fieldName: string,
  value: unknown,
  warnedRef: { current: boolean }
): void {
  const fresh = getPuck();
  const item = fresh.getItemById(componentId);
  const selector = fresh.getSelectorForId(componentId);
  if (!item || !selector) {
    if (!warnedRef.current) {
      warnedRef.current = true;
      // eslint-disable-next-line no-console
      console.warn(
        "[puck-config] InlineTextEditor: edit dropped — no item/selector " +
          `at write time for ${componentId}`
      );
    }
    return;
  }
  fresh.dispatch({
    type: "replace",
    destinationIndex: selector.index,
    destinationZone: selector.zone,
    data: { ...item, props: { ...item.props, [fieldName]: value } },
  });
}

function useFieldWriter(): (
  componentId: string,
  fieldName: string,
  value: unknown
) => void {
  const getPuck = useGetPuck();
  const warnedRef = useRef(false);
  return (componentId, fieldName, value) =>
    writeField(getPuck, componentId, fieldName, value, warnedRef);
}

// ── the anchored toolbar (size / letter-spacing / line-height / colour) ────

const ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};
const LABEL: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "var(--puck-color-grey-05, #9a8fae)",
  minWidth: 64,
};

const clampTo = (n: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, n));

/** Reuses UnifiedStyleField's own bounded-number-input LAW (clamp-or-
 *  reject, empty-is-not-zero) — see responsive/field.tsx's
 *  BoundedNumberInput doc comment. That function isn't exported, so this
 *  mirrors the same contract rather than importing a private symbol. */
function ToolbarNumberInput({
  value,
  min,
  max,
  step,
  onWrite,
  onEmptyCommit,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onWrite: (n: number) => void;
  onEmptyCommit: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      value={draft ?? String(value)}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const raw = e.currentTarget.value;
        if (raw.trim() === "") {
          setDraft(raw);
          return;
        }
        const n = Number(raw);
        if (Number.isNaN(n)) {
          setDraft(raw);
          return;
        }
        const clamped = clampTo(n, min, max);
        setDraft(clamped === n ? raw : String(clamped));
        onWrite(clamped);
      }}
      onBlur={() => {
        if (draft !== null && draft.trim() === "") onEmptyCommit();
        setDraft(null);
      }}
      style={{ width: 60, fontSize: 12 }}
    />
  );
}

function InlineStyleToolbar({
  componentId,
  value,
  styleVariants,
  tokens,
  getPuck,
}: {
  componentId: string;
  value: StyleProps | undefined;
  styleVariants: StyleVariants | undefined;
  tokens: BrandTokens;
  getPuck: GetPuck;
}) {
  const target = useTargetBreakpoint(tokens);
  const width = useViewportWidthLocal();
  const warnedRef = useRef(false);

  const reg = registryFor(tokens);
  const targetCombo: VariantCombo = target ? [target] : [];
  const targetKey = target ? comboKey(reg, targetCombo) : "";
  const base: StyleProps = { ...DEFAULT_STYLE, ...(value ?? {}) };
  const settings: StyleVariants = styleVariants ?? {};
  const activeCombo =
    typeof width === "number" ? screenComboForWidth(reg, width) : targetCombo;
  const effective = resolve(reg, base, settings, activeCombo);

  /** base write → the field's own onChange (style); breakpoint write →
   *  the sibling styleVariants replace, exactly UnifiedStyleField's
   *  writeVariants routing — both via the ONE writeField primitive. */
  const setProp = <K extends keyof StyleProps>(
    prop: K,
    v: StyleProps[K]
  ): void => {
    if (!target) {
      writeField(
        getPuck,
        componentId,
        "style",
        { ...base, [prop]: v },
        warnedRef
      );
      return;
    }
    const nextLayer = { ...(settings[targetKey] ?? {}), [prop]: v };
    writeField(
      getPuck,
      componentId,
      "styleVariants",
      { ...settings, [targetKey]: nextLayer },
      warnedRef
    );
  };

  const bounds = tokens.type.bounds;

  const numberRow = (
    label: string,
    prop: "size" | "kerning" | "lineHeight",
    min: number,
    max: number,
    step = 1
  ) => (
    <div style={ROW}>
      <span style={LABEL}>{label}</span>
      <ToolbarNumberInput
        value={effective[prop]}
        min={min}
        max={max}
        step={step}
        onWrite={(n) => setProp(prop, n)}
        onEmptyCommit={() => {
          if (!target) {
            writeField(
              getPuck,
              componentId,
              "style",
              { ...base, [prop]: DEFAULT_STYLE[prop] },
              warnedRef
            );
          }
          // breakpoint: empty never writes (never-write-0 law) — the
          // effective value simply restores on the next render.
        }}
      />
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: "100%",
        left: 0,
        marginBottom: 6,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 8,
        borderRadius: 8,
        background: "var(--puck-color-grey-12, #1c1a26)",
        border: "1px solid rgba(139,118,196,.45)",
        boxShadow: "0 4px 16px rgba(0,0,0,.35)",
        zIndex: 50,
        // stop dblclick/mousedown inside the toolbar from bubbling into
        // the editable span or the canvas drag handlers
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: 9, ...LABEL, minWidth: 0 }}>
        {target ? `editing ${target} overrides` : "editing base (phone)"}
      </div>
      {numberRow("Size", "size", 0, bounds.sizePx[1])}
      {numberRow(
        "Letter-spacing",
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
      </div>
    </div>
  );
}

// ── InlineTextEditor ────────────────────────────────────────────────────

export type InlineStyleFieldProps = {
  value: StyleProps | undefined;
  styleVariants: StyleVariants | undefined;
  tokens: BrandTokens;
};

export type InlineTextEditorProps = {
  /** Puck's injected block id — absent on the very first insert-preview
   *  render; inline edit can't target an id-less block. */
  componentId: string | undefined;
  /** the prop name this editor commits into ("text" / "label" / "quote" /
   *  "line1" / "line2" — never "html", RichText is out of scope). */
  fieldName: string;
  value: string;
  /** puck.isEditing from the component's own render props — only live
   *  inside the Puck editor, never on the published <Render>. */
  isEditing: boolean | undefined;
  as: "span" | "h1" | "h2" | "h3" | "p" | "a" | "blockquote" | "figcaption";
  className?: string;
  elementStyle?: React.CSSProperties;
  /** single-line fields (Eyebrow/Heading/Button label) strip newlines and
   *  commit on Enter; multi-line (Text/PullQuote/Quote) allow them. */
  disableLineBreaks?: boolean;
  /** present → the anchored size/spacing/colour toolbar mounts while
   *  editing. Absent → text-only inline edit. */
  styleField?: InlineStyleFieldProps;
  /** the wrapping span's own display — "inline-block" (default) for
   *  blocks whose ORIGINAL Tag relied on being inline-block content
   *  inside a separately-aligned ancestor (Eyebrow, Heading: alignment
   *  lives on the outer `box(align,style)` div, the Tag itself is
   *  inline-block so it responds to that div's textAlign); "block" for
   *  blocks whose Tag already carries its OWN textAlign directly
   *  (Text, PullQuote's <p>) — an inline-block wrapper there would
   *  shrink-to-fit instead of flowing full-width prose, a real
   *  visual regression for body copy. */
  wrapperDisplay?: "inline-block" | "block";
};

/**
 * Public entry point. NO Puck-context hook may be called here: `<Render>`
 * (the published path, `isEditing: false` — packages/core/components/
 * Render/index.tsx:55) mounts these SAME block components OUTSIDE any
 * <Puck> provider, and useGetPuck/usePuck throw synchronously
 * ("must be used inside <Puck>") when no provider is present. So this
 * component renders the static Tag+value with ZERO hooks whenever editing
 * isn't possible, and only MOUNTS the interactive EditableInlineText (a
 * separate component, its own consistent hook order) once isEditing is
 * actually true — a component-identity switch, not a conditional hook
 * call, so rules-of-hooks holds for both branches.
 */
export function InlineTextEditor(props: InlineTextEditorProps) {
  const { isEditing, componentId, value, as, className, elementStyle } =
    props;
  if (!isEditing || !componentId) {
    const Tag = as;
    return (
      <Tag className={className} style={elementStyle}>
        {value}
      </Tag>
    );
  }
  return <EditableInlineText {...props} componentId={componentId} />;
}

function EditableInlineText({
  componentId,
  fieldName,
  value,
  as,
  className,
  elementStyle,
  disableLineBreaks = false,
  styleField,
  wrapperDisplay = "inline-block",
}: InlineTextEditorProps & { componentId: string }) {
  // Only ever mounted when isEditing was true (see InlineTextEditor
  // above), which itself only happens inside <Puck> — safe to call these
  // unconditionally here.
  const getPuck = useGetPuck();
  const writeText = useFieldWriter();
  const width = useViewportWidthLocal();
  const isPhone = width === 390;
  const Tag = as;

  const ref = useRef<HTMLElement>(null);
  const draftRef = useRef(value);
  const startRef = useRef(value);
  const cancelingRef = useRef(false);
  const [editingSession, setEditingSession] = useState(false);

  const canEdit = !isPhone;

  // idle sync: whenever the external value changes and we're NOT mid-edit,
  // mirror it into the DOM imperatively (never via React children while
  // contentEditable is live — the same dodge core's own InlineTextField
  // uses to avoid the caret-reset bug).
  useEffect(() => {
    if (editingSession || !ref.current) return;
    const safe = value ?? "";
    if (ref.current.innerText !== safe) ref.current.replaceChildren(safe);
  }, [value, editingSession]);

  // on entering a session: snapshot the start value, focus, caret to end.
  useEffect(() => {
    if (!editingSession || !ref.current) return;
    ref.current.focus();
    const range = document.createRange();
    range.selectNodeContents(ref.current);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [editingSession]);

  const commit = (): void => {
    if (cancelingRef.current) {
      cancelingRef.current = false;
      setEditingSession(false);
      return;
    }
    const next = draftRef.current;
    if (next !== startRef.current && componentId) {
      writeText(componentId, fieldName, next);
    }
    setEditingSession(false);
  };

  const cancelEdit = (): void => {
    cancelingRef.current = true;
    draftRef.current = startRef.current;
    if (ref.current) ref.current.innerText = startRef.current ?? "";
    ref.current?.blur();
  };

  return (
    <span style={{ position: "relative", display: wrapperDisplay }}>
      {editingSession && styleField && componentId && (
        <InlineStyleToolbar
          componentId={componentId}
          value={styleField.value}
          styleVariants={styleField.styleVariants}
          tokens={styleField.tokens}
          getPuck={getPuck}
        />
      )}
      <Tag
        ref={ref as React.Ref<never>}
        className={className}
        style={elementStyle}
        contentEditable={editingSession}
        suppressContentEditableWarning
        onDoubleClick={(e: React.MouseEvent) => {
          if (!canEdit || editingSession) return;
          e.preventDefault();
          e.stopPropagation();
          cancelingRef.current = false;
          startRef.current = value;
          draftRef.current = value;
          setEditingSession(true);
        }}
        onInput={
          editingSession
            ? (e: React.FormEvent<HTMLElement>) => {
                let v = (e.target as HTMLElement).innerText;
                if (disableLineBreaks) v = v.replace(/\n/g, "");
                draftRef.current = v;
              }
            : undefined
        }
        onBlur={editingSession ? commit : undefined}
        onKeyDown={
          editingSession
            ? (e: React.KeyboardEvent) => {
                e.stopPropagation();
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                } else if (e.key === "Enter" && disableLineBreaks) {
                  e.preventDefault();
                  ref.current?.blur();
                }
              }
            : undefined
        }
      />
    </span>
  );
}
