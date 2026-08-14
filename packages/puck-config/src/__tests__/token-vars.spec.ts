/**
 * @jest-environment node
 *
 * emitTokenVars / effectivePalette are PURE — they must run where the
 * host's <PaletteVars> does (RSC) with no window in sight. Exact-string
 * tests: the no-variance line is the byte-stable regression target the
 * host diffs against its legacy PaletteVars output.
 */
import {
  effectivePalette,
  emitTokenVars,
  STARTER,
  type BrandTokens,
  type PaletteKey,
  type TokenComboKey,
} from "../tokens";

/** STARTER's palette as the one legacy :root line the fleet ships today. */
const BASE_LINE =
  ":root{--p1:#4A90D9;--p2:#6B7280;--p3:#A3B8CC;--p4:#D9A44A;--p5:#1F2937}";

const DAWN_SEL = 'html[data-oc-theme="light"]';

/** STARTER with varianted entries grafted onto selected slots. */
const withVarianted = (
  v: Partial<Record<PaletteKey, Partial<Record<TokenComboKey, string>>>>
): BrandTokens => ({
  ...STARTER,
  palette: STARTER.palette.map((s) =>
    v[s.key] ? { ...s, varianted: v[s.key] } : s
  ),
});

describe("emitTokenVars — the no-variance regression anchor", () => {
  it("no varianted data, no overrides → EXACTLY the legacy :root line", () => {
    expect(emitTokenVars(STARTER)).toBe(BASE_LINE);
  });

  it("nightScopes get a full copy of the base palette, last", () => {
    expect(emitTokenVars(STARTER, { nightScopes: [".keep-dark"] })).toBe(
      [
        BASE_LINE,
        ".keep-dark{--p1:#4A90D9;--p2:#6B7280;--p3:#A3B8CC;--p4:#D9A44A;--p5:#1F2937}",
      ].join("\n")
    );
    // several scopes share one comma-listed rule
    expect(
      emitTokenVars(STARTER, { nightScopes: [".keep-dark", ".hold-night"] })
    ).toContain(
      ".keep-dark,.hold-night{--p1:#4A90D9;--p2:#6B7280;--p3:#A3B8CC;--p4:#D9A44A;--p5:#1F2937}"
    );
  });

  it("rootSelector is configurable", () => {
    expect(emitTokenVars(STARTER, { rootSelector: ":host" })).toBe(
      ":host{--p1:#4A90D9;--p2:#6B7280;--p3:#A3B8CC;--p4:#D9A44A;--p5:#1F2937}"
    );
  });
});

describe("emitTokenVars — dawn layers", () => {
  it("a dawn override emits one selector-list rule after the base", () => {
    const t = withVarianted({ p1: { dawn: "#0B3B66" } });
    expect(emitTokenVars(t)).toBe(
      [BASE_LINE, `${DAWN_SEL}{--p1:#0B3B66}`].join("\n")
    );
  });

  it("dawnScopes join the dawn selector list with commas", () => {
    const t = withVarianted({
      p1: { dawn: "#0B3B66" },
      p4: { dawn: "#7A5010" },
    });
    expect(emitTokenVars(t, { dawnScopes: [".theme-dawn"] })).toBe(
      [BASE_LINE, `${DAWN_SEL},.theme-dawn{--p1:#0B3B66;--p4:#7A5010}`].join(
        "\n"
      )
    );
  });

  it("dawnSelector is configurable", () => {
    const t = withVarianted({ p1: { dawn: "#0B3B66" } });
    expect(emitTokenVars(t, { dawnSelector: "[data-theme='light']" })).toBe(
      [BASE_LINE, "[data-theme='light']{--p1:#0B3B66}"].join("\n")
    );
  });
});

describe("emitTokenVars — the full matrix, sortCombos source order", () => {
  it("tablet < dawn < dawn+tablet; screen combos ride @media, keys canonicalize", () => {
    const t = withVarianted({
      // "dawn+tablet" is deliberately NON-canonical — comboKey normalizes
      p1: { dawn: "#111111", tablet: "#222222", "dawn+tablet": "#333333" },
    });
    expect(emitTokenVars(t)).toBe(
      [
        BASE_LINE,
        "@media (min-width: 768px){:root{--p1:#222222}}",
        `${DAWN_SEL}{--p1:#111111}`,
        `@media (min-width: 768px){${DAWN_SEL}{--p1:#333333}}`,
      ].join("\n")
    );
  });

  it("a desktop-only slot override lands in its own media block", () => {
    const t = withVarianted({ p2: { desktop: "#444444" } });
    expect(emitTokenVars(t)).toBe(
      [BASE_LINE, "@media (min-width: 1080px){:root{--p2:#444444}}"].join("\n")
    );
  });

  it("unknown combo keys are IGNORED — forward-only degradation, no throw", () => {
    const t = withVarianted({
      p1: { phone: "#999999", "dawn+weird": "#888888", "": "#777777" },
    });
    expect(emitTokenVars(t)).toBe(BASE_LINE);
  });
});

