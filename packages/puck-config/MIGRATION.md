# MIGRATION.md — the data contract & forward-only policy

Phase 0, Task 4 of the Puck Fork Robustness Plan. This file is the contract
between the component registry (this package) and every stored page in the
fleet. If you change the registry, you answer to this document first.

## 1. The payload shape

A page is Puck `Data`, stored as a JSON string blob:

```ts
{
  content: Block[];                 // the page, top to bottom
  root: {};                         // root props (unused today, reserved)
  zones?: Record<string, Block[]>;  // legacy zones (we use slots, not zones)
}

type Block = {
  type: string;   // a component key registered in createConfig()
  props: {
    id: string;   // unique per page — required by Puck
    ...fields;    // the component's own fields
  };
};
```

### Storage (host-side, Upstash KV)

| Key                 | Meaning                                    |
| ------------------- | ------------------------------------------ |
| `puck:draft:<slug>` | the studio's working copy (autosaved)      |
| `puck:page:<slug>`  | LIVE — the only thing public routes render |
| `puck:pages`        | index set of every known slug              |

Publish copies draft → live. Public routes never read drafts.

### Conventions inside props

- **ids** — opaque and unique per page. Sources in the wild: the editor
  (Puck-generated), the AI copilot (`<Type>-<8 hex>`), seeds (`ab-<n>`).
  Never parse or assign meaning to an id.
- **Slots** — `Band.content`, `Panel.content`, `TwoColumns.left/right`,
  `ThreeColumns.a/b/c` hold nested `Block[]` inline (the Puck slot model).
  We do not use the legacy `zones` map.
- **Style objects** — text blocks carry
  `{ font, size, kerning, lineHeight, color, spaceAbove, spaceBelow }`.
  `0` means inherit; `color` is `"default"`, a house token key, or `"#hex"`.
- **Legacy blocks** — `GoldButton` predates the `Button` variant block and
  stays registered forever so pre-P3 pages render. This is the precedent:
  old payloads are never orphaned.

## 2. Forward-only migration policy

**The registry must always read existing payloads unchanged.** Concretely:

1. **Never** rename or remove a registered component type.
2. **Never** rename, remove, or repurpose a prop.
3. **Additive only** — new blocks and new optional props are always safe.
   Renders must tolerate missing props (`defaultProps` only applies to
   newly-inserted blocks, not stored ones — guard like `typo(style?)` does).
4. If a breaking shape change is truly unavoidable:
   - write a **scripted, forward-only** migration (old → new) using
     `transformProps` / `migrate` from `@puckeditor/core`;
   - run it as a deliberate sweep over the KV keys (drafts and live), never
     lazily at render time;
   - there are **no down-migrations**. Roll forward or restore from a
     KV backup taken before the sweep.
5. Renaming a component in spirit = register the new one and keep the old
   registered as an identical-rendering alias (the `GoldButton` pattern).
6. Upstream Puck data-format bumps are adopted only through upstream's own
   `migrate()`, tested against real stored payloads before any host upgrades.

## 3. Versioning & distribution

Release flow lives in `README.md` (npm pack → GitHub release asset → hosts
pin the URL). Version semantics:

| Bump  | Meaning                                                        |
| ----- | -------------------------------------------------------------- |
| patch | doc/style fixes; render tweaks that change no payload contract |
| minor | new blocks or new optional props (additive)                    |
| major | anything requiring a scripted migration — should be rare       |

## 4. Consumers

- **onecocreation** — live today (`src/lib/puck-config.tsx` shim).
- **pacsarcade / adminpacman** — planned; both consume this package when
  they gain editors, so the rails never drift between repos.
