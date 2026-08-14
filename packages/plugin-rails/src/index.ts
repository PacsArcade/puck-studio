import type {
  BrandTokens,
  RuleId,
  Severity,
} from "@pacsarcade/puck-config/tokens";
import { gradeOn } from "@pacsarcade/puck-config/tokens";
import {
  createRegistry,
  resolve,
  screenComboForWidth,
  screenVariantsFromBreakpoints,
  type VariantRegistry,
  type VariantedProps,
} from "@pacsarcade/variant-engine";

/**
 * plugin-rails -- the guardrail lint (Phase 1 step 4 of the Rails Spec).
 *
 * A pure engine: lintPage(data, ctx) walks a Puck Data tree and returns
 * findings. Severities come from the brand's tokens (`rails` -- config,
 * not code), per lane (brand | play). No React, no DOM -- it runs the same
 * on the editor client, in the publish API, and against AI-copilot output,
 * which is the point: THE SAME RULES EVERYWHERE, and the model can never
 * bypass what the editor enforces.
 *
 * Approximations are documented per rule. Rules that need runtime layout
 * (true pixel positions) approximate from block order and known component
 * geometry -- honest heuristics, tuned to advise rather than lie.
 */

// ── data shapes (structural, no @puckeditor/core dependency) ───────────────
export interface LintBlock {
  type: string;
  props: Record<string, unknown> & { id?: string };
}
export interface LintData {
  content: LintBlock[];
  root?: unknown;
}

export type Lane = "brand" | "play";

export interface LintContext {
  tokens: BrandTokens;
  lane: Lane;
  /** current saved palette (p1-p5 hex) so slot picks can be contrast-checked */
  palette?: Record<string, string>;
  /** the palette's EFFECTIVE dawn hexes (varianted tokens, 0.3.0) — a slot
   *  absent here falls back to its night hex, the pre-varianted behavior */
  paletteDawn?: Record<string, string>;
}

export interface Finding {
  rule: RuleId;
  severity: Exclude<Severity, "off">;
  message: string;
  blockId?: string;
  blockType?: string;
}

// ── tree walking ───────────────────────────────────────────────────────────
interface Visit {
  block: LintBlock;
  depth: number; // container nesting depth (root children = 1)
  /** ground the block sits on per theme, as hex, after Band context */
  ground: { night: string; dawn: string };
  /** index among root-level blocks of this block's top-level ancestor */
  rootIndex: number;
}

function isSlotArray(v: unknown): v is LintBlock[] {
  return (
    Array.isArray(v) &&
    v.every(
      (x) =>
        !!x &&
        typeof x === "object" &&
        typeof (x as LintBlock).type === "string"
    )
  );
}

const CONTAINERS = new Set(["Band", "Panel", "TwoColumns", "ThreeColumns"]);

/** Bands force a dark ground when holding the night or carrying a photo. */
function bandGround(
  props: Record<string, unknown>,
  parent: Visit["ground"],
  tokens: BrandTokens
): Visit["ground"] {
  const bg = String(props.background ?? "");
  const hold = String(props.hold ?? "");
  if (hold === "night" || bg === "nebula" || bg === "meteors") {
    return { night: tokens.grounds.night, dawn: tokens.grounds.night };
  }
  return parent;
}

export function walk(data: LintData, tokens: BrandTokens): Visit[] {
  const out: Visit[] = [];
  const visit = (
    block: LintBlock,
    depth: number,
    ground: Visit["ground"],
    rootIndex: number
  ): void => {
    const g =
      block.type === "Band" ? bandGround(block.props, ground, tokens) : ground;
    out.push({ block, depth, ground: g, rootIndex });
    const childDepth = CONTAINERS.has(block.type) ? depth + 1 : depth;
    for (const v of Object.values(block.props)) {
      if (isSlotArray(v))
        for (const child of v) visit(child, childDepth, g, rootIndex);
    }
  };
  const pageGround = { night: tokens.grounds.night, dawn: tokens.grounds.dawn };
  (data.content ?? []).forEach((b, i) => visit(b, 1, pageGround, i));
  return out;
}

