import { renderToStaticMarkup } from "react-dom/server";
import { Render } from "@puckeditor/core";
import { createConfig } from "../index";

/**
 * 0.13.0 — Band custom grounds (bgSrc / bgColor), ADDITIVE.
 *
 * Laws proven here:
 *  1. UNTOUCHED PATH — a Band without bgSrc/bgColor renders byte-identical
 *     to the pre-0.13 markup (same as a payload where the keys don't exist).
 *  2. bgSrc → backgroundImage (veil overlay kept, cover/center), ground
 *     class dropped, keep-dark hold behavior preserved.
 *  3. bgColor (no bgSrc) → backgroundColor replaces the hold's ground.
 *  4. bgSrc wins over bgColor when both are set.
 */

const config = createConfig({
  assets: { nebula: "/images/nebula.webp", meteors: "/images/meteors.webp" },
});

const page = (bandProps: Record<string, unknown>) => ({
  root: {},
  content: [
    {
      type: "Band",
      props: {
        id: "ab-0",
        background: "sky-veil",
        hold: "night",
        content: [],
        ...bandProps,
      },
    },
  ],
});

const html = (bandProps: Record<string, unknown>) =>
  renderToStaticMarkup(
    <Render data={page(bandProps) as never} config={config} />
  );

describe("Band untouched path (no bgSrc/bgColor)", () => {
  it("renders byte-identical whether the keys are absent or undefined", () => {
    const absent = html({});
    const explicit = html({ bgSrc: undefined, bgColor: undefined });
    expect(explicit).toBe(absent);
    // the pre-0.13 markup: ground class + keep-dark, no inline background
    expect(absent).toContain("sky-veil");
    expect(absent).toContain("keep-dark");
    expect(absent).not.toContain("background-image");
    expect(absent).not.toContain("background-color");
    expect(absent).toMatchSnapshot();
  });

  it("cartridge photo grounds are unchanged", () => {
    const out = html({ background: "nebula" });
    expect(out).toContain("url(/images/nebula.webp)");
    expect(out).toContain("background-size:cover");
    expect(out).not.toContain("sky-veil");
  });
});

describe("Band bgSrc (custom background image)", () => {
  it("sets backgroundImage with the veil overlay, cover/center", () => {
    const out = html({ bgSrc: "/media/golden-hand.webp" });
    expect(out).toContain("url(/media/golden-hand.webp)");
    expect(out).toContain("linear-gradient(180deg, rgba(14,10,28,.68)");
    expect(out).toContain("background-size:cover");
    expect(out).toContain("background-position:center");
    // custom ground replaces the hold's ground class; hold ink kept
    expect(out).not.toContain("sky-veil");
    expect(out).toContain("keep-dark");
  });

  it("wins over the cartridge photo AND over bgColor", () => {
    const out = html({
      background: "nebula",
      bgSrc: "/media/moon.webp",
      bgColor: "#DBD4E4",
    });
    expect(out).toContain("url(/media/moon.webp)");
    expect(out).not.toContain("nebula.webp");
    expect(out).not.toContain("background-color");
  });
});

describe("Band bgColor (custom color ground)", () => {
  it("replaces the hold ground with backgroundColor", () => {
    const out = html({ bgColor: "#DBD4E4", hold: "theme" });
    expect(out).toContain("background-color:#DBD4E4");
    expect(out).not.toContain("background-image");
    expect(out).not.toContain("sky-veil");
    expect(out).not.toContain("keep-dark");
  });

  it("keeps the keep-dark hold behavior when hold=night", () => {
    const out = html({ bgColor: "rebeccapurple", hold: "night" });
    expect(out).toContain("background-color:rebeccapurple");
    expect(out).toContain("keep-dark");
  });
});
