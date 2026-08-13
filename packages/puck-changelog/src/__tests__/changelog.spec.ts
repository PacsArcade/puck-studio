import type { AppState, PuckAction } from "@puckeditor/core";
import { createChangelog } from "../changelog";
import type { ChangeRecord } from "../types";

const block = (
  id: string,
  type = "Text",
  props: Record<string, unknown> = {}
) => ({
  type,
  props: { id, ...props },
});

const makeData = (): any => ({
  root: { props: { title: "Home" } },
  content: [block("a", "Text", { text: "one" })],
  zones: {},
});

const mkState = (data: any): AppState =>
  ({ data, ui: {} } as unknown as AppState);

const setData = { type: "setData", data: {} } as PuckAction;

/** Structurally-shared edit of block index 0's `text` prop. */
const editText = (data: any, text: string): any => ({
  ...data,
  content: [
    { ...data.content[0], props: { ...data.content[0].props, text } },
    ...data.content.slice(1),
  ],
});

describe("createChangelog", () => {
  it("records data-touching actions with monotonic revs", () => {
    const data = makeData();
    const log = createChangelog(data);

    let current = data;
    for (let i = 1; i <= 3; i++) {
      const next = editText(current, `t${i}`);
      log.onAction(setData, mkState(next), mkState(current));
      current = next;
    }

    expect(log.rev()).toBe(3);
    expect(log.records().map((r) => r.rev)).toEqual([1, 2, 3]);
    expect(log.records().every((r) => r.action === "setData")).toBe(true);
    expect(log.records().every((r) => r.origin === "editor")).toBe(true);
  });

  it("starts at baseRev when provided", () => {
    const data = makeData();
    const log = createChangelog(data, { baseRev: 40 });

    log.onAction(setData, mkState(editText(data, "x")), mkState(data));

    expect(log.base().rev).toBe(40);
    expect(log.rev()).toBe(41);
    expect(log.records()[0].rev).toBe(41);
  });

  it("skips ui-only and zone-registration actions", () => {
    const data = makeData();
    const log = createChangelog(data);
    const next = editText(data, "changed");

    log.onAction(
      { type: "setUi", ui: {} } as PuckAction,
      mkState(next),
      mkState(data)
    );
    log.onAction(
      { type: "registerZone", zone: "z" } as PuckAction,
      mkState(next),
      mkState(data)
    );
    log.onAction(
      { type: "unregisterZone", zone: "z" } as PuckAction,
      mkState(next),
      mkState(data)
    );

    expect(log.records()).toHaveLength(0);
    expect(log.rev()).toBe(0);
  });

  it("skips actions where data identity is unchanged", () => {
    const data = makeData();
    const log = createChangelog(data);

    log.onAction(setData, mkState(data), mkState(data));

    expect(log.records()).toHaveLength(0);
  });

  it("skips deep-equal changes with new identity", () => {
    const data = makeData();
    const log = createChangelog(data);
    const sameButNew = { ...data, content: [...data.content] };

    log.onAction(setData, mkState(sameButNew), mkState(data));

    expect(log.records()).toHaveLength(0);
  });

  it("attributes changed blocks, including removed ones", () => {
    const data = makeData();
    data.content.push(block("b", "Text", { text: "two" }));

    const log = createChangelog(data);

    // Edit block "a"
    const edited = editText(data, "edited");
    log.onAction(setData, mkState(edited), mkState(data));
    expect(log.records()[0].blockIds).toContain("a");

    // Remove block "b" — only visible walking the inverse against prev
    const removed = { ...edited, content: edited.content.slice(0, 1) };
    log.onAction(setData, mkState(removed), mkState(edited));
    expect(log.records()[1].blockIds).toContain("b");
  });

  it("markNextOrigin tags only the next record, then resets to editor", () => {
    const data = makeData();
    const log = createChangelog(data);

    log.markNextOrigin("copilot");

    // A skipped action must NOT consume the pending origin
    log.onAction(
      { type: "setUi", ui: {} } as PuckAction,
      mkState(data),
      mkState(data)
    );

    const next1 = editText(data, "one!");
    log.onAction(setData, mkState(next1), mkState(data));

    const next2 = editText(next1, "two!");
    log.onAction(setData, mkState(next2), mkState(next1));

    expect(log.records()[0].origin).toBe("copilot");
    expect(log.records()[1].origin).toBe("editor");
  });

  it("emits every record to subscribers and onRecord, until unsubscribed", () => {
    const data = makeData();
    const onRecord = jest.fn();
    const log = createChangelog(data, { onRecord });

    const seen: ChangeRecord[] = [];
    const unsubscribe = log.subscribe((rec) => seen.push(rec));

    const next1 = editText(data, "one!");
    log.onAction(setData, mkState(next1), mkState(data));

    unsubscribe();

    const next2 = editText(next1, "two!");
    log.onAction(setData, mkState(next2), mkState(next1));

    expect(seen.map((r) => r.rev)).toEqual([1]);
    expect(onRecord).toHaveBeenCalledTimes(2);
  });

  it("folds evicted records into base so replay always equals current", () => {
    const data = makeData();
    const log = createChangelog(data, { maxRecords: 10 });

    let current = data;
    for (let i = 1; i <= 50; i++) {
      let next = editText(current, `t${i}`);
      if (i % 10 === 0) {
        // Mix inserts in so the fold handles structure, not just scalars
        next = {
          ...next,
          content: [...next.content, block(`inserted-${i}`)],
        };
      }
      log.onAction(setData, mkState(next), mkState(current));
      current = next;
    }

    expect(log.rev()).toBe(50);
    expect(log.records()).toHaveLength(10);
    expect(log.base().rev).toBe(40);
    expect(log.records()[0].rev).toBe(41);

    // THE invariant: base + retained records == current document
    expect(log.replay(log.base().data, log.records())).toEqual(current);
  });

  it("serializes to a JSON-safe snapshot", () => {
    const data = makeData();
    const log = createChangelog(data, { baseRev: 5 });

    const next = editText(data, "snap");
    log.onAction(setData, mkState(next), mkState(data));

    const snap = log.serialize();

    expect(snap.version).toBe(1);
    expect(snap.rev).toBe(6);
    expect(snap.base).toEqual({ rev: 5, data });
    expect(snap.records).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
  });

  it("replay applies records over an arbitrary base", () => {
    const data = makeData();
    const log = createChangelog(data);

    let current = data;
    for (let i = 1; i <= 5; i++) {
      const next = editText(current, `r${i}`);
      log.onAction(setData, mkState(next), mkState(current));
      current = next;
    }

    expect(log.replay(data, log.records())).toEqual(current);
    expect(log.replay(data, log.records().slice(0, 2))).toEqual(
      editText(editText(data, "r1"), "r2")
    );
  });
});
