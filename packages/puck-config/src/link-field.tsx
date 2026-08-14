"use client";

import { useEffect, useRef, useState } from "react";

/**
 * LinkPickerField — the href field for Button / GoldButton / Buttons
 * (STUDIO RESPONSIVE batch). A segmented [Internal page | External URL]
 * picker over a PLAIN STRING payload (href is unchanged — no migration):
 *
 *  - Internal: a <select> with optgroups "Site pages" (the host's static
 *    routes) and "Studio pages" (fetched slugs mapped through pagePath).
 *    A committed value that matches no known option becomes a DISABLED
 *    `custom: <value>` entry — shown, never silently rewritten;
 *  - External: a text input (also the lane for #anchor, mailto:, tel:);
 *  - mode is INFERRED on mount (value matches a known internal option →
 *    Internal, else External) and upgraded once studio pages arrive, but
 *    only until the operator touches the segments; switching segments
 *    NEVER clears a committed value;
 *  - fetchPages is fail-soft: reject/throw → static list only.
 */

export type LinkFieldSources = {
  /** hard routes of the site shell, e.g. { label: "Book", path: "/book" } */
  staticRoutes: { label: string; path: string }[];
  /** studio page slugs; fail-soft (absent/reject/throw → static list only) */
  fetchPages?: () => Promise<string[]>;
  /** slug → live path, e.g. (slug) => `/p/${slug}` */
  pagePath: (slug: string) => string;
};

export type LinkPickerFieldProps = {
  value: string;
  onChange: (v: string) => void;
  sources: LinkFieldSources;
};

type LinkMode = "internal" | "external";

const SEGMENT: React.CSSProperties = {
  flex: 1,
  border: "none",
  borderRadius: 999,
  padding: "5px 10px",
  fontSize: 11,
  lineHeight: 1,
  cursor: "pointer",
  background: "transparent",
  color: "var(--puck-color-text-muted, #9a8fae)",
};

const SEGMENT_ACTIVE: React.CSSProperties = {
  ...SEGMENT,
  cursor: "default",
  fontWeight: 700,
  background: "var(--puck-color-interactive-soft, rgba(139,118,196,.22))",
  color: "var(--puck-color-text, #e9e3fa)",
};

const INPUT: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: 12,
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid var(--puck-color-border, rgba(139,118,196,.45))",
  background: "var(--puck-color-surface, transparent)",
  color: "var(--puck-color-text, inherit)",
};

export function LinkPickerField({
  value,
  onChange,
  sources,
}: LinkPickerFieldProps) {
  const committed = value ?? "";
  const staticPaths = sources.staticRoutes.map((r) => r.path);

  const [slugs, setSlugs] = useState<string[]>([]);
  const [mode, setMode] = useState<LinkMode>(() =>
    staticPaths.includes(committed) ? "internal" : "external"
  );
  /** once the operator picks a segment, inference stops second-guessing */
  const touched = useRef(false);

  // fetch studio pages once — fail-soft in every failure shape
  useEffect(() => {
    let alive = true;
    try {
      sources.fetchPages?.().then(
        (list) => {
          if (alive && Array.isArray(list)) setSlugs(list);
        },
        () => {
          /* fail-soft: static list only */
        }
      );
    } catch {
      /* fail-soft: a synchronous throw counts as a failed fetch */
    }
    return () => {
      alive = false;
    };
    // mount-only: the picker fetches once per mount by design
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // late inference upgrade: studio pages arrive async — if the committed
  // value turns out to be one of them, adopt Internal (untouched only).
  useEffect(() => {
    if (touched.current || mode === "internal") return;
    if (slugs.some((s) => sources.pagePath(s) === committed)) {
      setMode("internal");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugs]);

  const studioOptions = slugs.map((slug) => ({
    slug,
    path: sources.pagePath(slug),
  }));
  const valueKnown =
    staticPaths.includes(committed) ||
    studioOptions.some((o) => o.path === committed);

  const pick = (next: LinkMode): void => {
    touched.current = true;
    setMode(next); // segments only switch the lens — never the value
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        role="group"
        aria-label="link type"
        style={{
          display: "flex",
          gap: 2,
          padding: 3,
          borderRadius: 999,
          border: "1px solid var(--puck-color-border, rgba(139,118,196,.45))",
        }}
      >
        <button
          type="button"
          aria-pressed={mode === "internal"}
          onClick={() => pick("internal")}
          style={mode === "internal" ? SEGMENT_ACTIVE : SEGMENT}
        >
          Internal page
        </button>
        <button
          type="button"
          aria-pressed={mode === "external"}
          onClick={() => pick("external")}
          style={mode === "external" ? SEGMENT_ACTIVE : SEGMENT}
        >
          External URL
        </button>
      </div>

      {mode === "internal" ? (
        <select
          aria-label="internal page"
          value={committed}
          onChange={(e) => onChange(e.currentTarget.value)}
          style={{ ...INPUT, cursor: "pointer" }}
        >
          {committed === "" && (
            <option value="" disabled>
              Choose a page…
            </option>
          )}
          {committed !== "" && !valueKnown && (
            <option value={committed} disabled>
              custom: {committed}
            </option>
          )}
          <optgroup label="Site pages">
            {sources.staticRoutes.map((r) => (
              <option key={r.path} value={r.path}>
                {r.label}
              </option>
            ))}
          </optgroup>
          {studioOptions.length > 0 && (
            <optgroup label="Studio pages">
              {studioOptions.map((o) => (
                <option key={o.slug} value={o.path}>
                  {o.slug}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      ) : (
        <input
          type="text"
          aria-label="external url"
          value={committed}
          onChange={(e) => onChange(e.currentTarget.value)}
          placeholder="https://…  ·  #anchor  ·  mailto:  ·  tel:"
          style={INPUT}
        />
      )}
    </div>
  );
}
