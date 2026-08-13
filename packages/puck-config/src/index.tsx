import type { Config, Slot } from "@puckeditor/core";
import ColorField from "./color-field";
import { ONECOCREATION, colorCss, fontCss, type BrandTokens } from "./tokens";

/**
 * Puck config -- the house palette (P3/P3.5), alignment + labels (P5), and
 * now the STYLE INSPECTOR (P6, Admiral 2026-08-11: "how can i change font or
 * sizing spacing kern, height, colors"). Every text block carries a `style`
 * object field -- font / size / kerning / line-height / colour / spacing --
 * so Love can tune type the way she'd expect, on-brand (colours and fonts
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
type Align = "left" | "center" | "right";
type FontKey = "default" | "display" | "body" | "accent";
/** colour is a plain string: "default", a house token key, or a "#hex" */
type StyleProps = {
  font: FontKey;
  size: number;
  kerning: number;
  lineHeight: number;
  color: string;
  spaceAbove: number;
  spaceBelow: number;
};

/* Font and colour resolution reads the brand's TOKENS (Phase 1 step 1).
   Values are identical to the old hard-coded maps for One Cocreation --
   zero behavior change -- but the registry is brand-ready: pass another
   BrandTokens via createConfig and every block follows. */
const DEFAULT_TOKENS: BrandTokens = ONECOCREATION;
let ACTIVE_TOKENS: BrandTokens = DEFAULT_TOKENS;

const STYLE_FIELD = {
  type: "object" as const,
  objectFields: {
    font: {
      type: "select" as const,
      options: [
        { label: "Default", value: "default" },
        { label: "Display (Barlow)", value: "display" },
        { label: "Body (Helvetica)", value: "body" },
        { label: "Accent (Lucida)", value: "accent" },
      ],
    },
    size: { type: "number" as const },
    kerning: { type: "number" as const },
    lineHeight: { type: "number" as const },
    color: {
      type: "custom" as const,
      render: ({
        value,
        onChange,
      }: {
        value: string;
        onChange: (v: string) => void;
      }) => <ColorField value={value ?? "default"} onChange={onChange} />,
    },
    spaceAbove: { type: "number" as const },
    spaceBelow: { type: "number" as const },
  },
};
const DEFAULT_STYLE: StyleProps = {
  font: "default",
  size: 0,
  kerning: 0,
  lineHeight: 0,
  color: "default",
  spaceAbove: 0,
  spaceBelow: 0,
};

/** typography overrides for the element (size 0 / line-height 0 = inherit) */
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
/** the wrapper: alignment + vertical spacing */
function box(align: Align, s?: StyleProps): React.CSSProperties {
  const c: React.CSSProperties = { textAlign: align };
  if (s?.spaceAbove) c.marginTop = `${s.spaceAbove}px`;
  if (s?.spaceBelow) c.marginBottom = `${s.spaceBelow}px`;
  return c;
}

const ALIGN_FIELD = {
  type: "select" as const,
  options: [
    { label: "Left", value: "left" },
    { label: "Center", value: "center" },
    { label: "Right", value: "right" },
  ],
};

// -- prop types -------------------------------------------------------------
type EyebrowProps = { text: string; align: Align; style: StyleProps };
type HeadingProps = {
  text: string;
  level: "h1" | "h2" | "h3";
  align: Align;
  style: StyleProps;
};
type StackedHeadingProps = {
  line1: string;
  line2: string;
  tag: "h1" | "h2";
  align: Align;
  style: StyleProps;
};
type TextProps = { text: string; align: Align; style: StyleProps };
type RichTextProps = { html: string; align: Align; style: StyleProps };
type PullQuoteProps = { text: string; align: Align; style: StyleProps };
type ButtonProps = {
  label: string;
  href: string;
  variant: "gold" | "rose" | "teal" | "quiet";
  align: Align;
  style: StyleProps;
};
type QuoteProps = {
  quote: string;
  who: string;
  align: Align;
  style: StyleProps;
};
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
  /** the brand's design tokens; defaults to One Cocreation */
  tokens?: BrandTokens;
}

