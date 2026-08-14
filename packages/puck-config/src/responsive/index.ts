/**
 * @pacsarcade/puck-config/responsive — the responsive surface.
 *
 * Hosts import ViewportBar (editor chrome), ArtboardRail (the live
 * companion-breakpoint matrix), and PreviewSizer (canvas container) from
 * here; the engine-facing pieces (schema, decl twins, styleVariantsCss)
 * are exported for tests and advanced hosts.
 */

export {
  PreviewSizer,
  ResponsiveStyleField,
  useTargetBreakpoint,
  VIEWPORT_PRESETS,
  ViewportBar,
  type ViewportPreset,
  type ViewportPresetKey,
} from "./field";
export {
  ArtboardRail,
  artboardScale,
  collectHostHeadStyles,
  CompanionFrame,
  useDebouncedValue,
  type ArtboardLog,
  type CompanionFrameProps,
} from "./artboards";
export {
  boxDecls,
  styleVariantsCss,
  typoDecls,
  type BlockStyleDefaults,
  type DeclRecord,
  type StyleVariantsCss,
} from "./css";
export {
  DEFAULT_STYLE,
  registryFor,
  type Align,
  type BreakpointKey,
  type FontKey,
  type StyleProps,
  type StyleVariants,
} from "./schema";
