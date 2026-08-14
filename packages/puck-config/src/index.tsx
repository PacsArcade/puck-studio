import type { ReactElement } from "react";
import type { Config, Slot } from "@puckeditor/core";
import { STARTER, colorCss, fontCss, type BrandTokens } from "./tokens";
import {
  DEFAULT_STYLE,
  type Align,
  type FontKey,
  type StyleProps,
  type StyleVariants,
} from "./responsive/schema";
import { styleVariantsCss, type BlockStyleDefaults } from "./responsive/css";
import { UnifiedStyleField } from "./responsive/field";

/**
 * Puck config -- the house palette (P3/P3.5), alignment + labels (P5), and
 * now the STYLE INSPECTOR (P6, Admiral 2026-08-11: "how can i change font or
 * sizing spacing kern, height, colors"). Every text block carries a `style`
 * object field -- font / size / kerning / line-height / colour / spacing --
 * so an operator can tune type the way they'd expect, on-brand (colours and fonts
 * are house tokens, not arbitrary hex). Plus starter layout blocks: Spacer,
 * Divider, Two columns.
 *
 * Every block's render emits the site's OWN classes (house.css), so a page
 * wears the real shimmer/glass/headings on the studio canvas AND in the live
 * <Render> at /p/<slug> and (P4) on /about itself.
 *
 * Rules:
 *  - KEEP IN LOCKSTEP with src/lib/copilot.ts COMPONENTS.
 *  - NEVER use the .reveal class here (its scroll-observer doesn't run in
 *    Puck render -> content would stay invisible).
 *  - Style tokens stay on-brand: font maps to the house trio, colour to
 *    house palette tokens.
 */

// -- style inspector shared bits --------------------------------------------
// Align / FontKey / StyleProps / DEFAULT_STYLE live in responsive/schema.ts
// (Phase 2 step 2) so the responsive layer shares one definition; the shapes
// are byte-identical to what lived here.
export type { Align, FontKey, StyleProps, StyleVariants };

/* The href picker hosts close over their LinkFieldSources and hand back
   in via createConfig({ linkField }) — same DI shape as mediaField. */
export {
  LinkPickerField,
  type LinkFieldSources,
  type LinkPickerFieldProps,
} from "./link-field";

/* Font and colour resolution reads the brand's TOKENS (Phase 1 step 1).
   Values come entirely from the brand cartridge the host passes in --
   zero behavior change -- but the registry is brand-ready: pass another
   BrandTokens via createConfig and every block follows. */
const DEFAULT_TOKENS: BrandTokens = STARTER;
let ACTIVE_TOKENS: BrandTokens = DEFAULT_TOKENS;

/* Slot allow-lists (Phase 1 step 3, the Rails Spec matrix) -- enforced by
   Puck AT DROP TIME: a rejected block simply cannot land in the slot.
   Full-width blocks (Band, Hero) are disallowed in every nested slot, which
   makes them root-only by construction. Panel accepts content, not layout
   (no Panel/Columns nesting). Columns-in-columns stays allowed here -- the
   matrix grades it "warn", which is lint's job (step 4), not the drop's.
   Depth cap 3 is also lint's (it needs tree context a slot can't see). */
const NO_FULL_WIDTH = ["Band", "Hero"];
const PANEL_DISALLOW = [
  ...NO_FULL_WIDTH,
  "Panel",
  "TwoColumns",
  "ThreeColumns",
];

/* The Style Inspector field (Phase 2 step 4): ONE custom field hosted on
   the `style` prop — the UnifiedStyleField. It edits the base (phone)
   layer through its own onChange and tablet/desktop overrides through a
   sibling replace dispatch into styleVariants, with a provenance dot per
   control. The old two-field pair (object field + dead-end message) is
   gone from the editor; the PAYLOAD is unchanged (`style` dense,
   `styleVariants` sparse & optional). */

/** typography overrides for the element (size 0 / line-height 0 = inherit).
 *  KEEP IN LOCKSTEP with responsive/css.ts typoDecls (its decl-record twin). */
function typo(s?: StyleProps): React.CSSProperties {
  const c: React.CSSProperties = {};
  if (!s) return c;
  if (s.font && s.font !== "default")
    c.fontFamily = fontCss(ACTIVE_TOKENS, s.font);
  if (s.size) c.fontSize = `${s.size}px`;
  if (s.kerning) c.letterSpacing = `${s.kerning}px`;
  if (s.lineHeight) c.lineHeight = s.lineHeight;
  if (s.color && s.color !== "default")
    c.color = colorCss(ACTIVE_TOKENS, s.color);
  return c;
}
/** the wrapper: alignment + vertical spacing.
 *  KEEP IN LOCKSTEP with responsive/css.ts boxDecls (its decl-record twin). */
