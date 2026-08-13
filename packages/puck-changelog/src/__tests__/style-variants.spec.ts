import { changedBlockIds } from "../blocks";
import { refDiff } from "../diff";

/**
 * Phase 2 step 2 contract: styleVariants edits ride the changelog like any
 * other prop — patches land under content[i].props.styleVariants and the
 * block attribution names the edited block, so incremental-CSS and save
 * queue consumers can target regeneration per block.
 */

const block = (id: string, props: Record<string, unknown> = {}) => ({
  type: "Text",
  props: { id, text: "hello", ...props },
});

describe("styleVariants prop edits in the changelog", () => {
  it("yields patches under content[i].props.styleVariants with correct blockIds", () => {
    const prev = {
      root: { props: {} },
      content: [
        block("ab-1"),
        block("ab-2"),
        block("ab-3", { styleVariants: { tablet: { size: 20 } } }),
      ],
      zones: {},
    };

    // Structurally-shared edits, as Puck's reducer produces them:
    // ab-2 GAINS overrides; ab-3's existing tablet size changes.
    const next = {
      ...prev,
      content: [
        prev.content[0],
        {
          ...prev.content[1],
          props: {
            ...prev.content[1].props,
            styleVariants: {
              tablet: { size: 22 },
              desktop: { color: "accent" },
            },
          },
        },
        {
          ...prev.content[2],
          props: {
            ...prev.content[2].props,
            styleVariants: { tablet: { size: 24 } },
          },
        },
      ],
    };

    const { patches, inverse } = refDiff(prev, next);

    expect(patches).toEqual([
      {
        op: "add",
        path: ["content", 1, "props", "styleVariants"],
        value: { tablet: { size: 22 }, desktop: { color: "accent" } },
      },
      {
        op: "replace",
        path: ["content", 2, "props", "styleVariants", "tablet", "size"],
        value: 24,
      },
    ]);
    expect(inverse).toEqual([
      {
        op: "remove",
        path: ["content", 1, "props", "styleVariants"],
        value: undefined,
      },
      {
        op: "replace",
        path: ["content", 2, "props", "styleVariants", "tablet", "size"],
        value: 20,
      },
    ]);

    expect(changedBlockIds(patches, next as never).sort()).toEqual([
      "ab-2",
      "ab-3",
    ]);
  });
});
