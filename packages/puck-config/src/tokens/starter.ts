import type { BrandTokens } from "./index";

/**
 * Starter -- the neutral cartridge every deployment is born with.
 *
 * SEPARATION LAW (Admiral, 2026-08-13): the fleet packages ship
 * brand-neutral; a brand arrives ONLY as a cartridge the host passes into
 * createConfig. This starter is deliberately plain -- system fonts, sober
 * neutrals, one blue accent -- a blank canvas, not a brand. Contrast
 * grades are measured with the WCAG formula against each ground (white
 * fails on the dawn ground exactly as you'd expect, and the inspector
 * says so).
 *
 * Unlike brand cartridges, the starter permits serifs (a serif token
 * exists): "no serifs" is a per-brand law, not a fleet default.
 */
export const STARTER: BrandTokens = {
  id: "starter",
  name: "Starter",
  grounds: { night: "#141414", dawn: "#FAFAF8" },

  colors: {
    ink: {
      css: "#F2F2F2",
      night: "#F2F2F2",
      dawn: "#26262B",
      label: "Ink",
      grade: { night: "aa", dawn: "aa" }, // 16.46:1 / 14.41:1
    },
    body: {
      css: "#CFCFD4",
      night: "#CFCFD4",
      dawn: "#44444C",
      label: "Body",
      grade: { night: "aa", dawn: "aa" }, // 11.87:1 / 9.23:1
    },
    muted: {
      css: "#9A9AA3",
      night: "#9A9AA3",
      dawn: "#77777F",
      label: "Muted",
      grade: { night: "aa", dawn: "large" }, // 6.60:1 / 4.25:1
    },
    accent: {
      css: "#7FB4E6",
      night: "#7FB4E6",
      dawn: "#275D8F",
      label: "Accent",
      grade: { night: "aa", dawn: "aa" }, // 8.40:1 / 6.59:1
    },
    white: {
      css: "#ffffff",
      night: "#ffffff",
      dawn: "#ffffff",
      label: "White",
      grade: { night: "aa", dawn: "fails" }, // 18.42:1 / 1.05:1
    },
  },

  fonts: {
    display: {
      css: "system-ui, -apple-system, sans-serif",
      label: "Display (System)",
      serif: false,
    },
    body: {
      css: "system-ui, -apple-system, sans-serif",
      label: "Body (System)",
      serif: false,
    },
    serif: {
      css: "Georgia, 'Times New Roman', serif",
      label: "Serif (Georgia)",
      serif: true,
    },
  },

  palette: [
    {
      key: "p1",
      label: "Lead",
      hint: "the loudest note -- CTAs, key accents",
      value: "#4A90D9",
    },
    {
      key: "p2",
      label: "Mid",
      hint: "structural tint -- edges, fills, bands",
      value: "#6B7280",
    },
    {
      key: "p3",
      label: "Soft",
      hint: "gentle secondary -- kickers, highlights",
      value: "#A3B8CC",
    },
    {
      key: "p4",
      label: "Counter",
      hint: "the complement -- contrast moments",
      value: "#D9A44A",
    },
    {
      key: "p5",
      label: "Deep",
      hint: "ground shade -- band backgrounds",
      value: "#1F2937",
    },
  ],

  type: {
    basePx: 17,
    ratio: 1.25,
    sizes: { display: 42, h1: 34, h2: 27, h3: 22, body: 17, small: 15 },
    bounds: { sizePx: [12, 72], kerningPx: [-2, 12], lineHeight: [1.0, 2.4] },
  },

  spacing: { stops: [8, 16, 24, 32, 48, 96], maxPx: 120 },

  breakpoints: { tabletMin: 768, desktopMin: 1080 },

  rails: {
    "one-h1": { brand: "error", play: "error" },
    "heading-order": { brand: "error", play: "warn" },
    "contrast-min": { brand: "error", play: "warn" },
    "token-only": { brand: "error", play: "off" },
    "no-serif": { brand: "off", play: "off" }, // per-brand law, not a fleet default
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
