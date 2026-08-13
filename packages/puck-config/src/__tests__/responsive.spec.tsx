import { renderToStaticMarkup } from "react-dom/server";
import { Render } from "@puckeditor/core";
import { createConfig } from "../index";

/**
 * The two render-path proofs of Phase 2 step 2:
 *  1. UNTOUCHED-PATH: a page WITHOUT styleVariants renders byte-for-byte
 *     on today's inline path — no generated classes, no <style> tags;
 *  2. override path: a block WITH styleVariants gets classes + a sheet,
 *     and every covered style-system property leaves the inline style.
 */

const config = createConfig({
  assets: { nebula: "/images/nebula.webp", meteors: "/images/meteors.webp" },
});

let i = 0;
const blk = (type: string, props: Record<string, unknown> = {}) => ({
  type,
  props: { id: `ab-${i++}`, ...props },
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
const st = (o: Partial<typeof DS> = {}) => ({ ...DS, ...o });

/** modeled on onecocreation SEEDS.about (band → eyebrow/stacked/text/rich) */
const legacyPage = () => {
  i = 0;
  return {
    root: {},
    content: [
      blk("Band", {
        background: "sky-veil",
        hold: "night",
        content: [
          blk("Eyebrow", {
            text: "Smiles, Love",
            align: "center",
            style: st(),
          }),
          blk("StackedHeading", {
            line1: "MY",
            line2: "STORY",
            tag: "h1",
            align: "center",
            style: st(),
          }),
          blk("Text", {
            text: "A constellation of small kindnesses.",
            align: "center",
            style: st({ kerning: 6, size: 20, spaceAbove: 6 }),
          }),
        ],
      }),
      blk("RichText", {
        html: "I have been a solo adventurer with <b>heart</b>.",
        align: "left",
        style: st(),
      }),
      blk("PullQuote", {
        text: "None of us are here to shrink.",
        align: "center",
        style: st({ color: "ink" }),
      }),
      blk("Button", {
        label: "YES!",
        href: "/packages",
        variant: "gold",
        align: "center",
        style: st(),
      }),
    ],
  };
};

describe("untouched path (no styleVariants)", () => {
  it("renders with NO sv- classes and NO <style> tags", () => {
    const html = renderToStaticMarkup(
      <Render data={legacyPage() as never} config={config} />
    );
    expect(html).not.toContain("sv-");
    expect(html).not.toContain("<style");
    expect(html).toMatchSnapshot();
  });
});

describe("override path (styleVariants present)", () => {
  const page = () => {
    const p = legacyPage();
    // the Text block gains tablet + desktop overrides
    (
      p.content[0].props as unknown as {
        content: { type: string; props: Record<string, unknown> }[];
      }
    ).content[2].props.styleVariants = {
      tablet: { size: 22 },
      desktop: { color: "accent", spaceAbove: 24 },
    };
    return p;
  };

  it("emits classes + a base-first sheet; covered props leave the inline style", () => {
    const html = renderToStaticMarkup(
      <Render data={page() as never} config={config} />
    );

    expect(html).toContain("sv-box-ab-2-");
    expect(html).toContain("sv-typo-ab-2-");

    const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(
      (m) => m[1]
    );
    expect(styles).toHaveLength(1);
    expect(styles[0]).toMatchSnapshot();

    // the sheet's base layer carries Text's hardcoded defaults + base style
    // (base size 20 overwrites the .98rem default WITHIN the base layer)
    expect(styles[0]).toContain("font-size: 20px");
    expect(styles[0]).toContain("line-height: 1.85");
    expect(styles[0]).toContain("letter-spacing: 6px");
    expect(styles[0]).toContain("color: var(--ink-body)");
    expect(styles[0]).toContain("@media (min-width: 768px)");
    expect(styles[0]).toContain("@media (min-width: 1080px)");
    expect(styles[0]).not.toContain("!important");

    // the overridden block's <p> carries NO inline style attribute at all
    const p = html.match(/<p class="sv-box[^"]*"[^>]*>/);
    expect(p).not.toBeNull();
    expect(p![0]).not.toContain("style=");

    // sibling blocks stay on the inline path
    expect(html).toContain('<span class="kicker"');
  });

  it("an empty styleVariants object still takes the untouched path", () => {
    const p = legacyPage();
    (p.content[1].props as Record<string, unknown>).styleVariants = {};
    const html = renderToStaticMarkup(
      <Render data={p as never} config={config} />
    );
    expect(html).not.toContain("sv-");
    expect(html).not.toContain("<style");
  });
});
