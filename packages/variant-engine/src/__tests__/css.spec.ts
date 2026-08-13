import { cssClassName, emitBlockCss, mediaText, type CssLayer } from "../index";

describe("cssClassName", () => {
  it("sanitizes to [A-Za-z0-9_-] and appends a hash of the RAW id", () => {
    const cls = cssClassName("sv-typo", "ab 3/x");
    expect(cls).toMatch(/^sv-typo-ab-3-x-[a-z0-9]{4}$/);
  });

  it("ids that sanitize alike still get distinct classes", () => {
    expect(cssClassName("sv", "a b")).not.toBe(cssClassName("sv", "a-b"));
  });

  it("is stable for the same id", () => {
    expect(cssClassName("sv", "ab-3")).toBe(cssClassName("sv", "ab-3"));
  });
});

describe("mediaText", () => {
  it("renders min, max, and banded specs", () => {
    expect(mediaText({ minWidth: 768 })).toBe("(min-width: 768px)");
    expect(mediaText({ maxWidth: 1079 })).toBe("(max-width: 1079px)");
    expect(mediaText({ minWidth: 768, maxWidth: 1079 })).toBe(
      "(min-width: 768px) and (max-width: 1079px)"
    );
  });
});

describe("emitBlockCss", () => {
  it("emits base first, then ascending min-width blocks (mobileFirst) — exact string", () => {
    const layers: CssLayer[] = [
      {
        decls: {
          color: "var(--ink-body)",
          "font-size": ".98rem",
          "line-height": "1.85",
        },
      },
      { screen: { minWidth: 1080 }, decls: { color: "var(--accent)" } },
      { screen: { minWidth: 768 }, decls: { "font-size": "22px" } },
    ];

    expect(emitBlockCss("sv-typo-ab-3-x9y1", layers, "mobileFirst")).toBe(
      [
        ".sv-typo-ab-3-x9y1 {",
        "  color: var(--ink-body);",
        "  font-size: .98rem;",
        "  line-height: 1.85;",
        "}",
        "@media (min-width: 768px) {",
        "  .sv-typo-ab-3-x9y1 {",
        "    font-size: 22px;",
        "  }",
        "}",
        "@media (min-width: 1080px) {",
        "  .sv-typo-ab-3-x9y1 {",
        "    color: var(--accent);",
        "  }",
        "}",
      ].join("\n")
    );
  });

  it("skips empty layers and merges screen-less layers into the base rule", () => {
    const layers: CssLayer[] = [
      { decls: { "text-align": "center" } },
      { decls: { "margin-top": "12px" } },
      { screen: { minWidth: 768 }, decls: {} },
    ];
    expect(emitBlockCss("c", layers, "mobileFirst")).toBe(
      [".c {", "  text-align: center;", "  margin-top: 12px;", "}"].join("\n")
    );
  });

  it("never writes !important", () => {
    const css = emitBlockCss(
      "c",
      [
        { decls: { color: "red" } },
        { screen: { minWidth: 768 }, decls: { color: "blue" } },
      ],
      "mobileFirst"
    );
    expect(css).not.toContain("!important");
  });
});
