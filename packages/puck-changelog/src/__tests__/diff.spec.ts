import { applyPatches } from "../apply";
import { DiffStats, refDiff } from "../diff";

const block = (
  id: string,
  type = "Text",
  props: Record<string, unknown> = {}
) => ({
  type,
  props: { id, ...props },
});

/** A realistic Puck tree: root props, content blocks, nested slots, zones. */
const makePage = () => ({
  root: { props: { title: "Home", theme: "night" } },
  content: [
    block("hero-1", "Hero", { heading: "Welcome", size: "xl" }),
    {
      type: "TwoColumns",
      props: {
        id: "cols-1",
        ratio: "50/50",
        left: [
          block("text-1", "Text", { text: "left copy" }),
          block("img-1", "Image", { src: "/a.png" }),
        ],
        right: [
          {
            type: "Panel",
            props: {
              id: "panel-1",
              content: [block("text-2", "Text", { text: "deep copy" })],
            },
          },
        ],
      },
    },
    block("cta-1", "Button", { label: "Go" }),
  ],
  zones: {
    "panel-1:extras": [block("text-3", "Text", { text: "zoned" })],
  },
});

const roundTrip = (prev: any, next: any) => {
  const { patches, inverse } = refDiff(prev, next);

  expect(applyPatches(prev, patches)).toEqual(next);
  expect(applyPatches(next, inverse)).toEqual(prev);

  return { patches, inverse };
};

describe("refDiff round-trip", () => {
  it("returns no patches for identical references", () => {
    const page = makePage();
    const { patches, inverse } = refDiff(page, page);

    expect(patches).toEqual([]);
    expect(inverse).toEqual([]);
  });

  it("round-trips a nested slot prop edit", () => {
    const prev = makePage();
    const next = makePage();
    (next.content[1].props as any).right[0].props.content[0].props.text =
      "edited deep copy";

    roundTrip(prev, next);
  });

  it("round-trips an insert at the end of content", () => {
    const prev = makePage();
    const next = makePage();
    next.content.push(block("new-1", "Text", { text: "appended" }));

    const { patches } = roundTrip(prev, next);
    expect(patches).toEqual([
      { op: "add", path: ["content", 3], value: next.content[3] },
    ]);
  });

  it("round-trips an insert in the middle of content (naive index diff)", () => {
    const prev = makePage();
    const next = makePage();
    next.content.splice(1, 0, block("new-2", "Band", {}));

    roundTrip(prev, next);
  });

  it("round-trips a removal from the middle of content", () => {
    const prev = makePage();
    const next = makePage();
    next.content.splice(1, 1);

    roundTrip(prev, next);
  });

  it("round-trips a reorder (move becomes remove+add / replaces)", () => {
    const prev = makePage();
    const next = makePage();
    const [moved] = next.content.splice(0, 1);
    next.content.push(moved);

    roundTrip(prev, next);
  });

  it("round-trips zone additions and removals", () => {
    const prev = makePage();
    const next = makePage();
    (next.zones as any)["cols-1:aside"] = [block("text-4")];
    delete (next.zones as any)["panel-1:extras"];

    roundTrip(prev, next);
  });

  it("round-trips root prop edits", () => {
    const prev = makePage();
    const next = makePage();
    (next.root.props as any).title = "About";
    delete (next.root.props as any).theme;

    roundTrip(prev, next);
  });

  it("round-trips a kind change (object -> scalar)", () => {
    const prev = { root: { props: { meta: { a: 1 } } }, content: [] };
    const next = { root: { props: { meta: "flat" } }, content: [] };

    roundTrip(prev, next);
  });

  it("round-trips slot array growth and shrink together", () => {
    const prev = makePage();
    const next = makePage();
    const left = (next.content[1].props as any).left;
    left.splice(0, 1); // shrink
    (next.content[1].props as any).right.push(block("text-5")); // grow

    roundTrip(prev, next);
  });
});

describe("applyPatches structural sharing", () => {
  it("preserves identity of untouched subtrees", () => {
    const prev = makePage();
    const next = makePage();
    (next.content[2].props as any).label = "Go now";

    const { patches } = refDiff(prev, next);
    const result: any = applyPatches(prev as any, patches);

    expect(result).toEqual(next);
    // Untouched blocks keep their identity...
    expect(result.content[0]).toBe(prev.content[0]);
    expect(result.content[1]).toBe(prev.content[1]);
    expect(result.zones).toBe(prev.zones);
    // ...while the touched spine is new.
    expect(result.content[2]).not.toBe(prev.content[2]);
    expect(result).not.toBe(prev);
  });
});

describe("refDiff reference pruning", () => {
  it("visits far fewer nodes than the tree holds on a structurally-shared edit", () => {
    // ~500 blocks: 10 sections, each with a 50-block slot.
    const sections = Array.from({ length: 10 }, (_, s) => ({
      type: "Band",
      props: {
        id: `band-${s}`,
        content: Array.from({ length: 50 }, (_, i) =>
          block(`b-${s}-${i}`, "Text", { text: `t-${s}-${i}` })
        ),
      },
    }));

    const prev = { root: { props: { title: "Big" } }, content: sections };

    // Mutate ONE nested block via structural sharing: clone only the spine,
    // reuse every untouched subtree by reference (as Puck's reducer does).
    const target = 7;
    const next = {
      ...prev,
      content: prev.content.map((section, s) =>
        s !== target
          ? section
          : {
              ...section,
              props: {
                ...section.props,
                content: section.props.content.map((child, i) =>
                  i !== 25
                    ? child
                    : {
                        ...child,
                        props: { ...child.props, text: "edited" },
                      }
                ),
              },
            }
      ),
    };

    const stats: DiffStats = { visits: 0 };
    const { patches, inverse } = refDiff(prev, next, stats);

    expect(applyPatches(prev as any, patches)).toEqual(next);
    expect(applyPatches(next as any, inverse)).toEqual(prev);
    expect(patches).toEqual([
      {
        op: "replace",
        path: ["content", 7, "props", "content", 25, "props", "text"],
        value: "edited",
      },
    ]);

    // 510 blocks -> >1500 nodes in the tree. The pruned differ should touch
    // roughly (top fan-out + one slot fan-out + spine) nodes.
    const totalBlocks = 510;
    expect(stats.visits).toBeLessThan(150);
    expect(stats.visits).toBeLessThan(totalBlocks / 3);
  });
});