function box(align: Align, s?: StyleProps): React.CSSProperties {
  const c: React.CSSProperties = { textAlign: align };
  if (s?.spaceAbove) c.marginTop = `${s.spaceAbove}px`;
  if (s?.spaceBelow) c.marginBottom = `${s.spaceBelow}px`;
  return c;
}

/* Hardcoded inline defaults of styled blocks, as decl records. When a block
   carries styleVariants these move INTO the generated sheet's base layer
   (inline styles beat stylesheets — an override could never win otherwise).
   Values are byte-identical to the inline path's. */
const TEXT_DEFAULTS: BlockStyleDefaults = {
  typo: {
    color: "var(--ink-body)",
    "font-size": ".98rem",
    "line-height": "1.85",
  },
};
const QUOTE_DEFAULTS: BlockStyleDefaults = { box: { margin: "0" } };

/** ONE registry of every styled block's hardcoded defaults (Phase 2
 *  step 4): render paths read their decl records from here, and the
 *  provenance layer reads it to tell "block default" from "brand default".
 *  A block absent from this record has no hardcoded style-system decls. */
export const BLOCK_STYLE_DEFAULTS: Record<string, BlockStyleDefaults> = {
  Text: TEXT_DEFAULTS,
  RichText: TEXT_DEFAULTS,
  Quote: QUOTE_DEFAULTS,
};

const ALIGN_FIELD = {
  type: "select" as const,
  options: [
    { label: "Left", value: "left" },
    { label: "Center", value: "center" },
    { label: "Right", value: "right" },
  ],
};

// -- prop types -------------------------------------------------------------
/* Styled blocks additionally carry OPTIONAL screen overrides (Phase 2
   step 2). `id` is Puck's injected block id — the CSS class seed. Absent
   styleVariants = today's exact inline render (untouched-path law). */
type Styled = { styleVariants?: StyleVariants };
type EyebrowProps = { text: string; align: Align; style: StyleProps } & Styled;
type HeadingProps = {
  text: string;
  level: "h1" | "h2" | "h3";
  align: Align;
  style: StyleProps;
} & Styled;
type StackedHeadingProps = {
  line1: string;
  line2: string;
  tag: "h1" | "h2";
  align: Align;
  style: StyleProps;
} & Styled;
type TextProps = { text: string; align: Align; style: StyleProps } & Styled;
type RichTextProps = { html: string; align: Align; style: StyleProps } & Styled;
type PullQuoteProps = {
  text: string;
  align: Align;
  style: StyleProps;
} & Styled;
type ButtonProps = {
  label: string;
  href: string;
  variant: "gold" | "rose" | "teal" | "quiet";
  align: Align;
  style: StyleProps;
} & Styled;
type QuoteProps = {
  quote: string;
  who: string;
  align: Align;
  style: StyleProps;
} & Styled;
type GoldButtonProps = { label: string; href: string };
type CardProps = { title: string; body: string };
type HeroProps = { days: string; title: string; sub: string };
type NoteProps = { text: string };
type ImageProps = {
  src: string;
  alt: string;
  width: number;
  radius: "none" | "soft" | "round";
  align: Align;
};
type GalleryProps = {
  images: { src: string; alt: string }[];
  tilt: "yes" | "no";
};
type VideoProps = { youtube: string; ratio: "16/9" | "9/16" };
type BandProps = {
  background:
    | "sky-veil"
    | "sky-glass"
    | "sky-warm"
    | "nebula"
    | "meteors"
    | "plain";
  hold: "night" | "theme";
  content: Slot;
};
type SpacerProps = { height: number };
type DividerProps = { width: number };
type TwoColumnsProps = {
  gap: number;
  valign: "top" | "center";
  left: Slot;
  right: Slot;
};
type ThreeColumnsProps = {
  gap: number;
  valign: "top" | "center";
  a: Slot;
  b: Slot;
  c: Slot;
};
type ButtonsProps = {
  align: Align;
  buttons: {
    label: string;
    href: string;
    variant: "gold" | "rose" | "teal" | "quiet";
  }[];
};
type PanelProps = { content: Slot };
type ListProps = {
  items: { text: string }[];
  marker: "dot" | "check" | "none";
  align: Align;
};
type FaqProps = { items: { q: string; a: string }[] };

export type OcPuckConfig = Config<{
  Eyebrow: EyebrowProps;
  Heading: HeadingProps;
  StackedHeading: StackedHeadingProps;
  Text: TextProps;
  RichText: RichTextProps;
  PullQuote: PullQuoteProps;
  Button: ButtonProps;
  Quote: QuoteProps;
  GoldButton: GoldButtonProps;
  Card: CardProps;
  Hero: HeroProps;
  Note: NoteProps;
  Image: ImageProps;
  Gallery: GalleryProps;
  Video: VideoProps;
  Band: BandProps;
  Spacer: SpacerProps;
  Divider: DividerProps;
  TwoColumns: TwoColumnsProps;
  ThreeColumns: ThreeColumnsProps;
  Buttons: ButtonsProps;
  Panel: PanelProps;
  List: ListProps;
  Faq: FaqProps;
}>;