export function createConfig(opts: PuckConfigOptions): OcPuckConfig {
  const NEBULA = opts.assets.nebula;
  const METEORS = opts.assets.meteors;
  ACTIVE_TOKENS = opts.tokens ?? DEFAULT_TOKENS;
  return {
    components: {
      Eyebrow: {
        label: "Eyebrow label",
        fields: {
          text: { type: "text" },
          align: ALIGN_FIELD,
          style: STYLE_FIELD,
        },
        defaultProps: {
          text: "A small gold label",
          align: "left",
          style: DEFAULT_STYLE,
        },
        render: ({ text, align, style }: EyebrowProps) => (
          <div style={box(align, style)}>
            <span
              className="kicker"
              style={{ display: "inline-block", ...typo(style) }}
            >
              {text}
            </span>
          </div>
        ),
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
          style: STYLE_FIELD,
        },
        defaultProps: {
          text: "Heading",
          level: "h2",
          align: "left",
          style: DEFAULT_STYLE,
        },
        render: ({ text, level, align, style }: HeadingProps) => {
          const Tag = level;
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
          style: STYLE_FIELD,
        },
        defaultProps: {
          line1: "MY",
          line2: "STORY",
          tag: "h1",
          align: "left",
          style: DEFAULT_STYLE,
        },
        render: ({ line1, line2, tag, align, style }: StackedHeadingProps) => {
          const Tag = tag;
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
          style: STYLE_FIELD,
        },
        defaultProps: {
          text: "Body copy goes here.",
          align: "left",
          style: DEFAULT_STYLE,
        },
        render: ({ text, align, style }: TextProps) => (
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
        ),
      },

      /* RichText -- prose with inline emphasis/colour. Renders the html field
       directly: Puck writes are operator-gated (Love/Pac only), trusted CMS
       content. Allowed inline: <b> <i> <br> and <span style="color:..."> */
      RichText: {
        label: "Rich text",
        fields: {
          html: { type: "textarea" },
          align: ALIGN_FIELD,
          style: STYLE_FIELD,
        },
        defaultProps: {
          html: 'A paragraph with <b style="color:var(--teal-bright)">emphasis</b>.',
          align: "left",
          style: DEFAULT_STYLE,
        },
        render: ({ html, align, style }: RichTextProps) => (
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
        ),
      },

      PullQuote: {
        label: "Pull-quote",
        fields: {
          text: { type: "textarea" },
          align: ALIGN_FIELD,
          style: STYLE_FIELD,
        },
        defaultProps: {
          text: "A line worth pausing on, in her voice.",
          align: "center",
          style: DEFAULT_STYLE,
        },
        render: ({ text, align, style }: PullQuoteProps) => (
          <p
            className="pull-quote"
            style={{ ...box(align, style), ...typo(style) }}
          >
            {text}
          </p>
        ),
      },

      Button: {
        label: "Button",
        fields: {
          label: { type: "text" },
          href: { type: "text" },
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
          style: STYLE_FIELD,
        },
        defaultProps: {
          label: "Book a reading",
          href: "/book",
          variant: "gold",
          align: "left",
          style: DEFAULT_STYLE,
        },
        render: ({ label, href, variant, align, style }: ButtonProps) => {
          const cls =
            variant === "quiet"
              ? "btn-quiet btn-quiet--gold"
              : `btn btn-${variant}`;
          return (
            <div style={box(align, style)}>
              <a href={href} className={cls} style={typo(style)}>
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
          style: STYLE_FIELD,
        },
        defaultProps: {
          quote: "Something a client said, in their words.",
          who: "- a client",
          align: "left",
          style: DEFAULT_STYLE,
        },
        render: ({ quote, who, align, style }: QuoteProps) => (
          <figure style={{ margin: 0, maxWidth: 640, ...box(align, style) }}>
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
        ),
      },

      GoldButton: {
        label: "Gold button (legacy)",
        fields: { label: { type: "text" }, href: { type: "text" } },
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
          days: "Where Heaven and Earth Meet",
          title: "One Cocreation",
          sub: "Intuitive sessions with Love",
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
          src: { type: "text" },
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
          src: "/images/about/love-1.webp",
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
            arrayFields: { src: { type: "text" }, alt: { type: "text" } },
          },
        },
        defaultProps: {
          tilt: "yes",
          images: [
            { src: "/images/about/love-1.webp", alt: "Love" },
            { src: "/images/about/love-2.webp", alt: "Love" },
            { src: "/images/about/love-3.webp", alt: "Love" },
          ],
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
          content: { type: "slot" },
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
          left: { type: "slot" },
          right: { type: "slot" },
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
          a: { type: "slot" },
          b: { type: "slot" },
          c: { type: "slot" },
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
              href: { type: "text" },
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
        fields: { content: { type: "slot" } },
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
