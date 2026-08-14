import { cleanup, fireEvent, render, within } from "@testing-library/react";
import "@testing-library/jest-dom";

/**
 * UnifiedStyleField specs (Phase 2 step 4) — core mocked exactly like
 * artboards.spec.tsx (createUsePuck reading a plain state object), extended
 * with selectedItem + a getSelectorForId stub so the SIBLING WRITE path
 * (the replace dispatch) can be asserted end to end.
 */

const mockDispatch = jest.fn();
let mockViewportWidth: number | "100%" = 390;
let mockSelectedItem: { type: string; props: Record<string, unknown> } | null =
  null;
const mockGetSelectorForId = jest.fn(() => ({
  zone: "root:default-zone",
  index: 3,
}));

/** built at CALL time, so useGetPuck (write-time re-read) sees mutations
 *  made between render and click — exactly what the store hook does. */
const mockPuckState = () => ({
  dispatch: mockDispatch,
  selectedItem: mockSelectedItem,
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
import { DEFAULT_STYLE, UnifiedStyleField } from "../responsive";
import { createConfig, type StyleProps } from "../index";

const st = (o: Partial<StyleProps> = {}): StyleProps => ({
  ...DEFAULT_STYLE,
  ...o,
});

/** the UiState slice a functional setUi updater receives */
const prevUi = {
  viewports: {
    current: { width: 390 as number | "100%", height: "auto" },
    options: [{ width: 360, height: "auto" }],
    controlsVisible: true,
  },
};

const selectText = (
  style: StyleProps,
  styleVariants?: Record<string, Partial<StyleProps>>
) => {
  mockSelectedItem = {
    type: "Text",
    props: {
      id: "blk-1",
      text: "hello",
      align: "left",
      style,
      ...(styleVariants !== undefined ? { styleVariants } : {}),
    },
  };
};

const mount = (
  style: StyleProps,
  onChange: jest.Mock = jest.fn(),
  blockType = "Text"
) =>
  render(
    <UnifiedStyleField
      value={style}
      onChange={onChange}
      tokens={STARTER}
      blockType={blockType}
    />
  );

/** number inputs in row order: Size, Kerning, Line height, Space above/below */
const sizeInput = (container: HTMLElement): HTMLInputElement =>
  container.querySelectorAll<HTMLInputElement>('input[type="number"]')[0];

const kerningInput = (container: HTMLElement): HTMLInputElement =>
  container.querySelectorAll<HTMLInputElement>('input[type="number"]')[1];

/** dots in row order: font, size, kerning, lineHeight, color, above, below */
const dots = (container: HTMLElement): HTMLButtonElement[] =>
  Array.from(
    container.querySelectorAll<HTMLButtonElement>("button[aria-expanded]")
  );

afterEach(() => {
  cleanup();
  mockDispatch.mockClear();
  mockGetSelectorForId.mockClear();
  mockViewportWidth = 390;
  mockSelectedItem = null;
});

describe("write routing", () => {
  it("base edit goes through the field's OWN onChange — no dispatch", () => {
    mockViewportWidth = 390;
    const style = st({ size: 17 });
    selectText(style);
    const onChange = jest.fn();
    const { container } = mount(style, onChange);

    fireEvent.change(sizeInput(container), { target: { value: "21" } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(st({ size: 21 }));
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("tablet edit dispatches ONE replace with merged styleVariants; style untouched", () => {
    mockViewportWidth = 820;
    const style = st({ size: 17 });
    selectText(style, { tablet: { color: "accent" } });
    const onChange = jest.fn();
    const { container } = mount(style, onChange);

    fireEvent.change(sizeInput(container), { target: { value: "22" } });

    expect(onChange).not.toHaveBeenCalled();
    expect(mockGetSelectorForId).toHaveBeenCalledWith("blk-1");
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const action = mockDispatch.mock.calls[0][0];
    expect(action.type).toBe("replace");
    expect(action.destinationIndex).toBe(3);
    expect(action.destinationZone).toBe("root:default-zone");
    // sparse merge INTO the tablet layer; sibling props untouched
    expect(action.data.props.styleVariants).toEqual({
      tablet: { color: "accent", size: 22 },
    });
    expect(action.data.props.style).toBe(style);
    expect(action.data.props.text).toBe("hello");
  });

  it("desktop edit writes the desktop layer, leaving tablet's alone", () => {
    mockViewportWidth = 1280;
    const style = st();
    selectText(style, { tablet: { size: 20 } });
    const { container } = mount(style);

    fireEvent.change(sizeInput(container), { target: { value: "28" } });

    const action = mockDispatch.mock.calls[0][0];
    expect(action.data.props.styleVariants).toEqual({
      tablet: { size: 20 },
      desktop: { size: 28 },
    });
  });
});

describe("bounds law (clamp-or-reject)", () => {
  // STARTER bounds: sizePx [12, 72], kerningPx [-2, 12] — the Size row's
  // declared min is 0 (base's unset sentinel), max is bounds.sizePx[1].

  it("out-of-range typed value clamps into bounds; the input shows the clamp", () => {
    mockViewportWidth = 390;
    const style = st({ size: 17 });
    selectText(style);
    const onChange = jest.fn();
    const { container } = mount(style, onChange);

    fireEvent.change(sizeInput(container), { target: { value: "999" } });

    // no out-of-range value ever lands in the payload (old field's spirit)
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(st({ size: 72 }));
    expect(sizeInput(container).value).toBe("72");
  });

  it("below-min clamps up to the row's min (kerning can go negative to -2)", () => {
    mockViewportWidth = 390;
    const style = st();
    selectText(style);
    const onChange = jest.fn();
    const { container } = mount(style, onChange);

    fireEvent.change(kerningInput(container), { target: { value: "-9" } });

    expect(onChange).toHaveBeenCalledWith(st({ kerning: -2 }));
    expect(kerningInput(container).value).toBe("-2");
  });

  it("clamps on the breakpoint path too — the override layer stays in bounds", () => {
    mockViewportWidth = 820;
    const style = st({ size: 17 });
    selectText(style);
    const { container } = mount(style);

    fireEvent.change(sizeInput(container), { target: { value: "999" } });

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch.mock.calls[0][0].data.props.styleVariants).toEqual({
      tablet: { size: 72 },
    });
  });

  it("a non-numeric keystroke never writes (jsdom sanitizes it to the empty string — the same no-write path as NaN)", () => {
    mockViewportWidth = 390;
    const style = st({ size: 17 });
    selectText(style);
    const onChange = jest.fn();
    const { container } = mount(style, onChange);

    fireEvent.change(sizeInput(container), { target: { value: "abc" } });

    expect(onChange).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

describe("empty input law (never-write-0)", () => {
  it("empty at a tablet target writes NOTHING — no {tablet:{size:0}} — and blur restores the effective value", () => {
    mockViewportWidth = 820;
    const style = st({ size: 17 });
    selectText(style, {});
    const onChange = jest.fn();
    const { container } = mount(style, onChange);

    const input = sizeInput(container);
    fireEvent.change(input, { target: { value: "" } });

    // Number("") === 0 must never land in an override layer
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    // the effective value is restored in the box
    expect(sizeInput(container).value).toBe("17");
  });

  it("empty at base commits the DEFAULT_STYLE sentinel — on blur only, never mid-typing", () => {
    mockViewportWidth = 390;
    const style = st({ size: 17 });
    selectText(style);
    const onChange = jest.fn();
    const { container } = mount(style, onChange);

    const input = sizeInput(container);
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled(); // never mid-typing

    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(st({ size: DEFAULT_STYLE.size }));
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

describe("write-time store re-read", () => {
  it("a breakpoint write is built from the FRESH item, not the render-time snapshot", () => {
    mockViewportWidth = 820;
    const style = st({ size: 17 });
    selectText(style, { tablet: { color: "accent" } });
    const { container } = mount(style);

    // concurrent edit lands between render and click (sibling prop AND
    // styleVariants both move) — the dispatch must carry the fresh state
    mockSelectedItem = {
      type: "Text",
      props: {
        id: "blk-1",
        text: "edited elsewhere",
        align: "left",
        style,
        styleVariants: { tablet: { kerning: 2 } },
      },
    };

    fireEvent.change(sizeInput(container), { target: { value: "22" } });

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const action = mockDispatch.mock.calls[0][0];
    expect(action.data.props.text).toBe("edited elsewhere");
    // sparse merge computed against the FRESH styleVariants
    expect(action.data.props.styleVariants).toEqual({
      tablet: { kerning: 2, size: 22 },
    });
  });

  it("missing selector at write time: no dispatch, ONE console.warn — never a silent drop", () => {
    mockViewportWidth = 820;
    const style = st({ size: 17 });
    selectText(style);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockGetSelectorForId.mockReturnValueOnce(
      null as unknown as ReturnType<typeof mockGetSelectorForId>
    );
    mockGetSelectorForId.mockReturnValueOnce(
      null as unknown as ReturnType<typeof mockGetSelectorForId>
    );
    const { container } = mount(style);

    fireEvent.change(sizeInput(container), { target: { value: "22" } });
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);

    // second failed write: still surfaced-but-once for this field
    fireEvent.change(sizeInput(container), { target: { value: "23" } });
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it("missing selectedItem at write time: no dispatch, warned", () => {
    mockViewportWidth = 820;
    const style = st({ size: 17 });
    selectText(style);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = mount(style);

    mockSelectedItem = null; // deselected between render and click
    fireEvent.change(sizeInput(container), { target: { value: "22" } });

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockGetSelectorForId).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("clear laws", () => {
  it("breakpoint clear DELETES the key; an emptied layer drops its combo key", () => {
    mockViewportWidth = 820;
    const style = st({ size: 17 });
    selectText(style, { tablet: { size: 22 } });
    const onChange = jest.fn();
    const { container, getByText } = mount(style, onChange);

    const sizeDot = dots(container)[1];
    expect(sizeDot).toHaveAttribute("aria-label", "set here");
    fireEvent.click(sizeDot);
    fireEvent.click(getByText("Clear — reverts to base"));

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const action = mockDispatch.mock.calls[0][0];
    expect(action.type).toBe("replace");
    // the key is DELETED (never written as 0), and the empty layer drops
    expect(action.data.props.styleVariants).toEqual({});
    expect(onChange).not.toHaveBeenCalled();
  });

  it("base clear writes DEFAULT_STYLE[prop] — the sentinel IS base's unset", () => {
    mockViewportWidth = 390;
    const style = st({ size: 17 });
    selectText(style);
    const onChange = jest.fn();
    const { container, getByText } = mount(style, onChange);

    const sizeDot = dots(container)[1];
    expect(sizeDot).toHaveAttribute("aria-label", "set here");
    fireEvent.click(sizeDot);
    // Text hardcodes font-size, so clearing base size reverts to the block
    fireEvent.click(getByText("Clear — reverts to block default"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(st({ size: 0 }));
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("base clear of a prop with no block default reverts to the brand", () => {
    mockViewportWidth = 390;
    const style = st({ kerning: 4 });
    selectText(style);
    const onChange = jest.fn();
    const { container, getByText } = mount(style, onChange);

    fireEvent.click(dots(container)[2]); // kerning
    fireEvent.click(getByText("Clear — reverts to brand default"));

    expect(onChange).toHaveBeenCalledWith(st({ kerning: 0 }));
  });
});

describe("provenance dots", () => {
  it("labels every state: set here / from tablet / from base / defaults", () => {
    mockViewportWidth = 1280; // targeting desktop
    const style = st({ color: "accent" });
    selectText(style, { tablet: { kerning: 2 }, desktop: { size: 28 } });
    const { container } = mount(style);

    const d = dots(container);
    expect(d[1]).toHaveAttribute("aria-label", "set here"); // size @ desktop
    expect(d[2]).toHaveAttribute("aria-label", "from tablet"); // kerning
    expect(d[4]).toHaveAttribute("aria-label", "from base"); // color
    expect(d[3]).toHaveAttribute("aria-label", "block default"); // lineHeight (Text hardcodes it)
    expect(d[5]).toHaveAttribute("aria-label", "brand default"); // spaceAbove
  });
});

describe("jump to source", () => {
  it("base source while targeting tablet jumps the viewport to phone 390", () => {
    mockViewportWidth = 820;
    const style = st({ size: 17 });
    selectText(style);
    const { container, getByRole, queryByRole } = mount(style);

    fireEvent.click(dots(container)[1]); // size: from base
    fireEvent.click(getByRole("button", { name: "base" }));

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const action = mockDispatch.mock.calls[0][0];
    expect(action.type).toBe("setUi");
    expect(action.ui(prevUi).viewports.current).toEqual({
      width: 390,
      height: "auto",
    });
    // the popover closes on jump
    expect(queryByRole("dialog")).toBeNull();
  });

  it("a tablet override seen from desktop jumps to tablet 820", () => {
    mockViewportWidth = 1280;
    const style = st();
    selectText(style, { tablet: { size: 22 } });
    const { container, getByRole } = mount(style);

    fireEvent.click(dots(container)[1]); // size: from tablet
    fireEvent.click(getByRole("button", { name: "tablet" }));

    const action = mockDispatch.mock.calls[0][0];
    expect(action.type).toBe("setUi");
    expect(action.ui(prevUi).viewports.current).toEqual({
      width: 820,
      height: "auto",
    });
  });

  it("defaults are not jumpable — the popover explains instead", () => {
    mockViewportWidth = 820;
    const style = st();
    selectText(style);
    const { container, getByRole, getByText } = mount(style);

    fireEvent.click(dots(container)[1]); // size: block default (Text)
    getByText(/built-in style/);
    // the source line is plain text, not a jump link, inside the popover
    expect(
      within(getByRole("dialog")).queryByRole("button", {
        name: "block default",
      })
    ).toBeNull();
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

describe("popover behavior", () => {
  it("opens on click, warns about layers above, closes on Escape", () => {
    mockViewportWidth = 390;
    const style = st({ size: 17 });
    selectText(style, { tablet: { size: 22 } });
    const { container, getByRole, getByText, queryByRole } = mount(style);

    const sizeDot = dots(container)[1];
    fireEvent.click(sizeDot);
    expect(sizeDot).toHaveAttribute("aria-expanded", "true");
    getByRole("dialog");
    getByText("Also overridden at: tablet");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(queryByRole("dialog")).toBeNull();
    expect(sizeDot).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on outside mousedown; only one popover open at a time", () => {
    mockViewportWidth = 390;
    const style = st({ size: 17, kerning: 3 });
    selectText(style);
    const { container, queryAllByRole } = mount(style);

    const d = dots(container);
    fireEvent.click(d[1]); // size
    fireEvent.click(d[2]); // kerning — replaces, never stacks
    expect(queryAllByRole("dialog")).toHaveLength(1);
    expect(d[1]).toHaveAttribute("aria-expanded", "false");
    expect(d[2]).toHaveAttribute("aria-expanded", "true");

    fireEvent.mouseDown(document.body);
    expect(queryAllByRole("dialog")).toHaveLength(0);
  });
});

describe("config shape (the hidden sibling)", () => {
  const config = createConfig({
    assets: { nebula: "/n.webp", meteors: "/m.webp" },
  });
  const styled = [
    "Eyebrow",
    "Heading",
    "StackedHeading",
    "Text",
    "RichText",
    "PullQuote",
    "Button",
    "Quote",
  ] as const;

  it.each(styled)(
    "%s: style is the custom field, styleVariants is visible:false",
    (name) => {
      const fields = config.components[name].fields as Record<
        string,
        { type: string; label?: string; visible?: boolean }
      >;
      expect(fields.style.type).toBe("custom");
      expect(fields.style.label).toBe("Style");
      expect(fields.styleVariants.type).toBe("custom");
      expect(fields.styleVariants.visible).toBe(false);
    }
  );
});
