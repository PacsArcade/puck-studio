# TASK-340 claim

- Owner: Number One (home crew, sonnet sub-agent, H128)
- Worktree: /home/pac/dev/worktrees/task-340-puck-config
- Branch: feat/task-340-inline-text-field
- Base sha (puck-studio main): 8feb8688d5ff7a0dc7a5bd872d4d3d3d729d84ab
- Scope: Part A only — `packages/puck-config`. Inline text editing on the
  `/style` canvas, proven on the "My Story" Heading block (Ground drift #1
  accepted per Number One rulings at cut). Weight OMITTED (option a) —
  T-341 owns adding it.
- OWNS: new `src/style/InlineTextEditor.tsx`, the target blocks' render/
  fields sites in `src/index.tsx` (the :393-775 region), new spec file(s)
  under `src/__tests__/`, this claim file.
- READ-ONLY (T-341's lane, in flight in parallel at
  `~/dev/worktrees/task-341-puck-config`): `src/responsive/field.tsx`,
  `src/responsive/schema.ts`, `src/responsive/css.ts`, `src/index.tsx:80-98`
  (`typo`/`box`). Do not touch.
- Forbidden: publishing to npm, `gh release`, bold/italic/link marks, any
  new StyleProps key, touching `~/dev/onecocreation` (Part B is a
  follow-on micro-lane, not this lane).
- Gate: `yarn workspace @frens-earth/puck-config run test` (jest) — 9
  suites / 109 tests pass at base; the suite must grow.
