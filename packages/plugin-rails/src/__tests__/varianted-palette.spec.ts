import { STARTER } from "@pacsarcade/puck-config/tokens";
import { lintPage, type LintContext, type LintData } from "../index";

/**
 * Phase 2 step 5 (varianted tokens): contrast-min judges palette slots
 * per theme when ctx.paletteDawn carries the effective dawn hexes — and
 * WITHOUT paletteDawn, findings stay byte-identical to 0.2.x (the dawn
 * check falls back to the night hex, exactly as before).
 */

const page = (blocks: LintData["content"]): LintData => ({
  // an h1 up top keeps one-h1 quiet so the rule under test stands alone
  content: [
    { type: "Heading", props: { id: "h", text: "Title", level: "h1" } },
    ...blocks,
  ],
});

const DS = {
  font: "default",
  size: 0,
  kerning: 0,
  lineHeight: 0,
  color: "default",
  spaceAbove: 0,
  spaceBelow: 0,
};

const p1Text = (id: string): LintData["content"][number] => ({
  type: "Text",
  props: { id, text: "hello", align: "left", style: { ...DS, color: "p1" } },
});

const contrast = (data: LintData, ctx: LintContext) =>
  lintPage(data, ctx).filter((f) => f.rule === "contrast-min");

describe("contrast-min with paletteDawn (per-theme slot hexes)", () => {
  // #F2F2F2 passes the night ground (16.46:1) but fails the dawn ground —
  // the classic dark-first slot that NEEDS a dawn variant.
  const NIGHT_HEX = "#F2F2F2";

  it("a good dawn hex REPAIRS the dawn verdict (night judged by night hex)", () => {
    const data = page([p1Text("t1")]);
    const ctx: LintContext = {
      tokens: STARTER,
      lane: "brand",
      palette: { p1: NIGHT_HEX },
      paletteDawn: { p1: "#26262B" }, // 14.41:1 on the dawn ground
    };
    expect(contrast(data, ctx)).toEqual([]);
    // control: the SAME palette without paletteDawn fails in light mode,
    // proving the dawn hex is what flipped the verdict
    expect(
      contrast(data, {
        tokens: STARTER,
        lane: "brand",
        palette: { p1: NIGHT_HEX },
      })
    ).toHaveLength(1);
  });

  it("passes night / fails dawn when paletteDawn provides a failing dawn hex", () => {
    const data = page([p1Text("t2")]);
    const ctx: LintContext = {
      tokens: STARTER,
      lane: "brand",
      palette: { p1: NIGHT_HEX },
      paletteDawn: { p1: "#FFFFFF" }, // 1.05:1 on the dawn ground
    };
    const findings = contrast(data, ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].blockId).toBe("t2");
    expect(findings[0].message).toBe(
      '"p1" is hard to read in light mode here (body text needs 4.5:1). Pick a stronger colour for this spot.'
    );
  });

  it("keep-dark bands still judge the NIGHT hex in both themes", () => {
    // paletteDawn.p1 equals the night ground — 1:1, invisible — so any
    // wrongful dawn-hex read on the forced-night ground would flag.
    const data = page([
      {
        type: "Band",
        props: { id: "b1", hold: "night", content: [p1Text("t3")] },
      },
    ]);
    const ctx: LintContext = {
      tokens: STARTER,
      lane: "brand",
      palette: { p1: NIGHT_HEX },
      paletteDawn: { p1: STARTER.grounds.night },
    };
    expect(contrast(data, ctx)).toEqual([]);
  });

  it("slots absent from paletteDawn fall back to the night hex", () => {
    const data = page([p1Text("t4")]);
    const ctx: LintContext = {
      tokens: STARTER,
      lane: "brand",
      palette: { p1: NIGHT_HEX },
      paletteDawn: {}, // no p1 entry — behaves exactly like 0.2.x
    };
    expect(contrast(data, ctx)).toHaveLength(1);
  });
});

describe("absent paletteDawn — 0.2.x findings, byte-identical", () => {
  it("emits exactly the pre-varianted finding set", () => {
    const data = page([p1Text("l1")]);
    const findings = lintPage(data, {
      tokens: STARTER,
      lane: "brand",
      palette: { p1: "#F2F2F2" },
    });
    expect(findings).toEqual([
      {
        rule: "contrast-min",
        severity: "error",
        message:
          '"p1" is hard to read in light mode here (body text needs 4.5:1). Pick a stronger colour for this spot.',
        blockId: "l1",
        blockType: "Text",
      },
    ]);
  });
});
