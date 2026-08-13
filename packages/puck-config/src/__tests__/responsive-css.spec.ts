/**
 * @jest-environment node
 *
 * styleVariantsCss is PURE — it must run where <Render> does (RSC, the
 * publish API, lint) with no window in sight.
 */
import { styleVariantsCss } from "../responsive/css";
import { DEFAULT_STYLE } from "../responsive/schema";
import { STARTER } from "../tokens";

describe("styleVariantsCss under node (no window)", () => {
  it("really has no window", () => {
    expect(typeof window).toBe("undefined");
  });

  it("returns null for absent/empty styleVariants and missing ids", () => {
    expect(
      styleVariantsCss("ab-1", "left", DEFAULT_STYLE, undefined, STARTER)
    ).toBeNull();
    expect(
      styleVariantsCss("ab-1", "left", DEFAULT_STYLE, {}, STARTER)
    ).toBeNull();
    expect(
      styleVariantsCss("ab-1", "left", DEFAULT_STYLE, { tablet: {} }, STARTER)
    ).toBeNull();
    expect(
      styleVariantsCss(
        "",
        "left",
        DEFAULT_STYLE,
        { tablet: { size: 22 } },
        STARTER
      )
    ).toBeNull();
  });

  it("builds base-first sheets with the block defaults folded in", () => {
    const out = styleVariantsCss(
      "ab-3",
      "center",
      { ...DEFAULT_STYLE, kerning: 6, size: 20 },
      { tablet: { size: 22 }, desktop: { color: "accent" } },
      STARTER,
      {
        typo: {
          color: "var(--ink-body)",
          "font-size": ".98rem",
          "line-height": "1.85",
        },
      }
    );

    expect(out).not.toBeNull();
    expect(out!.boxClass).toMatch(/^sv-box-ab-3-/);
    expect(out!.typoClass).toMatch(/^sv-typo-ab-3-/);

    const css = out!.cssText;
    // base rules first, media blocks ascending (mobileFirst)
    expect(css.indexOf(`.${out!.boxClass} {`)).toBeLessThan(
      css.indexOf("@media")
    );
    expect(css.indexOf("(min-width: 768px)")).toBeLessThan(
      css.indexOf("(min-width: 1080px)")
    );
    // base style beats the hardcoded default within the base rule —
    // same key, later insertion wins, so .98rem is gone entirely
    expect(css).toContain("font-size: 20px");
    expect(css).not.toContain(".98rem");
    // the desktop colour resolves through the brand tokens
    expect(css).toContain("color: #7FB4E6");
    expect(css).not.toContain("!important");
  });
});