function ytId(v: string): string {
  const s = (v || "").trim();
  const m = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{6,})/);
  return m ? m[1] : s;
}

export interface PuckConfigOptions {
  /** brand background photos consumed by the Band block */
  assets: { nebula: string; meteors: string };
  /** the brand's design tokens; defaults to the neutral STARTER cartridge */
  tokens?: BrandTokens;
  /** host-provided media picker (upload + library browser) for image URL
   *  fields; falls back to a plain text field when absent */
  mediaField?: (props: {
    value: string;
    onChange: (v: string) => void;
  }) => ReactElement;
  /** host-provided link picker (typically LinkPickerField closed over the
   *  host's LinkFieldSources) for href fields — Button, GoldButton and the
   *  Buttons row items; falls back to a plain text field when absent.
   *  PAYLOAD UNCHANGED: href stays a plain string. */
  linkField?: (props: {
    value: string;
    onChange: (v: string) => void;
  }) => ReactElement;
}

/** The library rail's logical order (Puck renders these as collapsible
 *  groups). Legacy blocks stay registered (old pages render) but hidden
 *  from the rail. */
const CATEGORIES = {
  text: {
    title: "Text",
    components: [
      "Heading",
      "StackedHeading",
      "Text",
      "RichText",
      "Eyebrow",
      "PullQuote",
      "Quote",
      "List",
      "Faq",
    ],
    defaultExpanded: true,
  },
  actions: {
    title: "Actions",
    components: ["Button", "Buttons"],
    defaultExpanded: true,
  },
  media: {
    title: "Media",
    components: ["Image", "Gallery", "Video"],
    defaultExpanded: false,
  },
  layout: {
    title: "Layout",
    components: [
      "Band",
      "Panel",
      "TwoColumns",
      "ThreeColumns",
      "Hero",
      "Note",
      "Card",
      "Spacer",
      "Divider",
    ],
    defaultExpanded: false,
  },
  other: { title: "Legacy", components: ["GoldButton"], visible: false },
} as const;

