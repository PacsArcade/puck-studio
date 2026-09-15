# TASK-285A claim

- Owner: Number One (home crew, sonnet)
- Worktree: /home/pac/dev/worktrees/task-285a
- Branch: feat/task-285a
- Base sha (puck-studio main): eabe0acc5ad8b32dbc6797605b5294be7ad2a9de
- Scope: sub-lane 285-A only — the five puck-studio packages:
  packages/{plugin-rails,presence,puck-changelog,puck-config,variant-engine}
- Ruling: H108 A + the Admiral's scope ruling 0018.06.25 a₿ · block 967,144
  — neutral scope is `@frens-earth`.
- Out of scope (do not touch): core, create-puck-app, field-contentful,
  plugin-emotion-cache, plugin-heading-analyzer, eslint-config-custom,
  tsconfig, tsup-config, scripts/publish.sh. arcade-ui = sub-lane 285-B.
  Consumers (onecocreation, frens.earth, pacsarcade-org, vanilla-template,
  vanilla-demo) = sub-lane 285-C.
- STOP before any `gh release create` — prepare packs + scripts/release-fleet.sh
  and hand back; publish confirmed by the Admiral in one line, then run by
  Number One.
