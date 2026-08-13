import {
  activeStack,
  comboKey,
  createRegistry,
  definedAt,
  isAncestorCombo,
  matchesWidth,
  parseComboKey,
  resolve,
  screenComboForWidth,
  screenVariantsFromBreakpoints,
  sortCombos,
  type VariantDef,
  type VariantedProps,
} from "../index";

/** STARTER breakpoints — the fleet's default cartridge values. */
const BP = { tabletMin: 768, desktopMin: 1080 };
const reg = () => createRegistry(screenVariantsFromBreakpoints(BP));

describe("createRegistry strategy inference", () => {
  it("infers mobileFirst when every screen spec is min-width-only", () => {
    expect(reg().strategy).toBe("mobileFirst");
  });

  it("infers desktopFirst when every screen spec is max-width-only", () => {
    const variants: VariantDef[] = [
      {
        key: "tablet",
        kind: "screen",
        group: "screen",
        screen: { maxWidth: 1079 },
      },
      {
        key: "phone",
        kind: "screen",
        group: "screen",
        screen: { maxWidth: 767 },
      },
    ];
    expect(createRegistry(variants).strategy).toBe("desktopFirst");
  });

  it("falls to unknown on mixed specs and on empty registries", () => {
    const mixed: VariantDef[] = [
      { key: "a", kind: "screen", group: "screen", screen: { minWidth: 768 } },
      { key: "b", kind: "screen", group: "screen", screen: { maxWidth: 767 } },
    ];
    expect(createRegistry(mixed).strategy).toBe("unknown");
    expect(createRegistry([]).strategy).toBe("unknown");
  });
});

describe("matchesWidth boundaries", () => {
  const tablet = { minWidth: BP.tabletMin };
  const desktop = { minWidth: BP.desktopMin };

  it("767 misses tablet, 768 hits it (inclusive min)", () => {
    expect(matchesWidth(tablet, 767)).toBe(false);
    expect(matchesWidth(tablet, 768)).toBe(true);
  });

  it("1079 misses desktop, 1080 hits it", () => {
    expect(matchesWidth(desktop, 1079)).toBe(false);
    expect(matchesWidth(desktop, 1080)).toBe(true);
  });

  it("screenComboForWidth stacks ALL matching screens", () => {
    const r = reg();
    expect(screenComboForWidth(r, 390)).toEqual([]);
    expect(screenComboForWidth(r, 768)).toEqual(["tablet"]);
    expect(screenComboForWidth(r, 1079)).toEqual(["tablet"]);
    expect(screenComboForWidth(r, 1200)).toEqual(["tablet", "desktop"]);
  });
});

describe("comboKey / parseComboKey", () => {
  it("sorts by registry order and joins with '+'", () => {
    const r = reg();
    expect(comboKey(r, ["desktop", "tablet"])).toBe("tablet+desktop");
    expect(comboKey(r, [])).toBe("");
    expect(parseComboKey("tablet+desktop")).toEqual(["tablet", "desktop"]);
    expect(parseComboKey("")).toEqual([]);
  });
});

describe("isAncestorCombo", () => {
  const r = reg();

  it("base [] is an ancestor of everything", () => {
    expect(isAncestorCombo(r, [], [])).toBe(true);
    expect(isAncestorCombo(r, ["tablet"], [])).toBe(true);
    expect(isAncestorCombo(r, ["tablet", "desktop"], [])).toBe(true);
  });

  it("under mobileFirst, tablet is an ancestor of desktop (narrower minWidth)", () => {
    expect(isAncestorCombo(r, ["desktop"], ["tablet"])).toBe(true);
    expect(isAncestorCombo(r, ["tablet"], ["desktop"])).toBe(false);
  });

  it("membership always counts; a combo is its own ancestor", () => {
    expect(isAncestorCombo(r, ["tablet", "desktop"], ["desktop"])).toBe(true);
    expect(isAncestorCombo(r, ["tablet"], ["tablet"])).toBe(true);
    expect(isAncestorCombo(r, [], ["tablet"])).toBe(false);
  });

  it("no screen inference under unknown strategy", () => {
    const mixed = createRegistry([
      { key: "a", kind: "screen", group: "screen", screen: { minWidth: 768 } },
      { key: "b", kind: "screen", group: "screen", screen: { maxWidth: 767 } },
    ]);
    expect(isAncestorCombo(mixed, ["a"], ["b"])).toBe(false);
  });
});

describe("sortCombos", () => {
  it("guarantees base < tablet < desktop under mobileFirst", () => {
    expect(sortCombos(reg(), [["desktop"], [], ["tablet"]])).toEqual([
      [],
      ["tablet"],
      ["desktop"],
    ]);
  });

  it("is stable for equal ranks", () => {
    const first = ["tablet"];
    const second = ["tablet"];
    const sorted = sortCombos(reg(), [first, second]);
    expect(sorted[0]).toBe(first);
    expect(sorted[1]).toBe(second);
  });
});

type Style = { size: number; color: string; kerning?: number };
const base: Style = { size: 17, color: "ink" };

describe("resolve sparse-merge", () => {
  const r = reg();
  const settings: VariantedProps<Style> = {
    tablet: { size: 20 },
    desktop: { color: "accent" },
  };

  it("base combo resolves to the base alone", () => {
    expect(resolve(r, base, settings, [])).toEqual(base);
  });

  it("absent keys inherit down the stack", () => {
    expect(resolve(r, base, settings, ["tablet"])).toEqual({
      size: 20,
      color: "ink",
    });
    // desktop-active width carries both layers: tablet's size persists
    expect(resolve(r, base, settings, ["tablet", "desktop"])).toEqual({
      size: 20,
      color: "accent",
    });
  });

  it("a PRESENT value always wins — even 0 (the field layer, not the engine, enforces 'clear deletes the key, never writes 0')", () => {
    expect(resolve(r, base, { tablet: { size: 0 } }, ["tablet"]).size).toBe(0);
  });

  it("more specific layers win over ancestors", () => {
    const s = { tablet: { size: 20 }, desktop: { size: 28 } };
    expect(resolve(r, base, s, ["tablet", "desktop"]).size).toBe(28);
  });

  it("activeStack orders ancestors before descendants", () => {
    const stack = activeStack(r, settings, ["tablet", "desktop"]);
    expect(stack.map((l) => l.combo)).toEqual([["tablet"], ["desktop"]]);
  });
});

describe("definedAt attribution", () => {
  const r = reg();
  const settings = { tablet: { size: 20 } };

  it("'set' when the target layer holds the key", () => {
    expect(definedAt(r, base, settings, ["tablet"], "size")).toEqual({
      state: "set",
      source: "tablet",
      value: 20,
    });
  });

  it("'inherited' from the nearest ancestor layer", () => {
    expect(definedAt(r, base, settings, ["desktop"], "size")).toEqual({
      state: "inherited",
      source: "tablet",
      value: 20,
    });
  });

  it("'inherited' from base when no layer holds the key", () => {
    expect(definedAt(r, base, settings, ["desktop"], "color")).toEqual({
      state: "inherited",
      source: "base",
      value: "ink",
    });
  });

  it("targeting base reports 'set' at base", () => {
    expect(definedAt(r, base, settings, [], "size")).toEqual({
      state: "set",
      source: "base",
      value: 17,
    });
  });
});
