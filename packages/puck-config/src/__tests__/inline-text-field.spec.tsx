import { cleanup, fireEvent, render } from "@testing-library/react";
import "@testing-library/jest-dom";

/**
 * InlineTextEditor specs (T-340). @puckeditor/core mocked exactly like
 * unified-field.spec.tsx (createUsePuck reading a plain state object) —
 * extended with getItemById (InlineTextEditor writes by component id,
 * not "current selection") so the fresh-read-at-write-time replace
 * dispatch can be asserted end to end, same as UnifiedStyleField's own
 * writeVariants path.
 */

const mockDispatch = jest.fn();
let mockViewportWidth: number | "100%" = 500; // base (below tabletMin 768) unless a test overrides
const mockGetSelectorForId = jest.fn(() => ({
  zone: "root:default-zone",
  index: 3,
}));

type MockItem = { type: string; props: Record<string, unknown> };
let mockItems: Record<string, MockItem> = {};
const mockGetItemById = jest.fn((id: string) => mockItems[id]);

/** built at CALL time, so useGetPuck (write-time re-read) sees mutations
 *  made between render and the commit — exactly what the real hook does. */
const mockPuckState = () => ({
  dispatch: mockDispatch,
  getItemById: mockGetItemById,
  getSelectorForId: mockGetSelectorForId,
  appState: {
    ui: {
      viewports: {
        current: { width: mockViewportWidth, height: "auto" },
      },
    },
  },
});

jest.mock("@puckeditor/core", () => ({
  __esModule: true,
  createUsePuck:
    () =>
    <T,>(selector: (s: unknown) => T): T =>
      selector(mockPuckState()),
  useGetPuck: () => mockPuckState,
  Render: () => null,
}));

import { STARTER } from "../tokens";
import { DEFAULT_STYLE } from "../responsive/schema";
import { InlineTextEditor } from "../style/InlineTextEditor";

const st = (o: Partial<typeof DEFAULT_STYLE> = {}) => ({
  ...DEFAULT_STYLE,
  ...o,
});

const seedHeading = (overrides: Partial<MockItem["props"]> = {}) => {
  mockItems = {
    "blk-1": {
      type: "Heading",
      props: {
        id: "blk-1",
        text: "Heading",
        level: "h2",
        align: "left",
        style: st(),
        ...overrides,
      },
    },
  };
};

const typeInto = (el: Element, text: string) => {
  el.textContent = text;
  fireEvent.input(el);
};

afterEach(() => {
  cleanup();
  mockDispatch.mockClear();
  mockGetSelectorForId.mockClear();
  mockGetItemById.mockClear();
  mockViewportWidth = 500;
  mockItems = {};
});