export function createConfig(opts: PuckConfigOptions): OcPuckConfig {
  const NEBULA = opts.assets.nebula;
  const METEORS = opts.assets.meteors;
  ACTIVE_TOKENS = opts.tokens ?? DEFAULT_TOKENS;
  const TOKENS = ACTIVE_TOKENS;
  /* The self-explaining inspector (Phase 2 step 4): `style` hosts the
     UnifiedStyleField (which also WRITES the styleVariants sibling via a
     replace dispatch), so the styleVariants field itself is registered
     but INVISIBLE — visible:false is honored by core's isFieldVisible,
     and the prop keeps flowing through data/render untouched. NO
     defaultProps entry anywhere: a block only carries styleVariants once
     an operator writes one. */
  const styleFieldFor = (blockType: string) => ({
    type: "custom" as const,
    label: "Style",
    render: (p: {
      value: StyleProps;
      onChange: (value: StyleProps) => void;
    }) => <UnifiedStyleField {...p} tokens={TOKENS} blockType={blockType} />,
  });
  const STYLE_VARIANTS_FIELD = {
    type: "custom" as const,
    visible: false,
    render: () => <></>,
  };
  /** shorthand: the block's generated sheet, or null → inline path */
  const sv = (
    id: string | undefined,
    align: Align,
    style: StyleProps | undefined,
    styleVariants: StyleVariants | undefined,
    blockDefaults?: BlockStyleDefaults
  ) =>
    styleVariantsCss(
      id ?? "",
      align,
      style,
      styleVariants,
      TOKENS,
      blockDefaults
    );
  const SRC_FIELD = opts.mediaField
    ? ({ type: "custom" as const, render: opts.mediaField } as const)
    : ({ type: "text" as const } as const);
  /* the mediaField DI pattern, verbatim, for hrefs — custom fields work
     inside arrayFields too (SRC_FIELD proves it in Gallery.images). */
  const LINK_FIELD = opts.linkField
    ? ({ type: "custom" as const, render: opts.linkField } as const)
    : ({ type: "text" as const } as const);
  return {
    categories: CATEGORIES as unknown as OcPuckConfig["categories"],
    components: {
      Eyebrow: {
        label: "Eyebrow label",
        fields: {
          text: { type: "text" },
          align: ALIGN_FIELD,
          style: styleFieldFor("Eyebrow"),
          styleVariants: STYLE_VARIANTS_FIELD,
        },
        defaultProps: {
          text: "A small gold label",
          align: "left",
          style: DEFAULT_STYLE,
        },
        render: ({
          id,
          text,
          align,
          style,
          styleVariants,
        }: EyebrowProps & { id?: string }) => {
          const rsp = sv(id, align, style, styleVariants);
          if (!rsp)
            return (
              <div style={box(align, style)}>
                <span
                  className="kicker"
                  style={{ display: "inline-block", ...typo(style) }}
                >
                  {text}
                </span>
              </div>
            );
          return (
            <div className={rsp.boxClass}>
              <style dangerouslySetInnerHTML={{ __html: rsp.cssText }} />
              <span
                className={`kicker ${rsp.typoClass}`}
                style={{ display: "inline-block" }}
              >
                {text}
              </span>
            </div>
          );
        },
      },

      Heading: {
        label: "Heading",
        fields: {
          text: { type: "text" },
          level: {
            type: "select",
            options: [
              { label: "H1 - page title", value: "h1" },
              { label: "H2 - section", value: "h2" },
              { label: "H3 - sub-section", value: "h3" },
            ],
          },
          align: ALIGN_FIELD,
          style: styleFieldFor("Heading"),
          styleVariants: STYLE_VARIANTS_FIELD,
        },
        defaultProps: {
          text: "Heading",
          level: "h2",
          align: "left",
          style: DEFAULT_STYLE,
        },
        render: ({
          id,
          text,
          level,
          align,
          style,
          styleVariants,
        }: HeadingProps & { id?: string }) => {
          const Tag = level;
          const rsp = sv(id, align, style, styleVariants);
          if (!rsp)
            return (
              <div style={box(align, style)}>
                <Tag
                  className="sec-h"
                  style={{ display: "inline-block", ...typo(style) }}
                >
                  {text}
                </Tag>
              </div>
            );
          return (
            <div className={rsp.boxClass}>
              <style dangerouslySetInnerHTML={{ __html: rsp.cssText }} />
              <Tag
                className={`sec-h ${rsp.typoClass}`}
                style={{ display: "inline-block" }}
              >
                {text}
              </Tag>
            </div>
          );
        },
      },

      StackedHeading: {
        label: "Stacked heading",
        fields: {
          line1: { type: "text" },
          line2: { type: "text" },
          tag: {
            type: "select",
            options: [
              { label: "H1", value: "h1" },
              { label: "H2", value: "h2" },
            ],
          },
          align: ALIGN_FIELD,
          style: styleFieldFor("StackedHeading"),
          styleVariants: STYLE_VARIANTS_FIELD,
        },
        defaultProps: {
          line1: "MY",
          line2: "STORY",
          tag: "h1",
          align: "left",
          style: DEFAULT_STYLE,
        },
        render: ({
          id,
          line1,
          line2,
          tag,
          align,
          style,
          styleVariants,
        }: StackedHeadingProps & { id?: string }) => {
          const Tag = tag;
          const rsp = sv(id, align, style, styleVariants);
          if (!rsp)
            return (
              <div style={box(align, style)}>
                <Tag
                  className="stack-hero"
                  style={{
                    display: "inline-block",
                    textAlign: align,
                    ...typo(style),
                  }}
                >
                  <span
                    className="sh-ink"
                    style={{ color: "var(--ink-strong)" }}
                  >
                    {line1}
                  </span>
                  <span className="sh-teal">{line2}</span>
                </Tag>
              </div>
            );
          /* inner textAlign stays inline: align is not a varianted prop,
             so it can never mask an override */
          return (
            <div className={rsp.boxClass}>
              <style dangerouslySetInnerHTML={{ __html: rsp.cssText }} />
              <Tag
                className={`stack-hero ${rsp.typoClass}`}
                style={{ display: "inline-block", textAlign: align }}
              >
                <span className="sh-ink" style={{ color: "var(--ink-strong)" }}>
                  {line1}
                </span>
                <span className="sh-teal">{line2}</span>
              </Tag>
            </div>
          );
        },
      },

      Text: {
        label: "Text",
        fields: {
          text: { type: "textarea" },
          align: ALIGN_FIELD,
          style: styleFieldFor("Text"),
          styleVariants: STYLE_VARIANTS_FIELD,
        },
        defaultProps: {
          text: "Body copy goes here.",
          align: "left",
          style: DEFAULT_STYLE,
        },
        render: ({
          id,
          text,
          align,
          style,
          styleVariants,
        }: TextProps & { id?: string }) => {
          const rsp = sv(
            id,
            align,
            style,
            styleVariants,
            BLOCK_STYLE_DEFAULTS.Text
          );
          if (!rsp)
            return (
              <p
                style={{
                  color: "var(--ink-body)",
                  fontSize: ".98rem",
                  lineHeight: 1.85,
                  ...box(align, style),
                  ...typo(style),
                }}
              >
                {text}
              </p>
            );
          return (
            <>
              <style dangerouslySetInnerHTML={{ __html: rsp.cssText }} />
              <p className={`${rsp.boxClass} ${rsp.typoClass}`}>{text}</p>
            </>
          );
        },
      },

      /* RichText -- prose with inline emphasis/colour. Renders the html field
       directly: Puck writes are operator-gated (site operators only), trusted CMS
       content. Allowed inline: <b> <i> <br> and <span style="color:..."> */
      RichText: {
        label: "Rich text",
        fields: {
          html: { type: "textarea" },
          align: ALIGN_FIELD,
          style: styleFieldFor("RichText"),
          styleVariants: STYLE_VARIANTS_FIELD,
        },
        defaultProps: {
          html: 'A paragraph with <b style="color:var(--teal-bright)">emphasis</b>.',
          align: "left",
          style: DEFAULT_STYLE,
        },
        render: ({
          id,
          html,
          align,
          style,
          styleVariants,
        }: RichTextProps & { id?: string }) => {
          const rsp = sv(
            id,
            align,
            style,
            styleVariants,
            BLOCK_STYLE_DEFAULTS.RichText
          );
          if (!rsp)
            return (
              <p
                style={{
                  color: "var(--ink-body)",
                  fontSize: ".98rem",
                  lineHeight: 1.85,
                  ...box(align, style),
                  ...typo(style),
                }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          return (
            <>
              <style dangerouslySetInnerHTML={{ __html: rsp.cssText }} />
              <p
                className={`${rsp.boxClass} ${rsp.typoClass}`}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </>
          );
        },
      },

      PullQuote: {
        label: "Pull-quote",
        fields: {
          text: { type: "textarea" },
          align: ALIGN_FIELD,
          style: styleFieldFor("PullQuote"),
          styleVariants: STYLE_VARIANTS_FIELD,
        },
        defaultProps: {
          text: "A line worth pausing on, in her voice.",
          align: "center",
          style: DEFAULT_STYLE,
        },
        render: ({
          id,
          text,
          align,
          style,
          styleVariants,
        }: PullQuoteProps & { id?: string }) => {
          const rsp = sv(id, align, style, styleVariants);
          if (!rsp)
            return (
              <p
                className="pull-quote"
                style={{ ...box(align, style), ...typo(style) }}
              >
                {text}
              </p>
            );
          return (
            <>
              <style dangerouslySetInnerHTML={{ __html: rsp.cssText }} />
              <p className={`pull-quote ${rsp.boxClass} ${rsp.typoClass}`}>
                {text}
              </p>
            </>
          );
        },
      },

      Button: {
        label: "Button",
        fields: {
          label: { type: "text" },
          href: LINK_FIELD,
          variant: {
            type: "select",
            options: [
              { label: "Gold (primary)", value: "gold" },
              { label: "Rose", value: "rose" },
              { label: "Teal", value: "teal" },
              { label: "Quiet (text link)", value: "quiet" },
            ],
          },
          align: ALIGN_FIELD,
          style: styleFieldFor("Button"),
          styleVariants: STYLE_VARIANTS_FIELD,
        },
        defaultProps: {
          label: "Book a reading",
          href: "/book",
          variant: "gold",
          align: "left",
          style: DEFAULT_STYLE,
        },
        render: ({
          id,
          label,
          href,
          variant,
          align,
          style,
          styleVariants,
        }: ButtonProps & { id?: string }) => {
          const cls =
            variant === "quiet"
              ? "btn-quiet btn-quiet--gold"
              : `btn btn-${variant}`;
          const rsp = sv(id, align, style, styleVariants);
          if (!rsp)
            return (
              <div style={box(align, style)}>
                <a href={href} className={cls} style={typo(style)}>
                  {label}
                </a>
              </div>
            );
          return (
            <div className={rsp.boxClass}>
              <style dangerouslySetInnerHTML={{ __html: rsp.cssText }} />
              <a href={href} className={`${cls} ${rsp.typoClass}`}>
                {label}
              </a>
            </div>
          );
        },
      },

      Quote: {
        label: "Testimonial",
        fields: {
          quote: { type: "textarea" },
          who: { type: "text" },
          align: ALIGN_FIELD,
          style: styleFieldFor("Quote"),
          styleVariants: STYLE_VARIANTS_FIELD,
        },
        defaultProps: {
          quote: "Something a client said, in their words.",
          who: "- a client",
          align: "left",
          style: DEFAULT_STYLE,
        },
        render: ({
          id,
          quote,
          who,
          align,
          style,
          styleVariants,
        }: QuoteProps & { id?: string }) => {
          const rsp = sv(
            id,
            align,
            style,
            styleVariants,
            BLOCK_STYLE_DEFAULTS.Quote
          );
          if (!rsp)
            return (
              <figure
                style={{ margin: 0, maxWidth: 640, ...box(align, style) }}
              >
                <blockquote
                  className="voice-quote"
                  style={{ margin: 0, ...typo(style) }}
                >
                  {quote}
                </blockquote>
                <figcaption className="voice-who" style={{ marginTop: 8 }}>
                  {who}
                </figcaption>
              </figure>
            );
          /* figure margin:0 moved into the sheet's base layer (QUOTE_DEFAULTS)
             so spaceAbove/Below overrides can win; maxWidth is not a
             style-system property and stays inline */
          return (
            <figure className={rsp.boxClass} style={{ maxWidth: 640 }}>
              <style dangerouslySetInnerHTML={{ __html: rsp.cssText }} />
              <blockquote
                className={`voice-quote ${rsp.typoClass}`}
                style={{ margin: 0 }}
              >
                {quote}
              </blockquote>
              <figcaption className="voice-who" style={{ marginTop: 8 }}>
                {who}
              </figcaption>
            </figure>
          );
        },
      },

      GoldButton: {
        label: "Gold button (legacy)",
        fields: { label: { type: "text" }, href: LINK_FIELD },
        defaultProps: { label: "Learn more", href: "#" },
        render: ({ label, href }: GoldButtonProps) => (
          <a href={href} className="btn btn-gold">
            {label}
          </a>
        ),
      },

      Card: {
        label: "Card",
        fields: { title: { type: "text" }, body: { type: "textarea" } },
        defaultProps: {
          title: "A card title",
          body: "A sentence or two on the glass.",
        },
        render: ({ title, body }: CardProps) => (
          <div className="card" style={{ maxWidth: 420 }}>
            <div className="body">
              <h3
                className="sec-h"
                style={{ fontSize: "1.35rem", marginBottom: ".5rem" }}
              >
                {title}
              </h3>
              <p
                style={{
                  color: "var(--ink-body)",
                  fontSize: ".95rem",
                  lineHeight: 1.7,
                }}
              >
                {body}
              </p>
            </div>
          </div>
        ),
      },

      Hero: {
        label: "Hero band",
        fields: {
          days: { type: "text" },
          title: { type: "text" },
          sub: { type: "text" },
        },
        defaultProps: {
          days: "Your kicker line",
          title: "Your headline",
          sub: "A sentence about what you do",
        },
        render: ({ days, title, sub }: HeroProps) => (
          <section className="hero" style={{ padding: "60px 0 56px" }}>
            <div className="inner">
              <p className="days">{days}</p>
              <h1>{title}</h1>
              <p className="sub">{sub}</p>
            </div>
          </section>
        ),
      },

      Note: {
        label: "Note",
        fields: { text: { type: "textarea" } },
        defaultProps: { text: "A gentle note on soft glass." },
        render: ({ text }: NoteProps) => <div className="note">{text}</div>,
      },

      Image: {
        label: "Image",
        fields: {
          src: SRC_FIELD,
          alt: { type: "text" },
          width: { type: "number" },
          radius: {
            type: "select",
            options: [
              { label: "Square", value: "none" },
              { label: "Soft", value: "soft" },
              { label: "Round card", value: "round" },
            ],
          },
          align: ALIGN_FIELD,
        },
        defaultProps: {
          src: "",
          alt: "",
          width: 320,
          radius: "soft",
          align: "left",
        },
        render: ({ src, alt, width, radius, align }: ImageProps) => {
          const br = radius === "round" ? 22 : radius === "soft" ? 12 : 0;
          return (
            <div style={{ textAlign: align }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt}
                style={{
                  width,
                  maxWidth: "100%",
                  borderRadius: br,
                  display: "inline-block",
                }}
              />
            </div>
          );
        },
      },

      Gallery: {
        label: "Gallery",
        fields: {
          tilt: {
            type: "select",
            options: [
              { label: "Tilted", value: "yes" },
              { label: "Flat", value: "no" },
            ],
          },
          images: {
            type: "array",
            arrayFields: { src: SRC_FIELD, alt: { type: "text" } },
          },
        },
        defaultProps: {
          tilt: "yes",
          images: [],
        },
        render: ({ images, tilt }: GalleryProps) => (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            {(images || []).map((im, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={im.src}
                alt={im.alt || ""}
                style={{
                  width: 190,
                  height: 240,
                  objectFit: "cover",
                  borderRadius: 22,
                  border: "1px solid rgba(255,255,255,.5)",
                  boxShadow: "0 26px 60px -20px rgba(10,8,30,.6)",
                  transform:
                    tilt === "yes"
                      ? `rotate(${(i - 1) * 4}deg) translateY(${
                          i === 1 ? -10 : 6
                        }px)`
                      : "none",
                }}
              />
            ))}
          </div>
        ),
      },

      Video: {
        label: "Video",
        fields: {
          youtube: { type: "text" },
          ratio: {
            type: "select",
            options: [
              { label: "Landscape 16:9", value: "16/9" },
              { label: "Portrait 9:16", value: "9/16" },
            ],
          },
        },
        defaultProps: { youtube: "", ratio: "9/16" },
        render: ({ youtube, ratio }: VideoProps) => {
          const id = ytId(youtube);
          const w = ratio === "9/16" ? "min(300px, 88%)" : "min(640px, 96%)";
          return (
            <div
              style={{
                position: "relative",
                width: w,
                aspectRatio: ratio,
                margin: "0 auto",
                borderRadius: 22,
                overflow: "hidden",
                boxShadow: "0 26px 60px -24px rgba(35,26,60,.55)",
              }}
            >
              {id ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${id}`}
                  title="Video"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    border: 0,
                  }}
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(139,118,196,.15)",
                    color: "var(--muted)",
                    fontSize: 13,
                  }}
                >
                  paste a YouTube link
                </div>
              )}
            </div>
          );
        },
      },

      /* Band -- a full-width background section that NESTS other blocks (slot).
       This is how /about's sky sections come across. "Hold the night" keeps
       the band dark even in light theme (the .keep-dark trick). */
      Band: {
        label: "Band (background section)",
        fields: {
          background: {
            type: "select",
            options: [
              { label: "Night veil", value: "sky-veil" },
              { label: "Night glass", value: "sky-glass" },
              { label: "Warm night", value: "sky-warm" },
              { label: "Nebula photo", value: "nebula" },
              { label: "Meteors photo", value: "meteors" },
              { label: "Plain", value: "plain" },
            ],
          },
          hold: {
            type: "select",
            options: [
              { label: "Hold the night", value: "night" },
              { label: "Follow theme", value: "theme" },
            ],
          },
          content: { type: "slot", disallow: NO_FULL_WIDTH },
        },
        defaultProps: { background: "sky-glass", hold: "theme", content: [] },
        render: ({ background, hold, content: Content }) => {
          const photo =
            background === "nebula"
              ? NEBULA
              : background === "meteors"
              ? METEORS
              : null;
          const veil =
            "linear-gradient(180deg, rgba(14,10,28,.68), rgba(14,10,28,.78))";
          const style: React.CSSProperties = { padding: "60px 0" };
          if (photo) {
            style.backgroundImage = `${veil}, url(${photo})`;
            style.backgroundSize = "cover";
            style.backgroundPosition = "center";
          }
          const cls = [
            photo ? "" : background === "plain" ? "" : background,
            hold === "night" ? "keep-dark" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <section className={cls} style={style}>
              <div className="wrap" style={{ maxWidth: 680, margin: "0 auto" }}>
                <Content />
              </div>
            </section>
          );
        },
      },

      Spacer: {
        label: "Spacer",
        fields: { height: { type: "number" } },
        defaultProps: { height: 40 },
        render: ({ height }: SpacerProps) => (
          <div aria-hidden style={{ height }} />
        ),
      },

      Divider: {
        label: "Divider",
        fields: { width: { type: "number" } },
        defaultProps: { width: 220 },
        render: ({ width }: DividerProps) => (
          <div
            aria-hidden
            style={{
              height: 1.5,
              width: `${width}px`,
              maxWidth: "100%",
              margin: "26px auto",
              background:
                "linear-gradient(90deg, transparent, var(--gold-deep), transparent)",
            }}
          />
        ),
      },

      TwoColumns: {
        label: "Two columns",
        fields: {
          gap: { type: "number" },
          valign: {
            type: "select",
            options: [
              { label: "Top", value: "top" },
              { label: "Center", value: "center" },
            ],
          },
          left: { type: "slot", disallow: NO_FULL_WIDTH },
          right: { type: "slot", disallow: NO_FULL_WIDTH },
        },
        defaultProps: { gap: 26, valign: "top", left: [], right: [] },
        render: ({ gap, valign, left: Left, right: Right }) => (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(300px, 100%), 1fr))",
              gap,
              alignItems: valign === "center" ? "center" : "start",
            }}
          >
            <div>
              <Left />
            </div>
            <div>
              <Right />
            </div>
          </div>
        ),
      },

      ThreeColumns: {
        label: "Three columns",
        fields: {
          gap: { type: "number" },
          valign: {
            type: "select",
            options: [
              { label: "Top", value: "top" },
              { label: "Center", value: "center" },
            ],
          },
          a: { type: "slot", disallow: NO_FULL_WIDTH },
          b: { type: "slot", disallow: NO_FULL_WIDTH },
          c: { type: "slot", disallow: NO_FULL_WIDTH },
        },
        defaultProps: { gap: 22, valign: "top", a: [], b: [], c: [] },
        render: ({ gap, valign, a: A, b: B, c: C }) => (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
              gap,
              alignItems: valign === "center" ? "center" : "start",
            }}
          >
            <div>
              <A />
            </div>
            <div>
              <B />
            </div>
            <div>
              <C />
            </div>
          </div>
        ),
      },

      Buttons: {
        label: "Button row",
        fields: {
          align: ALIGN_FIELD,
          buttons: {
            type: "array",
            arrayFields: {
              label: { type: "text" },
              href: LINK_FIELD,
              variant: {
                type: "select",
                options: [
                  { label: "Gold", value: "gold" },
                  { label: "Rose", value: "rose" },
                  { label: "Teal", value: "teal" },
                  { label: "Quiet", value: "quiet" },
                ],
              },
            },
          },
        },
        defaultProps: {
          align: "left",
          buttons: [
            { label: "Book a reading", href: "/book", variant: "gold" },
            { label: "See packages", href: "/packages", variant: "teal" },
          ],
        },
        render: ({ align, buttons }: ButtonsProps) => (
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              justifyContent:
                align === "center"
                  ? "center"
                  : align === "right"
                  ? "flex-end"
                  : "flex-start",
            }}
          >
            {(buttons || []).map((b, i) => {
              const cls =
                b.variant === "quiet"
                  ? "btn-quiet btn-quiet--gold"
                  : `btn btn-${b.variant}`;
              return (
                <a key={i} href={b.href} className={cls}>
                  {b.label}
                </a>
              );
            })}
          </div>
        ),
      },

      Panel: {
        label: "Glass panel",
        fields: { content: { type: "slot", disallow: PANEL_DISALLOW } },
        defaultProps: { content: [] },
        render: ({ content: Content }) => (
          <div
            style={{
              background: "var(--glass)",
              backdropFilter: "blur(7px)",
              borderRadius: 28,
              border: "1px solid var(--glass-edge)",
              padding: "24px 22px",
            }}
          >
            <Content />
          </div>
        ),
      },

      List: {
        label: "List",
        fields: {
          marker: {
            type: "select",
            options: [
              { label: "Check", value: "check" },
              { label: "Dot", value: "dot" },
              { label: "None", value: "none" },
            ],
          },
          align: ALIGN_FIELD,
          items: { type: "array", arrayFields: { text: { type: "text" } } },
        },
        defaultProps: {
          marker: "check",
          align: "left",
          items: [{ text: "A point worth making" }, { text: "Another one" }],
        },
        render: ({ items, marker, align }: ListProps) => (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "14px 0 20px",
              color: "var(--ink-body)",
              fontSize: ".96rem",
              lineHeight: 1.7,
            }}
          >
            {(items || []).map((it, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "4px 0",
                  justifyContent:
                    align === "center"
                      ? "center"
                      : align === "right"
                      ? "flex-end"
                      : "flex-start",
                }}
              >
                {marker !== "none" && (
                  <span
                    aria-hidden
                    style={{ color: "var(--gold-deep)", fontWeight: 700 }}
                  >
                    {marker === "check" ? "✓" : "•"}
                  </span>
                )}
                <span>{it.text}</span>
              </li>
            ))}
          </ul>
        ),
      },

      Faq: {
        label: "FAQ / Accordion",
        fields: {
          items: {
            type: "array",
            arrayFields: { q: { type: "text" }, a: { type: "textarea" } },
          },
        },
        defaultProps: {
          items: [{ q: "A question people ask?", a: "A warm, clear answer." }],
        },
        render: ({ items }: FaqProps) => (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              maxWidth: 680,
              margin: "0 auto",
            }}
          >
            {(items || []).map((it, i) => (
              <details
                key={i}
                style={{
                  background: "var(--glass)",
                  border: "1px solid var(--glass-edge)",
                  borderRadius: 14,
                  padding: "12px 16px",
                  backdropFilter: "blur(6px)",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    fontWeight: 700,
                    color: "var(--ink-strong)",
                  }}
                >
                  {it.q}
                </summary>
                <p
                  style={{
                    color: "var(--ink-body)",
                    lineHeight: 1.7,
                    margin: "10px 0 0",
                  }}
                >
                  {it.a}
                </p>
              </details>
            ))}
          </div>
        ),
      },
    },
  };
}
