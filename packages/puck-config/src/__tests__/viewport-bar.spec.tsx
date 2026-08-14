import { cleanup, fireEvent, render } from "@testing-library/react";
import "@testing-library/jest-dom";

/**
 * ViewportBar restyle spec (STUDIO RESPONSIVE batch): the active pill
 * must sit on 0.23 SEMANTIC tokens — the 0.20 --puck-color-azure-* scale
 * vars are dead in hosts (unresolved var + near-white fallback = the
 * half-clipped white blob on the active pill). Core is mocked with the
 * house pattern (createUsePuck over a plain state object).
 */

const mockDispatch = jest.fn();
let mockViewportWidth: number | "100%" = 390;

jest.mock("@puckeditor/core", () => ({
  __esModule: true,
  createUsePuck:
    () =>
    <T,>(selector: (s: unknown) => T): T =>
      selector({
        dispatch: mockDispatch,
        appState: {
          ui: {
            viewports: {
              current: { width: mockViewportWidth, height: "auto" },
            },
          },
        },
      }),
  useGetPuck: () => () => ({}),
  Render: () => null,
}));

import { ViewportBar, VIEWPORT_PRESETS } from "../responsive";

afterEach(() => {
  cleanup();
  mockDispatch.mockClear();
  mockViewportWidth = 390;
});

describe("ViewportBar styling", () => {
  it("references NO dead azure vars anywhere (the white-blob bug)", () => {
    const { container } = render(<ViewportBar />);
    expect(container.innerHTML).not.toMatch(/azure/);
  });

  it("paints the active pill on semantic interactive tokens", () => {
    const { getByText } = render(<ViewportBar />);
    const active = getByText(/Phone/).closest("button")!;
    expect(active.getAttribute("style")).toContain(
      "--puck-color-interactive-soft"
    );
    expect(active.getAttribute("style")).toContain("--puck-color-interactive");
    const idle = getByText(/Tablet/).closest("button")!;
    expect(idle.getAttribute("style")).toContain("--puck-color-border");
    expect(idle.getAttribute("style")).not.toContain("interactive-soft");
  });

  it("default (no compact prop) markup is unchanged — non-breaking minor", () => {
    const { container } = render(<ViewportBar />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("pills still dispatch the full viewports payload", () => {
    const { getByText } = render(<ViewportBar />);
    fireEvent.click(getByText(/Desktop/));
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const action = mockDispatch.mock.calls[0][0];
    expect(action.type).toBe("setUi");
    const next = action.ui({
      viewports: {
        current: { width: 390, height: "auto" },
        options: [],
        controlsVisible: true,
      },
    });
    expect(next.viewports.current).toEqual({
      width: VIEWPORT_PRESETS[2].width,
      height: "auto",
    });
    expect(next.viewports.options).toEqual([]); // full object preserved
  });
});

/**
 * Compact mode (0.12.0): text-free SVG glyph pills under the LEGIBILITY
 * DOCTRINE — icon-only controls carry redundant cues (aria-label + title
 * with device AND width, aria-pressed on the active pill, and a visible
 * non-color active cue).
 */
describe("ViewportBar compact", () => {
  it("renders 3 icon-only buttons with aria-labels + titles, no text", () => {
    const { getAllByRole } = render(<ViewportBar compact />);
    const buttons = getAllByRole("button");
    expect(buttons).toHaveLength(3);
    VIEWPORT_PRESETS.forEach((preset, i) => {
      expect(buttons[i]).toHaveAttribute(
        "aria-label",
        `${preset.label} ${preset.width}`
      );
      expect(buttons[i]).toHaveAttribute(
        "title",
        `${preset.label} · ${preset.width}px`
      );
      // TEXT-FREE: the glyph is SVG only — no visible label text
      expect(buttons[i].textContent).toBe("");
      expect(buttons[i].querySelector("svg")).not.toBeNull();
      expect(buttons[i].querySelector("svg")).toHaveAttribute(
        "aria-hidden",
        "true"
      );
    });
  });

  it("marks the active pill with aria-pressed and the underline cue", () => {
    mockViewportWidth = 820; // tablet
    const { getAllByRole } = render(<ViewportBar compact />);
    const [phone, tablet, desktop] = getAllByRole("button");
    expect(tablet).toHaveAttribute("aria-pressed", "true");
    expect(phone).toHaveAttribute("aria-pressed", "false");
    expect(desktop).toHaveAttribute("aria-pressed", "false");
    // non-color cue: the underline bar paints on currentColor when active
    // (jsdom serializes the keyword lowercased)
    const bar = (b: HTMLElement) =>
      (
        (b.lastElementChild as HTMLElement).getAttribute("style") ?? ""
      ).toLowerCase();
    expect(bar(tablet)).toContain("background: currentcolor");
    expect(bar(phone)).not.toContain("background: currentcolor");
  });

  it("compact pills dispatch the same full viewports payload", () => {
    const { getAllByRole } = render(<ViewportBar compact />);
    fireEvent.click(getAllByRole("button")[2]); // Desktop
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const action = mockDispatch.mock.calls[0][0];
    expect(action.type).toBe("setUi");
    const next = action.ui({
      viewports: {
        current: { width: 390, height: "auto" },
        options: [],
        controlsVisible: true,
      },
    });
    expect(next.viewports.current).toEqual({
      width: VIEWPORT_PRESETS[2].width,
      height: "auto",
    });
    expect(next.viewports.options).toEqual([]);
  });
});
