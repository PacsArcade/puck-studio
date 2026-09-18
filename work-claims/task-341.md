# TASK-341 claim (Part A — puck-config only)

- Owner: Number One (home crew, sonnet sub-agent, H128)
- Worktree: /home/pac/dev/worktrees/task-341-puck-config
- Branch: feat/task-341-style-sections
- Base sha (puck-studio main): 8feb8688d5ff7a0dc7a5bd872d4d3d3d729d84ab
- Scope: `packages/puck-config` ONLY — the right inspector's `UnifiedStyleField`
  grows two labelled, collapsible sections (Typography, Spacing) over the
  same 7(+weight) existing style keys, plus the Admiral's named new key
  `weight`.
- Ruling of record: TASK-341 brief's "Number One rulings at cut"
  (0018.06.27 a₿ · H130) overrides the brief's original Build section where
  they differ — `weight` is in scope, stepped size scale is a build-if-fits,
  Part B / `gh release` / onecocreation are explicitly NOT this lane.
- OWNS: `responsive/field.tsx`, `responsive/schema.ts`, `responsive/css.ts`,
  `index.tsx:80-98` (`typo`/`box`), new spec file(s), this claim file.
  `responsive/provenance.ts`'s `PROP_TO_CSS` map also touched — a forced,
  mechanical consequence of adding `weight` to `StyleProps` (the map is
  typed `Record<keyof StyleProps, string>`; not otherwise in scope).
- READ-ONLY / forbidden: `index.tsx:393-775` (block render/fields) and any
  new inline-editor file — T-340's territory, in flight in parallel at
  `~/dev/worktrees/task-340-puck-config`; `color-field.tsx`; any
  Background/Border/Size/Layout control with no backing schema data; a
  face/font picker; `~/dev/onecocreation`; `gh release`.
- STOP before any `gh release` / OC pin bump — Part B is a follow-on
  micro-lane, not mine. Bump `packages/puck-config/package.json` to 0.15.0
  after confirming `puck-config-v0.14.0` is the latest tag
  (`gh release list --repo PacsArcade/puck-studio`), then hand back with
  the `npm pack --dry-run` filename in SUMMARY.