describe("InlineTextEditor — not editing / published path", () => {
  it("renders a plain Tag with the value and calls NO Puck hook (safe outside <Puck>, e.g. <Render>)", () => {
    // isEditing: false is exactly what <Render> passes
    // (packages/core/components/Render/index.tsx:55) — this must not throw.
    seedHeading();
    const { container } = render(
      <InlineTextEditor
        componentId="blk-1"
        fieldName="text"
        value="Heading"
        isEditing={false}
        as="h2"
        className="target"
      />
    );
    const el = container.querySelector(".target")!;
    expect(el.tagName).toBe("H2");
    expect(el.textContent).toBe("Heading");
    expect(el.getAttribute("contenteditable")).toBeNull();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("renders a plain Tag with NO componentId (insert-preview render) without throwing", () => {
    const { container } = render(
      <InlineTextEditor
        componentId={undefined}
        fieldName="text"
        value="Heading"
        isEditing={true}
        as="h2"
        className="target"
      />
    );
    expect(container.querySelector(".target")?.textContent).toBe("Heading");
  });
});

describe("InlineTextEditor — commit path (test a: same onChange shape the sidebar calls)", () => {
  it("double-click enters edit, blur commits ONE replace dispatch shaped exactly like the Fields sidebar's onChange", () => {
    seedHeading();
    const { container } = render(
      <InlineTextEditor
        componentId="blk-1"
        fieldName="text"
        value="Heading"
        isEditing={true}
        as="h2"
        className="target"
        disableLineBreaks
      />
    );
    const el = container.querySelector(".target")!;

    fireEvent.doubleClick(el);
    expect(el.getAttribute("contenteditable")).toBe("true");

    typeInto(el, "My Story");
    fireEvent.blur(el);

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const action = mockDispatch.mock.calls[0][0];
    // the SAME dispatch contract createOnChange (Fields/index.tsx) and
    // UnifiedStyleField's writeVariants use: a "replace" action carrying
    // destinationIndex/destinationZone from the block's own selector, and
    // `data` = the full item with only the target field's prop changed —
    // never a bespoke field-specific action type.
    expect(action.type).toBe("replace");
    expect(action.destinationIndex).toBe(3);
    expect(action.destinationZone).toBe("root:default-zone");
    expect(action.data.type).toBe("Heading");
    expect(action.data.props.text).toBe("My Story");
    // every OTHER prop passes through untouched — a targeted field write,
    // not a partial/blind replace.
    expect(action.data.props.level).toBe("h2");
    expect(action.data.props.align).toBe("left");
    expect(action.data.props.style).toEqual(st());
  });

  it("does not write when blurred with the value unchanged", () => {
    seedHeading();
    const { container } = render(
      <InlineTextEditor
        componentId="blk-1"
        fieldName="text"
        value="Heading"
        isEditing={true}
        as="h2"
        className="target"
        disableLineBreaks
      />
    );
    const el = container.querySelector(".target")!;
    fireEvent.doubleClick(el);
    fireEvent.blur(el);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("strips newlines for disableLineBreaks fields (Heading/Eyebrow/Button label)", () => {
    seedHeading();
    const { container } = render(
      <InlineTextEditor
        componentId="blk-1"
        fieldName="text"
        value="Heading"
        isEditing={true}
        as="h2"
        className="target"
        disableLineBreaks
      />
    );
    const el = container.querySelector(".target")!;
    fireEvent.doubleClick(el);
    typeInto(el, "Line one\nLine two");
    fireEvent.blur(el);
    const action = mockDispatch.mock.calls[0][0];
    expect(action.data.props.text).toBe("Line oneLine two");
  });
});

describe("InlineTextEditor — Escape (test b: reverts without writing)", () => {
  it("Escape restores the pre-edit value and never dispatches", () => {
    seedHeading();
    const { container } = render(
      <InlineTextEditor
        componentId="blk-1"
        fieldName="text"
        value="Heading"
        isEditing={true}
        as="h2"
        className="target"
        disableLineBreaks
      />
    );
    const el = container.querySelector(".target")!;
    fireEvent.doubleClick(el);
    typeInto(el, "an uncommitted edit");
    expect(el.textContent).toBe("an uncommitted edit");

    fireEvent.keyDown(el, { key: "Escape" });

    // Escape reverts the DOM synchronously and blurs — the blur it
    // triggers must NOT re-commit the mid-typed draft.
    expect(el.textContent).toBe("Heading");
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

describe("InlineTextEditor — 390 stays read-only (L3)", () => {
  it("double-click does not enter edit mode at phone width (390)", () => {
    mockViewportWidth = 390;
    seedHeading();
    const { container } = render(
      <InlineTextEditor
        componentId="blk-1"
        fieldName="text"
        value="Heading"
        isEditing={true}
        as="h2"
        className="target"
        disableLineBreaks
      />
    );
    const el = container.querySelector(".target")!;
    fireEvent.doubleClick(el);
    expect(el.getAttribute("contenteditable")).toBe("false");
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

describe("InlineTextEditor — anchored toolbar (test c: base + writeVariants)", () => {
  const mountWithToolbar = () => {
    seedHeading();
    const { container } = render(
      <InlineTextEditor
        componentId="blk-1"
        fieldName="text"
        value="Heading"
        isEditing={true}
        as="h2"
        className="target"
        disableLineBreaks
        styleField={{
          value: st(),
          styleVariants: undefined,
          tokens: STARTER,
        }}
      />
    );
    const el = container.querySelector(".target")!;
    fireEvent.doubleClick(el);
    return container;
  };

  it("shows only size / letter-spacing / line-height / colour — no font, weight, spacing-above/below, or marks", () => {
    const container = mountWithToolbar();
    const text = container.textContent ?? "";
    expect(text).toContain("Size");
    expect(text).toContain("Letter-spacing");
    expect(text).toContain("Line height");
    expect(text).toContain("Colour");
    expect(text).not.toContain("Font");
    expect(text).not.toContain("Weight");
    expect(text).not.toContain("Space above");
    expect(text).not.toContain("Space below");
    expect(container.querySelector("b, i, button[title*='Bold' i]")).toBeNull();
  });

  it("BASE write (width below tabletMin): size control writes style through the field's own replace — same mechanism as a base UnifiedStyleField edit", () => {
    mockViewportWidth = 500; // < tabletMin (768) => target null => base
    const container = mountWithToolbar();
    const sizeInput = container.querySelectorAll(
      "input[type='number']"
    )[0] as HTMLInputElement;

    fireEvent.change(sizeInput, { target: { value: "24" } });

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const action = mockDispatch.mock.calls[0][0];
    expect(action.type).toBe("replace");
    expect(action.data.props.text).toBe("Heading"); // untouched sibling field
    expect(action.data.props.style.size).toBe(24);
    expect(action.data.props.styleVariants).toBeUndefined();
  });

  it("BREAKPOINT write (width >= tabletMin): size control writes into styleVariants[tablet] — the sibling replace UnifiedStyleField's writeVariants uses, not the base style object", () => {
    mockViewportWidth = 800; // >= tabletMin (768), < desktopMin (1080) => target "tablet"
    const container = mountWithToolbar();
    const sizeInput = container.querySelectorAll(
      "input[type='number']"
    )[0] as HTMLInputElement;

    fireEvent.change(sizeInput, { target: { value: "24" } });

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const action = mockDispatch.mock.calls[0][0];
    expect(action.type).toBe("replace");
    // base style is UNTOUCHED — the override lands on the sibling prop.
    expect(action.data.props.style).toEqual(st());
    expect(action.data.props.styleVariants).toEqual({ tablet: { size: 24 } });
  });

  it("colour control writes through color-field.tsx's palette picker, never a bare hex typed value", () => {
    mockViewportWidth = 500;
    const container = mountWithToolbar();
    // ColorField renders a swatch button per brand colour token + palette
    // slots + a native color input for free hex — assert the palette
    // swatches are present (the reused control, not a duplicated picker).
    const swatches = container.querySelectorAll("button[aria-label]");
    expect(swatches.length).toBeGreaterThan(0);

    fireEvent.click(swatches[0]);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const action = mockDispatch.mock.calls[0][0];
    expect(action.data.props.style.color).toBeDefined();
  });
});