// ── helpers ────────────────────────────────────────────────────────────────
type StyleObj = {
  font?: string;
  size?: number;
  color?: string;
  [k: string]: unknown;
};

function styleOf(b: LintBlock): StyleObj | undefined {
  const s = b.props.style;
  return s && typeof s === "object" ? (s as StyleObj) : undefined;
}

/** the block's screen-override layers, or null when absent/empty (legacy) */
function styleVariantsOf(b: LintBlock): VariantedProps<StyleObj> | null {
  const sv = b.props.styleVariants;
  if (!sv || typeof sv !== "object" || Array.isArray(sv)) return null;
  const entries = Object.entries(sv as Record<string, unknown>).filter(
    ([, v]) =>
      !!v && typeof v === "object" && Object.keys(v as object).length > 0
  );
  if (entries.length === 0) return null;
  return Object.fromEntries(entries) as VariantedProps<StyleObj>;
}

const REGISTRY_CACHE = new WeakMap<BrandTokens, VariantRegistry>();
function registryFor(tokens: BrandTokens): VariantRegistry {
  let reg = REGISTRY_CACHE.get(tokens);
  if (!reg) {
    reg = createRegistry(screenVariantsFromBreakpoints(tokens.breakpoints));
    REGISTRY_CACHE.set(tokens, reg);
  }
  return reg;
}

/**
 * The style contexts a style-aware rule must judge (Phase 2 step 2):
 * legacy blocks (no styleVariants) yield exactly one — the base, suffix ""
 * — so 0.1.x findings are byte-identical. Blocks carrying overrides add
 * the EFFECTIVE style at a tablet-active width and at a desktop-active
 * width (under mobileFirst the desktop combo includes tablet, exactly as
 * the emitted media queries stack).
 */
function effectiveStyles(
  b: LintBlock,
  tokens: BrandTokens
): {
  style: StyleObj | undefined;
  suffix: "" | " on tablet" | " on desktop";
}[] {
  const base = styleOf(b);
  const sv = styleVariantsOf(b);
  if (!sv) return [{ style: base, suffix: "" }];
  const reg = registryFor(tokens);
  const { tabletMin, desktopMin } = tokens.breakpoints;
  return [
    { style: base, suffix: "" },
    {
      style: resolve(reg, base ?? {}, sv, screenComboForWidth(reg, tabletMin)),
      suffix: " on tablet",
    },
    {
      style: resolve(reg, base ?? {}, sv, screenComboForWidth(reg, desktopMin)),
      suffix: " on desktop",
    },
  ];
}

/** blocks that render an h-level heading, and which level */
function headingLevel(b: LintBlock): number | null {
  if (b.type === "Hero") return 1; // Hero renders an h1
  if (b.type === "Heading") {
    const l = String(b.props.level ?? "h2");
    return l === "h1" ? 1 : l === "h3" ? 3 : 2;
  }
  if (b.type === "StackedHeading") {
    return String(b.props.tag ?? "h2") === "h1" ? 1 : 2;
  }
  return null;
}

const TEXTY = new Set([
  "Text",
  "RichText",
  "Eyebrow",
  "Heading",
  "StackedHeading",
  "PullQuote",
  "Quote",
]);
/** headings & pull-quotes render large by default (>=24px) */
const LARGE_BY_DEFAULT = new Set([
  "Heading",
  "StackedHeading",
  "PullQuote",
  "Hero",
]);

/** resolve a colour field value to per-theme hex for contrast math */
function resolveHex(
  value: string,
  ctx: LintContext
): { night: string; dawn: string } | null {
  if (value.startsWith("#")) return { night: value, dawn: value };
  if (/^p[1-5]$/.test(value)) {
    const hex = ctx.palette?.[value];
    return hex ? { night: hex, dawn: ctx.paletteDawn?.[value] ?? hex } : null;
  }
  const t = ctx.tokens.colors[value];
  return t ? { night: t.night, dawn: t.dawn } : null;
}

