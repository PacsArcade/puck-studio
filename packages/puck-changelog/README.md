# @pacsarcade/puck-changelog

The change-log substrate for puck-studio (Plasmic gap-map §0): a
reference-pruned patch stream captured from Puck's `onAction`, with inverse
patches, slot-aware block attribution, and a ring buffer that folds evicted
records into its base — so `replay(base().data, records())` always equals the
current document. One log for the consumers to come: undo view-state,
incremental CSS, the save queue, multiplayer rebase.

## Use

```tsx
import { createChangelog } from "@pacsarcade/puck-changelog";
import {
  ChangelogBridge,
  useApplyData,
} from "@pacsarcade/puck-changelog/react";

const log = createChangelog(initialData);

<Puck config={config} data={initialData} onAction={log.onAction}>
  <ChangelogBridge
    log={log}
    captureViewState={() => snapshotHostView()}
    restoreViewState={(saved) => restoreHostView(saved)}
  />
  {/* ... */}
</Puck>;

// Programmatic / copilot edits that stay attributed:
const applyData = useApplyData(log); // inside <Puck>
applyData(nextData, "copilot");
```

The bridge rides Puck's own history slice: it never duplicates undo, it only
re-tags the records Puck's undo/redo produce (`origin: "undo" | "redo"`) and
restores host view state alongside.

Ships raw TypeScript (`files: ["src"]`); hosts consume via
`transpilePackages`, same as the rest of the fleet.

## Pack → release

```bash
cd packages/puck-changelog
npm pack
gh release create puck-changelog-v0.1.1 pacsarcade-puck-changelog-0.1.1.tgz \
  --repo PacsArcade/puck-studio --title "puck-changelog 0.1.1" --notes "..."
```

Hosts install from the release tarball URL. Never published to npm.
