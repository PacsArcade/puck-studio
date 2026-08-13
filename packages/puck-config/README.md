# @pacsarcade/puck-config

The fleet's shared Puck component registry (Phase 0, Task 3 of the Puck Fork
Robustness Plan). Extracted from onecocreation's `src/lib/puck-config.tsx`
with **zero behavior change** — hosts call `createConfig()` with their brand
assets and get the exact registry the site rendered before extraction.

```tsx
import { createConfig } from "@pacsarcade/puck-config";

export const config = createConfig({
  assets: { nebula: "/images/nebula.webp", meteors: "/images/meteors.webp" },
});
```

Ships raw TSX (the `arcade-ui` pattern): consumers add
`transpilePackages: ["@pacsarcade/puck-config"]` in `next.config`.

Distribution: `npm pack` tarball attached to a GitHub release on this repo,
pinned by URL in each host's `package.json`. Nothing publishes to npm —
this fork consumes upstream Puck; it never publishes as Puck.
