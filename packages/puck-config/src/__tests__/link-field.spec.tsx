import { act, cleanup, fireEvent, render } from "@testing-library/react";
import "@testing-library/jest-dom";

/**
 * LinkPickerField specs (STUDIO RESPONSIVE batch): mode inference,
 * the never-silently-rewrite custom option, fail-soft fetch, and the
 * createConfig linkField DI (all THREE href sites swap together).
 */

import { LinkPickerField, createConfig, type LinkFieldSources } from "../index";

const flush = async () => act(async () => {});

const SOURCES: LinkFieldSources = {
  staticRoutes: [
    { label: "Home", path: "/" },
    { label: "Book a reading", path: "/book" },
  ],
  fetchPages: () => Promise.resolve(["my-story", "offerings"]),
  pagePath: (slug) => `/p/${slug}`,
};

const getSelect = (c: HTMLElement): HTMLSelectElement => {
  const el = c.querySelector("select");
  if (!el) throw new Error("internal select not rendered");
  return el;
};

afterEach(cleanup);

describe("LinkPickerField — mode inference", () => {
  it("a static-route value mounts in Internal mode, value selected", async () => {
    const { container } = render(
      <LinkPickerField value="/book" onChange={jest.fn()} sources={SOURCES} />
    );
    await flush();
    const select = getSelect(container);
    expect(select.value).toBe("/book");
    expect(
      container.querySelector('optgroup[label="Site pages"]')
    ).toBeTruthy();
  });

  it("an external value mounts in External mode with the text input", async () => {
    const { container } = render(
      <LinkPickerField
        value="https://pacsarcade.org"
        onChange={jest.fn()}
        sources={SOURCES}
      />
    );
    await flush();
    const input =
      container.querySelector<HTMLInputElement>('input[type="text"]');
    expect(input).toBeTruthy();
    expect(input!.value).toBe("https://pacsarcade.org");
    expect(container.querySelector("select")).toBeNull();
  });

  it("a studio-page value upgrades to Internal once pages arrive", async () => {
    const { container } = render(
      <LinkPickerField
        value="/p/my-story"
        onChange={jest.fn()}
        sources={SOURCES}
      />
    );
    await flush(); // fetchPages resolves → late inference upgrade
    const select = getSelect(container);
    expect(select.value).toBe("/p/my-story");
    const studio = container.querySelector('optgroup[label="Studio pages"]');
    expect(studio).toBeTruthy();
    expect(studio!.querySelectorAll("option")).toHaveLength(2);
  });
});

describe("LinkPickerField — custom option & segment law", () => {
  it("an unknown value shown in Internal becomes a DISABLED custom option", async () => {
    const onChange = jest.fn();
    const { container, getByText } = render(
      <LinkPickerField value="/weird" onChange={onChange} sources={SOURCES} />
    );
    await flush();
    // inferred External; the operator flips the segment
    fireEvent.click(getByText("Internal page"));
    const select = getSelect(container);
    expect(select.value).toBe("/weird"); // never silently rewritten
    const custom = getByText("custom: /weird") as HTMLOptionElement;
    expect(custom.disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled(); // switching never writes
  });

  it("switching segments back and forth never clears the value", async () => {
    const onChange = jest.fn();
    const { container, getByText } = render(
      <LinkPickerField value="/book" onChange={onChange} sources={SOURCES} />
    );
    await flush();
    fireEvent.click(getByText("External URL"));
    expect(
      container.querySelector<HTMLInputElement>('input[type="text"]')!.value
    ).toBe("/book");
    fireEvent.click(getByText("Internal page"));
    expect(getSelect(container).value).toBe("/book");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("picking a page writes the path; typing external writes the text", async () => {
    const onChange = jest.fn();
    const { container } = render(
      <LinkPickerField value="/book" onChange={onChange} sources={SOURCES} />
    );
    await flush();
    fireEvent.change(getSelect(container), {
      target: { value: "/p/offerings" },
    });
    expect(onChange).toHaveBeenCalledWith("/p/offerings");
  });
});

describe("LinkPickerField — fail-soft fetch", () => {
  it("a rejecting fetchPages leaves the static list only", async () => {
    const sources: LinkFieldSources = {
      ...SOURCES,
      fetchPages: () => Promise.reject(new Error("kv down")),
    };
    const { container, getByText } = render(
      <LinkPickerField value="" onChange={jest.fn()} sources={sources} />
    );
    await flush();
    fireEvent.click(getByText("Internal page"));
    expect(
      container.querySelector('optgroup[label="Site pages"]')
    ).toBeTruthy();
    expect(
      container.querySelector('optgroup[label="Studio pages"]')
    ).toBeNull();
  });

  it("a synchronously-throwing fetchPages is survived too", async () => {
    const sources: LinkFieldSources = {
      ...SOURCES,
      fetchPages: () => {
        throw new Error("boom");
      },
    };
    expect(() =>
      render(
        <LinkPickerField value="/book" onChange={jest.fn()} sources={sources} />
      )
    ).not.toThrow();
    await flush();
  });

  it("no fetchPages at all → static list only", async () => {
    const sources: LinkFieldSources = {
      staticRoutes: SOURCES.staticRoutes,
      pagePath: SOURCES.pagePath,
    };
    const { container } = render(
      <LinkPickerField value="/book" onChange={jest.fn()} sources={sources} />
    );
    await flush();
    expect(
      container.querySelector('optgroup[label="Studio pages"]')
    ).toBeNull();
  });
});

describe("createConfig linkField DI", () => {
  const assets = {
    nebula: "/images/nebula.webp",
    meteors: "/images/meteors.webp",
  };

  type FieldRec = { type: string } & Record<string, unknown>;
  const hrefFieldsOf = (config: ReturnType<typeof createConfig>) => {
    const c = config.components as Record<
      string,
      { fields?: Record<string, unknown> }
    >;
    const buttons = c.Buttons.fields?.buttons as {
      arrayFields: Record<string, FieldRec>;
    };
    return {
      button: c.Button.fields?.href as FieldRec,
      goldButton: c.GoldButton.fields?.href as FieldRec,
      buttonsItem: buttons.arrayFields.href,
    };
  };

  it("without linkField all three href sites stay plain text fields", () => {
    const { button, goldButton, buttonsItem } = hrefFieldsOf(
      createConfig({ assets })
    );
    expect(button.type).toBe("text");
    expect(goldButton.type).toBe("text");
    expect(buttonsItem.type).toBe("text");
  });

  it("with linkField all three href sites become the SAME custom field", () => {
    const linkField = jest.fn(() => <div data-testid="link-picker" />);
    const { button, goldButton, buttonsItem } = hrefFieldsOf(
      createConfig({ assets, linkField })
    );
    expect(button.type).toBe("custom");
    expect(goldButton.type).toBe("custom");
    expect(buttonsItem.type).toBe("custom");
    expect(button.render).toBe(linkField);
    expect(goldButton.render).toBe(linkField);
    expect(buttonsItem.render).toBe(linkField);
  });
});
