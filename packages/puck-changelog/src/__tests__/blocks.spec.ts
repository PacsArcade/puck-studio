import { changedBlockIds } from "../blocks";
import type { Patch } from "../types";

const block = (
  id: string,
  type = "Text",
  props: Record<string, unknown> = {}
) => ({
  type,
  props: { id, ...props },
});

const page: any = {
  root: { props: { title: "Home" } },
  content: [
    {
      type: "Band",
      props: {
        id: "band-1",
        content: [
          block("text-1", "Text", { text: "hi" }),
          {
            type: "TwoColumns",
            props: {
              id: "cols-1",
              left: [block("text-2", "Text", { text: "left" })],
              right: [block("text-3", "Text", { text: "right" })],
            },
          },
        ],
      },
    },
    block("cta-1", "Button", { label: "Go" }),
  ],
  zones: {
    "band-1:extras": [block("text-4", "Text", { text: "zoned" })],
  },
};

describe("changedBlockIds", () => {
  it("maps a top-level prop edit to its block", () => {
    const patches: Patch[] = [
      { op: "replace", path: ["content", 1, "props", "label"], value: "Stop" },
    ];

    expect(changedBlockIds(patches, page)).toEqual(["cta-1"]);
  });

  it("maps an edit inside a nested slot to the deepest enclosing block", () => {
    const patches: Patch[] = [
      {
        op: "replace",
        path: [
          "content",
          0,
          "props",
          "content",
          1,
          "props",
          "left",
          0,
          "props",
          "text",
        ],
        value: "edited",
      },
    ];

    expect(changedBlockIds(patches, page)).toEqual(["text-2"]);
  });

  it("maps a slot-array insertion to the inserted block's id", () => {
    const inserted = block("new-1");
    const patches: Patch[] = [
      {
        op: "add",
        path: ["content", 0, "props", "content", 2],
        value: inserted,
      },
    ];

    const ids = changedBlockIds(patches, page);
    expect(ids).toContain("new-1");
  });

  it("maps zone edits through the zones record", () => {
    const patches: Patch[] = [
      {
        op: "replace",
        path: ["zones", "band-1:extras", 0, "props", "text"],
        value: "rezoned",
      },
    ];

    expect(changedBlockIds(patches, page)).toEqual(["text-4"]);
  });

  it("returns no ids for root-only edits", () => {
    const patches: Patch[] = [
      { op: "replace", path: ["root", "props", "title"], value: "About" },
    ];

    expect(changedBlockIds(patches, page)).toEqual([]);
  });

  it("falls back to the resolvable prefix for dangling remove paths", () => {
    // Removing the last child of cols-1's right slot: the path no longer
    // resolves in `next`, but the enclosing block does.
    const next: any = JSON.parse(JSON.stringify(page));
    next.content[0].props.content[1].props.right = [];

    const patches: Patch[] = [
      {
        op: "remove",
        path: ["content", 0, "props", "content", 1, "props", "right", 0],
      },
    ];

    expect(changedBlockIds(patches, next)).toEqual(["cols-1"]);
  });

  it("does not attribute block-shaped prop VALUES — blocks live at slot positions only", () => {
    // A block-shaped object stored as an ordinary prop value (a template,
    // a copied snippet…) is data, not a block on the page.
    const next: any = JSON.parse(JSON.stringify(page));
    next.content[1].props.template = {
      type: "Button",
      props: { id: "tmpl-1", label: "stored" },
    };

    // Edit INSIDE the stored value → attributed to the enclosing real
    // block, never to the stored value's id.
    const editInside: Patch[] = [
      {
        op: "replace",
        path: ["content", 1, "props", "template", "props", "label"],
        value: "edited",
      },
    ];
    expect(changedBlockIds(editInside, next)).toEqual(["cta-1"]);

    // Replace the stored value wholesale → same: cta-1, not tmpl-1.
    const replaceValue: Patch[] = [
      {
        op: "replace",
        path: ["content", 1, "props", "template"],
        value: { type: "Button", props: { id: "tmpl-2", label: "new" } },
      },
    ];
    expect(changedBlockIds(replaceValue, next)).toEqual(["cta-1"]);
  });

  it("empty-string ids never attribute — the change falls to the enclosing block without crashing", () => {
    const next: any = JSON.parse(JSON.stringify(page));
    // An id-less (empty string) block inside band-1's slot.
    next.content[0].props.content.push({
      type: "Text",
      props: { id: "", text: "anon" },
    });

    // Edit inside the id-"" block → falls through to band-1.
    const editInside: Patch[] = [
      {
        op: "replace",
        path: ["content", 0, "props", "content", 2, "props", "text"],
        value: "edited",
      },
    ];
    expect(changedBlockIds(editInside, next)).toEqual(["band-1"]);

    // Adding a block whose id is "" at a slot position attributes nothing
    // for the value itself — only the enclosing block.
    const addAnon: Patch[] = [
      {
        op: "add",
        path: ["content", 0, "props", "content", 2],
        value: { type: "Text", props: { id: "", text: "anon" } },
      },
    ];
    expect(changedBlockIds(addAnon, next)).toEqual(["band-1"]);
  });

  it("still detects sibling slots when one member has an empty-string id", () => {
    const next: any = JSON.parse(JSON.stringify(page));
    next.content[0].props.content.push({
      type: "Text",
      props: { id: "", text: "anon" },
    });

    // The array stays a slot (empty id still matches the block SHAPE), so
    // a valid sibling keeps attributing normally.
    const patches: Patch[] = [
      {
        op: "replace",
        path: ["content", 0, "props", "content", 0, "props", "text"],
        value: "edited",
      },
    ];
    expect(changedBlockIds(patches, next)).toEqual(["text-1"]);
  });

  it("dedupes ids across patches", () => {
    const patches: Patch[] = [
      { op: "replace", path: ["content", 1, "props", "label"], value: "A" },
      { op: "replace", path: ["content", 1, "props", "variant"], value: "B" },
    ];

    expect(changedBlockIds(patches, page)).toEqual(["cta-1"]);
  });
});
