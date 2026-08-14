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