describe("emitTokenVars — live overrides", () => {
  it("overrides.base beats slot.value in the base layer (and night copies)", () => {
    const css = emitTokenVars(STARTER, {
      overrides: { base: { p1: "#ABCDEF" } },
      nightScopes: [".keep-dark"],
    });
    expect(css).toBe(
      [
        ":root{--p1:#ABCDEF;--p2:#6B7280;--p3:#A3B8CC;--p4:#D9A44A;--p5:#1F2937}",
        ".keep-dark{--p1:#ABCDEF;--p2:#6B7280;--p3:#A3B8CC;--p4:#D9A44A;--p5:#1F2937}",
      ].join("\n")
    );
  });

  it("overrides.varianted beats the cartridge and can add new combos", () => {
    const t = withVarianted({ p1: { dawn: "#111111" } });
    expect(
      emitTokenVars(t, {
        overrides: {
          varianted: { p1: { dawn: "#654321" }, p2: { tablet: "#0F0F0F" } },
        },
      })
    ).toBe(
      [
        BASE_LINE,
        "@media (min-width: 768px){:root{--p2:#0F0F0F}}",
        `${DAWN_SEL}{--p1:#654321}`,
      ].join("\n")
    );
  });

  it("legacy flat overrides ({ p1: hex }) are accepted as base-only", () => {
    expect(emitTokenVars(STARTER, { overrides: { p1: "#ABCDEF" } })).toBe(
      ":root{--p1:#ABCDEF;--p2:#6B7280;--p3:#A3B8CC;--p4:#D9A44A;--p5:#1F2937}"
    );
  });
});

describe("effectivePalette — the resolve()-based read twin", () => {
  const t = withVarianted({
    p1: { dawn: "#111111", tablet: "#222222", "tablet+dawn": "#333333" },
    p2: { dawn: "#555555" },
  });

  it("[] is night: the base values untouched", () => {
    expect(effectivePalette(t, [])).toEqual({
      p1: "#4A90D9",
      p2: "#6B7280",
      p3: "#A3B8CC",
      p4: "#D9A44A",
      p5: "#1F2937",
    });
  });

  it("['dawn'] applies dawn layers, others fall back to night", () => {
    const p = effectivePalette(t, ["dawn"]);
    expect(p.p1).toBe("#111111");
    expect(p.p2).toBe("#555555");
    expect(p.p3).toBe("#A3B8CC"); // no dawn entry — night persists
  });

  it("['dawn','tablet'] stacks tablet < dawn < tablet+dawn", () => {
    const p = effectivePalette(t, ["dawn", "tablet"]);
    expect(p.p1).toBe("#333333"); // the most specific layer wins
    expect(p.p2).toBe("#555555"); // dawn layer carries through
    // tablet-only entry at a dawn+tablet combo: still active (membership)
    const t2 = withVarianted({ p1: { tablet: "#222222" } });
    expect(effectivePalette(t2, ["dawn", "tablet"]).p1).toBe("#222222");
  });

  it("KV overrides beat the cartridge at every layer; legacy flat = base", () => {
    expect(
      effectivePalette(t, ["dawn"], { varianted: { p1: { dawn: "#654321" } } })
        .p1
    ).toBe("#654321");
    expect(effectivePalette(t, [], { base: { p1: "#ABCDEF" } }).p1).toBe(
      "#ABCDEF"
    );
    expect(effectivePalette(t, [], { p1: "#ABCDEF" }).p1).toBe("#ABCDEF");
    // an overridden BASE also feeds dawn fallback for un-varianted slots
    expect(effectivePalette(t, ["dawn"], { p3: "#0000AA" }).p3).toBe("#0000AA");
  });

  it("unknown combo keys are ignored on the read side too", () => {
    const t3 = withVarianted({ p1: { phone: "#999999" } });
    expect(effectivePalette(t3, ["dawn", "tablet"]).p1).toBe("#4A90D9");
  });
});