const SERIF_RX =
  /font-family\s*:\s*[^;"']*(georgia|times|garamond|palatino|serif)/i;
const HEX_IN_HTML_RX = /#[0-9a-fA-F]{3,8}\b/;

// ── the rules ──────────────────────────────────────────────────────────────
type RuleFn = (
  visits: Visit[],
  ctx: LintContext
) => Omit<Finding, "severity">[];

const rules: Record<RuleId, RuleFn> = {
  "one-h1": (visits) => {
    const h1s = visits.filter((v) => headingLevel(v.block) === 1);
    if (h1s.length === 1) return [];
    if (h1s.length === 0)
      return [
        {
          rule: "one-h1",
          message:
            "The page has no main title (H1). Add one Heading set to H1 (or a Hero / H1 Stacked heading) at the top.",
        },
      ];
    return h1s.slice(1).map((v) => ({
      rule: "one-h1",
      message:
        "More than one H1 on the page — keep one main title and make the others H2.",
      blockId: v.block.props.id,
      blockType: v.block.type,
    }));
  },

  "heading-order": (visits) => {
    const out: Omit<Finding, "severity">[] = [];
    let prev = 0;
    for (const v of visits) {
      const l = headingLevel(v.block);
      if (l == null) continue;
      if (prev > 0 && l > prev + 1) {
        out.push({
          rule: "heading-order",
          message: `Heading level skips from H${prev} to H${l} — add the level between, or demote this one.`,
          blockId: v.block.props.id,
          blockType: v.block.type,
        });
      }
      prev = l;
    }
    return out;
  },

  "contrast-min": (visits, ctx) => {
    const out: Omit<Finding, "severity">[] = [];
    for (const v of visits) {
      if (!TEXTY.has(v.block.type)) continue;
      for (const { style: s, suffix } of effectiveStyles(v.block, ctx.tokens)) {
        const colorVal =
          s?.color && s.color !== "default" ? String(s.color) : null;
        if (!colorVal) continue; // default colours are the house pairs, AA by design
        const hex = resolveHex(colorVal, ctx);
        if (!hex) continue;
        const size = Number(s?.size ?? 0);
        const large =
          size >= 24 || (size === 0 && LARGE_BY_DEFAULT.has(v.block.type));
        const need = large ? "large" : "aa";
        for (const theme of ["night", "dawn"] as const) {
          // keep-dark bands pin tokens to their NIGHT values in both themes
          // (cartridge's `.keep-dark` override) -- mirror that here.
          const onForcedNight = v.ground[theme] === ctx.tokens.grounds.night;
          const textHex = onForcedNight ? hex.night : hex[theme];
          const grade = gradeOn(textHex, v.ground[theme]);
          const ok = grade === "aa" || (need === "large" && grade === "large");
          if (!ok) {
            out.push({
              rule: "contrast-min",
              message: `"${colorVal}" is hard to read in ${
                theme === "dawn" ? "light" : "dark"
              } mode here${suffix} (${
                large ? "large text needs 3:1" : "body text needs 4.5:1"
              }). Pick a stronger colour for this spot.`,
              blockId: v.block.props.id,
              blockType: v.block.type,
            });
            break; // one finding per block per screen context is enough
          }
        }
      }
    }
    return out;
  },

  "token-only": (visits) => {
    const out: Omit<Finding, "severity">[] = [];
    for (const v of visits) {
      const s = styleOf(v.block);
      if (s?.color && String(s.color).startsWith("#")) {
        out.push({
          rule: "token-only",
          message:
            "Raw hex colour on a brand page — pick a brand token or palette slot instead (or promote this colour to the palette).",
          blockId: v.block.props.id,
          blockType: v.block.type,
        });
      }
      if (v.block.type === "RichText") {
        const html = String(v.block.props.html ?? "");
        if (HEX_IN_HTML_RX.test(html)) {
          out.push({
            rule: "token-only",
            message:
              "Raw hex colour inside rich text — use var(--token) colours instead.",
            blockId: v.block.props.id,
            blockType: v.block.type,
          });
        }
      }
    }
    return out;
  },

  "no-serif": (visits) => {
    // Font menus are token-only already; the reachable hole is inline HTML.
    const out: Omit<Finding, "severity">[] = [];
    for (const v of visits) {
      if (v.block.type !== "RichText") continue;
      const html = String(v.block.props.html ?? "");
      if (SERIF_RX.test(html)) {
        out.push({
          rule: "no-serif",
          message:
            "A serif font-family appears in rich text — this brand's law is no serifs.",
          blockId: v.block.props.id,
          blockType: v.block.type,
        });
      }
    }
    return out;
  },

  "slot-allow": (visits, ctx) => {
    // Re-validate the drop-time matrix on DATA (API/copilot writes bypass the editor).
    const out: Omit<Finding, "severity">[] = [];
    const check = (parent: LintBlock, child: LintBlock): void => {
      const full = child.type === "Band" || child.type === "Hero";
      const bad =
        (CONTAINERS.has(parent.type) && full) ||
        (parent.type === "Panel" &&
          ["Panel", "TwoColumns", "ThreeColumns"].includes(child.type));
      if (bad) {
        out.push({
          rule: "slot-allow",
          message: `${child.type} cannot live inside ${parent.type} — move it to the page level.`,
          blockId: child.props.id,
          blockType: child.type,
        });
      }
    };
    const rec = (b: LintBlock): void => {
      for (const v of Object.values(b.props)) {
        if (isSlotArray(v))
          for (const child of v) {
            check(b, child);
            rec(child);
          }
      }
    };
    for (const v of visits.filter((x) => x.depth === 1)) rec(v.block);
    return out;
  },

  "nesting-depth": (visits) => {
    const seen = new Set<string>();
    const out: Omit<Finding, "severity">[] = [];
    for (const v of visits) {
      if (v.depth > 3 && CONTAINERS.has(v.block.type)) {
        const id = String(v.block.props.id ?? "");
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({
          rule: "nesting-depth",
          message:
            "Containers nest more than 3 deep here — flatten the layout.",
          blockId: v.block.props.id,
          blockType: v.block.type,
        });
      }
    }
    return out;
  },

  "tap-target": (visits) => {
    // House buttons are fixed-size and pass 44px -- except the quiet text
    // link. Flag only when quiet is the page's ONLY action.
    const actions = visits.filter(
      (v) => v.block.type === "Button" || v.block.type === "Buttons"
    );
    if (actions.length === 0) return [];
    const hasSolid = actions.some((v) => {
      if (v.block.type === "Button") return v.block.props.variant !== "quiet";
      const list = v.block.props.buttons;
      return (
        Array.isArray(list) &&
        list.some((b) => (b as { variant?: string }).variant !== "quiet")
      );
    });
    if (hasSolid) return [];
    return [
      {
        rule: "tap-target",
        message:
          "Every action on this page is a quiet text link — small tap targets on a phone. Make the main action a solid button.",
      },
    ];
  },

  "thumb-reach": (visits) => {
    // Approximation from block order: a page with actions whose FIRST solid
    // button only appears very deep is a long stretch on mobile.
    const roots = visits.filter((v) => v.depth === 1);
    const totalRoot = new Set(roots.map((r) => r.rootIndex)).size;
    const firstSolid = visits.find(
      (v) =>
        (v.block.type === "Button" && v.block.props.variant !== "quiet") ||
        (v.block.type === "Buttons" &&
          Array.isArray(v.block.props.buttons) &&
          (v.block.props.buttons as { variant?: string }[]).some(
            (b) => b.variant !== "quiet"
          ))
    );
    if (!firstSolid || totalRoot < 8) return [];
    if (firstSolid.rootIndex > Math.max(10, Math.floor(totalRoot * 0.75))) {
      return [
        {
          rule: "thumb-reach",
          message:
            "The first solid action sits very deep in the page — on a phone that's a long scroll before anything tappable. Consider an action nearer the top.",
        },
      ];
    }
    return [];
  },

  "body-size": (visits, ctx) => {
    // Floor = the brand's own `small` size token (the type scale's quiet
    // layer); the 16px canon applies to the default body, which ships 19.
    const floor = ctx.tokens.type.sizes.small;
    const out: Omit<Finding, "severity">[] = [];
    for (const v of visits) {
      if (v.block.type !== "Text" && v.block.type !== "RichText") continue;
      for (const { style: s, suffix } of effectiveStyles(v.block, ctx.tokens)) {
        const size = Number(s?.size ?? 0);
        if (size > 0 && size < floor) {
          out.push({
            rule: "body-size",
            message: `Body text at ${size}px${suffix} is below the brand's smallest size (${floor}px) — hard to read on a phone.`,
            blockId: v.block.props.id,
            blockType: v.block.type,
          });
        }
      }
    }
    return out;
  },

  "alt-text": (visits) => {
    const out: Omit<Finding, "severity">[] = [];
    for (const v of visits) {
      if (v.block.type === "Image") {
        if (!String(v.block.props.alt ?? "").trim()) {
          out.push({
            rule: "alt-text",
            message:
              "This image has no alt text — describe it in a few words (screen readers and search both use it).",
            blockId: v.block.props.id,
            blockType: "Image",
          });
        }
      }
      if (v.block.type === "Gallery") {
        const imgs = v.block.props.images;
        if (
          Array.isArray(imgs) &&
          imgs.some((im) => !String((im as { alt?: string }).alt ?? "").trim())
        ) {
          out.push({
            rule: "alt-text",
            message: "Some gallery photos have no alt text — a few words each.",
            blockId: v.block.props.id,
            blockType: "Gallery",
          });
        }
      }
    }
    return out;
  },

  "motion-safe": () => {
    // Structural guarantee today: every animated affordance the registry
    // ships respects prefers-reduced-motion in house CSS. When the Toy
    // Chest lands (glitter, marquee, trails), each toy must register its
    // reduced-motion guard here. Nothing to flag until then.
    return [];
  },

  "empty-slot": (visits) => {
    const out: Omit<Finding, "severity">[] = [];
    for (const v of visits) {
      if (!CONTAINERS.has(v.block.type)) continue;
      const empty = Object.values(v.block.props).some(
        (p) => Array.isArray(p) && p.length === 0
      );
      if (empty) {
        out.push({
          rule: "empty-slot",
          message: `${v.block.type} has an empty area — drop something in, or remove it.`,
          blockId: v.block.props.id,
          blockType: v.block.type,
        });
      }
    }
    return out;
  },
};

// ── the engine ─────────────────────────────────────────────────────────────
export function lintPage(data: LintData, ctx: LintContext): Finding[] {
  const visits = walk(data, ctx.tokens);
  const findings: Finding[] = [];
  for (const [ruleId, fn] of Object.entries(rules) as [RuleId, RuleFn][]) {
    const severity = ctx.tokens.rails[ruleId]?.[ctx.lane] ?? "off";
    if (severity === "off") continue;
    for (const f of fn(visits, ctx)) findings.push({ ...f, severity });
  }
  // errors first, stable order
  return findings.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1
  );
}

export function hasErrors(findings: Finding[]): boolean {
  return findings.some((f) => f.severity === "error");
}

/** one-line summary for chips: "2 ✕ · 1 ⚠" or "" when clean */
export function summarize(findings: Finding[]): string {
  const e = findings.filter((f) => f.severity === "error").length;
  const w = findings.length - e;
  if (!e && !w) return "";
  return [e ? `${e} ✕` : "", w ? `${w} ⚠` : ""].filter(Boolean).join(" · ");
}
