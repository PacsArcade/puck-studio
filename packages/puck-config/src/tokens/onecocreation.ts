import type { BrandTokens } from "./index";

/**
 * One Cocreation -- the first brand cartridge (Love's site).
 *
 * Values are lifted verbatim from the shipping cartridge.css (dark-first;
 * dawn = the html[data-oc-theme="light"] overrides). Contrast grades are
 * measured with the WCAG formula against each theme's ground -- notably:
 *   - muted / gold / rose grade "large" on dawn (headings & labels only);
 *   - goldBright and white FAIL as text on dawn (night-ground colours that
 *     the light theme does not override) -- the inspector should hint this
 *     and lint rule `contrast-min` enforces it.
 *
 * LOVE'S LAW lives here as data, not as a special case: her font tokens
 * simply contain no serif, so serifs are unofferable on this brand. Other
 * brands may ship serif tokens -- their call (Admiral, 2026-08-13).
 */
export const ONECOCREATION: BrandTokens = {
  id: "onecocreation",
  name: "One Cocreation",
  grounds: { night: "#141021", dawn: "#FCF7F0" },

  colors: {
    ink: {
      css: "var(--ink-strong)",
      night: "#F4ECFF",
      dawn: "#3f3a4e",
      label: "Ink",
      grade: { night: "aa", dawn: "aa" }, // 16.24:1 / 10.23:1
    },
    body: {
      css: "var(--ink-body)",
      night: "#D9D2E4",
      dawn: "#544e64",
      label: "Body",
      grade: { night: "aa", dawn: "aa" }, // 12.69:1 / 7.43:1
    },
    muted: {
      css: "var(--muted)",
      night: "#9a8fae",
      dawn: "#897F97",
      label: "Muted",
      grade: { night: "aa", dawn: "large" }, // 6.14:1 / 3.55:1
    },
    gold: {
      css: "var(--gold-deep)",
      night: "#D9B24E",
      dawn: "#B4862B",
      label: "Gold",
      grade: { night: "aa", dawn: "large" }, // 9.26:1 / 3.09:1
    },
    goldBright: {
      css: "var(--gold-2)",
      night: "#EBCB77",
      dawn: "#EBCB77", // light theme does not override --gold-2
      label: "Gold bright",
      grade: { night: "aa", dawn: "fails" }, // 11.85:1 / 1.48:1
    },
    teal: {
      css: "var(--teal-bright)",
      night: "#8FD0D8",
      dawn: "#23636E",
      label: "Teal",
      grade: { night: "aa", dawn: "aa" }, // 10.82:1 / 6.39:1
    },
    rose: {
      css: "var(--rose)",
      night: "#E7B2C3",
      dawn: "#C56E8B",
      label: "Rose",
      grade: { night: "aa", dawn: "large" }, // 10.26:1 / 3.30:1
    },
    purple: {
      css: "var(--lavender)",
      night: "#8B76C4",
      dawn: "#8B76C4", // light theme does not override --lavender
      label: "Purple",
      grade: { night: "aa", dawn: "large" }, // 4.87:1 / 3.59:1
    },
    white: {
      css: "#ffffff",
      night: "#ffffff",
      dawn: "#ffffff",
      label: "White",
      grade: { night: "aa", dawn: "fails" }, // 15.87:1 / 1.07:1
    },
  },

  fonts: {
    // Love's law by omission: no serif token exists on this brand.
    display: { css: "var(--font-h1)", label: "Display (Barlow)", serif: false },
    body: { css: "var(--font-body)", label: "Body (Helvetica)", serif: false },
    accent: { css: "var(--font-h3)", label: "Accent (Lucida)", serif: false },
  },

  palette: [
    {
      key: "p1",
      label: "Lead",
      hint: "the brand's loudest note -- CTAs, key accents",
      value: "#EBCB77",
    },
    {
      key: "p2",
      label: "Mid",
      hint: "structural tint -- edges, fills, bands",
      value: "#8B76C4",
    },
    {
      key: "p3",
      label: "Soft",
      hint: "warm secondary -- kickers, highlights",
      value: "#E7B2C3",
    },
    {
      key: "p4",
      label: "Counter",
      hint: "the complement -- contrast moments",
      value: "#8FD0D8",
    },
    {
      key: "p5",
      label: "Deep",
      hint: "ground shade -- band backgrounds",
      value: "#2a1f45",
    },
  ],

  type: {
    basePx: 19,
    ratio: 1.25,
    sizes: { display: 46, h1: 37, h2: 30, h3: 24, body: 19, small: 15 },
    bounds: { sizePx: [12, 72], kerningPx: [-2, 12], lineHeight: [1.0, 2.4] },
  },

  spacing: { stops: [8, 16, 24, 32, 48, 96], maxPx: 120 },

  breakpoints: { tabletMin: 768, desktopMin: 1080 },

  rails: {
    "one-h1": { brand: "error", play: "error" },
    "heading-order": { brand: "error", play: "warn" },
    "contrast-min": { brand: "error", play: "warn" },
    "token-only": { brand: "error", play: "off" },
    "no-serif": { brand: "error", play: "error" }, // Love's law -- this brand only
    "slot-allow": { brand: "error", play: "error" },
    "nesting-depth": { brand: "error", play: "error" },
    "tap-target": { brand: "error", play: "warn" },
    "thumb-reach": { brand: "warn", play: "warn" },
    "body-size": { brand: "error", play: "warn" },
    "alt-text": { brand: "error", play: "warn" },
    "motion-safe": { brand: "error", play: "error" },
    "empty-slot": { brand: "warn", play: "warn" },
  },
};
