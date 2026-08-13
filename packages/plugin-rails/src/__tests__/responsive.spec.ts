import { STARTER } from "@pacsarcade/puck-config/tokens";
import { lintPage, type LintContext, type LintData } from "../index";

/**
 * Phase 2 step 2: contrast-min and body-size judge the EFFECTIVE style at
 * base / tablet / desktop for blocks carrying styleVariants — and legacy
 * pages (no styleVariants) keep 0.1.x findings byte-for-byte.
 */

const ctx = (): LintContext => ({ tokens: STARTER, lane: "brand" });

const page = (blocks: LintData["content"]): LintData => ({
  // an h1 up top keeps one-h1 quiet so the rules under test stand alone
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

describe("contrast-min across breakpoints", () => {
  it("a tablet-only failing colour is suffixed ' on tablet' (desktop overridden back)", () => {
    const data = page([
      {
        type: "Text",
        props: {
          id: "t1",
          text: "hello",
          align: "left",
          style: { ...DS }, // base: default colour — fine
          styleVariants: {
            tablet: { color: "white" }, // fails on the dawn ground
            desktop: { color: "ink" }, // overridden back to safe
          },
        },
      },
    ]);

    const findings = lintPage(data, ctx()).filter(
      (f) => f.rule === "contrast-min"
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].blockId).toBe("t1");
    expect(findings[0].message).toBe(
      '"white" is hard to read in light mode here on tablet (body text needs 4.5:1). Pick a stronger colour for this spot.'
    );
  });

  it("an inherited failing colour flags tablet AND desktop", () => {
    const data = page([
      {
        type: "Text",
        props: {
          id: "t2",
          text: "hello",
          align: "left",
          style: { ...DS },
          styleVariants: { tablet: { color: "white" } }, // inherits to desktop
        },
      },
    ]);

    const msgs = lintPage(data, ctx())
      .filter((f) => f.rule === "contrast-min")
      .map((f) => f.message);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toContain(" on tablet ");
    expect(msgs[1]).toContain(" on desktop ");
  });
});

describe("body-size across breakpoints", () => {
  it("a tablet-only tiny size is suffixed ' on tablet'", () => {
    const data = page([
      {
        type: "Text",
        props: {
          id: "t3",
          text: "hello",
          align: "left",
          style: { ...DS },
          styleVariants: {
            tablet: { size: 12 }, // below STARTER's floor of 15
            desktop: { size: 16 },
          },
        },
      },
    ]);

    const findings = lintPage(data, ctx()).filter(
      (f) => f.rule === "body-size"
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toBe(
      "Body text at 12px on tablet is below the brand's smallest size (15px) — hard to read on a phone."
    );
  });
});

describe("legacy pages (no styleVariants) — 0.1.x findings, byte-identical", () => {
  const legacy = (): LintData =>
    page([
      {
        type: "Text",
        props: {
          id: "l1",
          text: "hello",
          align: "left",
          style: { ...DS, color: "white" },
        },
      },
      {
        type: "Text",
        props: {
          id: "l2",
          text: "small",
          align: "left",
          style: { ...DS, size: 12 },
        },
      },
      {
        type: "Text",
        props: {
          id: "l3",
          text: "empty overrides change nothing",
          align: "left",
          style: { ...DS, color: "white" },
          styleVariants: {},
        },
      },
    ]);

  it("emits exactly the 0.1.x messages, no suffixes, one per block", () => {
    const findings = lintPage(legacy(), ctx()).filter(
      (f) => f.rule === "contrast-min" || f.rule === "body-size"
    );

    expect(findings).toEqual([
      {
        rule: "contrast-min",
        severity: "error",
        message:
          '"white" is hard to read in light mode here (body text needs 4.5:1). Pick a stronger colour for this spot.',
        blockId: "l1",
        blockType: "Text",
      },
      {
        rule: "contrast-min",
        severity: "error",
        message:
          '"white" is hard to read in light mode here (body text needs 4.5:1). Pick a stronger colour for this spot.',
        blockId: "l3",
        blockType: "Text",
      },
      {
        rule: "body-size",
        severity: "error",
        message:
          "Body text at 12px is below the brand's smallest size (15px) — hard to read on a phone.",
        blockId: "l2",
        blockType: "Text",
      },
    ]);
  });
});
