"use client";

/**
 * ColorField — the Style Inspector's colour control (Admiral 2026-08-11:
 * "the color hex picker with the color palettes... nice way to interact and
 * come up with a brand. love's palette might change"). Two ways to pick:
 *   - the house PALETTE swatches (stays on-brand; stored as a token key)
 *   - a native HEX picker (free exploration; stored as "#rrggbb")
 * Used on the practice/test page as a live palette playground, and on any
 * block's colour field everywhere else. The value is a plain string —
 * "default", a token key, or a hex — resolved in puck-config's typo().
 *
 * A client component (interactive) so puck-config.tsx stays safe to import
 * from the server /p render path (Puck only invokes field renders in the
 * editor, never in <Render>).
 */

type Swatch = { key: string; css: string; label: string };

const SWATCHES: Swatch[] = [
  { key: "default", css: "transparent", label: "Default (inherit)" },
  { key: "ink", css: "var(--ink-strong)", label: "Ink" },
  { key: "body", css: "var(--ink-body)", label: "Body" },
  { key: "muted", css: "var(--muted)", label: "Muted" },
  { key: "gold", css: "var(--gold-deep)", label: "Gold" },
  { key: "goldBright", css: "var(--gold-2)", label: "Gold bright" },
  { key: "teal", css: "var(--teal-bright)", label: "Teal" },
  { key: "rose", css: "var(--rose)", label: "Rose" },
  { key: "purple", css: "var(--lavender)", label: "Purple" },
  { key: "white", css: "#ffffff", label: "White" },
];

export default function ColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const v = value || "default";
  const isHex = v.startsWith("#");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {SWATCHES.map((s) => {
          const selected = v === s.key;
          return (
            <button
              key={s.key}
              type="button"
              title={s.label}
              aria-label={s.label}
              onClick={() => onChange(s.key)}
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                cursor: "pointer",
                padding: 0,
                background: s.css,
                border: selected
                  ? "2px solid var(--gold-2, #EBCB77)"
                  : "1px solid rgba(139,118,196,.45)",
                // a subtle checker so "Default (transparent)" reads as empty
                backgroundImage:
                  s.key === "default"
                    ? "linear-gradient(45deg,#8886 25%,transparent 25%,transparent 75%,#8886 75%),linear-gradient(45deg,#8886 25%,transparent 25%,transparent 75%,#8886 75%)"
                    : undefined,
                backgroundSize: s.key === "default" ? "8px 8px" : undefined,
                backgroundPosition:
                  s.key === "default" ? "0 0,4px 4px" : undefined,
              }}
            />
          );
        })}
      </div>
      <label
        style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
      >
        <input
          type="color"
          value={isHex ? v : "#b4862b"}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 36,
            height: 26,
            padding: 0,
            border: "1px solid rgba(139,118,196,.45)",
            borderRadius: 6,
            background: "none",
            cursor: "pointer",
          }}
        />
        <span style={{ fontFamily: "monospace" }}>
          {isHex ? v : "pick a custom hex"}
        </span>
        {isHex && (
          <button
            type="button"
            onClick={() => onChange("default")}
            style={{
              marginLeft: "auto",
              fontSize: 11,
              cursor: "pointer",
              background: "none",
              border: "none",
              color: "var(--muted, #9a8fae)",
              textDecoration: "underline",
            }}
          >
            clear
          </button>
        )}
      </label>
    </div>
  );
}
