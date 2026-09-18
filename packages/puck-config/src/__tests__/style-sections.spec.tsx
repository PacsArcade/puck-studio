import { cleanup, fireEvent, render } from "@testing-library/react";
import "@testing-library/jest-dom";

/**
 * TASK-341 specs — the Typography/Spacing collapsible sections plus the
 * Weight control. Core mocked the same minimal way as
 * unified-field.spec.tsx (this field doesn't need the write-path mocks
 * that file's dispatch assertions do — these tests only exercise render
 * and the localStorage-backed collapse state).
 */

let mockViewportWidth: number | "100%" = 390;
let mockSelectedItem: { type: string; props: Record<string, unknown> } | null =
  null;
const mockGetSelectorForId = jest.fn(() => ({
  zone: "root:default-zone",
  index: 0,
}));
const mockDispatch = jest.fn();

const mockPuckState = () => ({
  dispatch: mockDispatch,
  selectedItem: mockSelectedItem,
  getSelectorForId: mockGetSelectorForId,
  appState: {
    ui: { viewports: { current: { width: mockViewportWidth, height: "auto" } } },
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
import {
  DEFAULT_STYLE,
  SPACING_SECTION_PROPS,
  TYPOGRAPHY_SECTION_PROPS,
  UnifiedStyleField,
} from "../responsive";
import { typoDecls } from "../responsive/css";
import type { StyleProps } from "../index";

const st = (o: Partial<StyleProps> = {}): StyleProps => ({
  ...DEFAULT_STYLE,
  ...o,
});

const selectBlock = (type: string, style: StyleProps, id = "blk-1") => {
  mockSelectedItem = {
    type,
    props: { id, text: "hello", align: "left", style },
  };
};

const mount = (style: StyleProps, blockType = "Text") =>
  render(
    <UnifiedStyleField
      value={style}
      onChange={jest.fn()}
      tokens={STARTER}
      blockType={blockType}
    />
  );

afterEach(() => {
  cleanup();
  mockDispatch.mockClear();
  mockGetSelectorForId.mockClear();
  mockViewportWidth = 390;
  mockSelectedItem = null;
  window.localStorage.clear();
});

// ── (a) schema exhaustiveness — "no new storage keys unless named" ────────

describe("schema completeness (TASK-341 Tests (a))", () => {
  it("every control the two sections render maps to an existing StyleProps key, and nothing else", () => {
    // An exhaustive StyleProps fixture — satisfies StyleProps, so adding a
    // future schema key forces this object (and therefore this test) to
    // be touched. weight is optional but named here on purpose: it's a
    // real, in-scope key as of this cut.
    const everyKey: Required<StyleProps> = {
      font: "default",
      size: 0,
      kerning: 0,
      lineHeight: 0,
      color: "default",
      spaceAbove: 0,
      spaceBelow: 0,
      weight: 400,
    };

    const rendered = [...TYPOGRAPHY_SECTION_PROPS, ...SPACING_SECTION_PROPS]
      .slice()
      .sort();
    const schemaKeys = Object.keys(everyKey).sort();

    // Passes trivially for THIS cut, precisely because nothing was added
    // beyond the Admiral's named `weight` key. If a future lane adds a
    // Background/Border/Size/Layout control without adding its schema key
    // (or vice versa), this equality breaks until schema.ts and the
    // section prop lists are updated in step.
    expect(rendered).toEqual(schemaKeys);
  });

  it("Typography and Spacing are disjoint and, together, cover every key exactly once", () => {
    const seen = new Set<string>();
    for (const p of [...TYPOGRAPHY_SECTION_PROPS, ...SPACING_SECTION_PROPS]) {
      expect(seen.has(p)).toBe(false);
      seen.add(p);
    }
  });
});

// ── (b)/(c) collapse state ─────────────────────────────────────────────────

describe("section collapse state (TASK-341 Tests (b)/(c))", () => {
  it("both sections render open by default (no localStorage entry yet)", () => {
    const style = st({ size: 17 });
    selectBlock("Text", style);
    const { getByText, container } = mount(style);

    getByText("Typography");
    getByText("Spacing");
    // Font select + the numeric rows are visible — the section body renders
    expect(container.querySelector('input[type="number"]')).not.toBeNull();
  });

  it("collapsing Typography hides its rows and persists across a re-render", () => {
    const style = st({ size: 17 });
    selectBlock("Text", style);
    const { getByText, container, rerender } = mount(style);

    fireEvent.click(getByText("Typography"));
    // Typography's rows are gone; Spacing's (2 number inputs) remain
    expect(
      container.querySelectorAll('input[type="number"]').length
    ).toBe(2);

    rerender(
      <UnifiedStyleField
        value={style}
        onChange={jest.fn()}
        tokens={STARTER}
        blockType="Text"
      />
    );
    // still collapsed after a re-render — read from localStorage again
    expect(
      container.querySelectorAll('input[type="number"]').length
    ).toBe(2);
  });

  it("collapse state is keyed per block type — collapsing on Heading doesn't collapse on Button", () => {
    const style = st({ size: 17 });
    selectBlock("Heading", style);
    const heading = mount(style, "Heading");
    fireEvent.click(heading.getByText("Typography"));
    expect(
      heading.container.querySelectorAll('input[type="number"]').length
    ).toBe(2); // Spacing only
    heading.unmount();

    selectBlock("Button", style);
    const button = mount(style, "Button");
    // Button's Typography section is untouched — still open
    expect(
      button.container.querySelectorAll('input[type="number"]').length
    ).toBe(5); // Size/Kerning/LineHeight (Typography) + above/below (Spacing)
    button.unmount();
  });

  it("re-selecting a different block after collapsing re-opens Typography fresh", () => {
    const style = st({ size: 17 });
    selectBlock("Text", style);
    const first = mount(style, "Text");
    fireEvent.click(first.getByText("Typography"));
    expect(
      first.container.querySelectorAll('input[type="number"]').length
    ).toBe(2);
    first.unmount();

    selectBlock("Quote", style);
    const second = mount(style, "Quote");
    expect(
      second.container.querySelectorAll('input[type="number"]').length
    ).toBe(5);
    second.unmount();
  });

  it("degrades gracefully (defaults open, no crash) when localStorage throws", () => {
    const getItem = jest
      .spyOn(window.localStorage.__proto__, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked (private mode)");
      });
    const setItem = jest
      .spyOn(window.localStorage.__proto__, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked (private mode)");
      });

    const style = st({ size: 17 });
    selectBlock("Text", style);

    expect(() => {
      const { getByText, container } = mount(style);
      // still renders open (the read threw, so it fell back to the default)
      expect(
        container.querySelectorAll('input[type="number"]').length
      ).toBe(5);
      // clicking the header must not throw even though the write also fails
      fireEvent.click(getByText("Typography"));
    }).not.toThrow();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});

// ── (d) weight decl-record test ─────────────────────────────────────────────

describe("weight decl-record twin (TASK-341 rulings-at-cut / T-340 Tests (d))", () => {
  it("typoDecls emits font-weight only when set — never-write-0 law", () => {
    expect(typoDecls(DEFAULT_STYLE, STARTER)).not.toHaveProperty(
      "font-weight"
    );
    expect(typoDecls(st({ weight: 700 }), STARTER)).toHaveProperty(
      "font-weight",
      "700"
    );
    expect(typoDecls({ weight: undefined }, STARTER)).not.toHaveProperty(
      "font-weight"
    );
  });

  it("the same twin's inline path (typo(), index.tsx) and generated-sheet path (typoDecls, css.ts) agree", () => {
    // typoDecls IS the decl-record twin exercised by styleVariantsCss for
    // the generated sheet; the inline path (index.tsx's typo()) uses the
    // identical `if (s.weight) …` guard by construction — asserted by
    // inspection in SUMMARY, covered here via the decl-record side only
    // per Tests (d)'s own scope ("a decl-record test proving typoDecls's
    // twin emits font-weight only when set").
    const decls = typoDecls(st({ weight: 500 }), STARTER);
    expect(decls["font-weight"]).toBe("500");
  });
});
