"use client";

import type { BrandTokens } from "./tokens";

/**
 * ColorField -- the Style Inspector's colour control (Phase 1 step 2: now
 * GENERATED from the brand's tokens instead of a hard-coded list).
 *
 * Three ways to pick:
 *   - the brand's colour tokens (stored as the token key, on-brand). Tokens
 *     whose MEASURED dawn grade is "large" or "fails" carry a corner marker
 *     and a title explaining it -- the inspector warns before lint ever runs;
 *   - the brand PALETTE slots p1-p5 (stored as "p1".."p5", resolving to the
 *     live --p1..--p5 variables -- re-roll the palette, those picks follow);
 *   - a native HEX picker (free exploration; stored as "#rrggbb").
 *
 * The value is a plain string -- "default", a token key, "p1".."p5", or a
 * hex -- resolved by colorCss() in the registry.
 */

export default function ColorField({
  value,
  onChange,
  tokens,
}: {
  value: string;
  onChange: (v: string) => void;
  tokens: BrandTokens;
}) {
  const v = value || "default";
  const isHex = v.startsWith("#");

  const swBase: React.CSSProperties = {
    width: 24,
    height: 24,
    borderRadius: 6,
    cursor: "pointer",
    padding: 0,
    position: "relative",
  };
  const ring = (selected: boolean): string =>
    selected
      ? "2px solid var(--gold-2, #EBCB77)"
      : "1px solid rgba(139,118,196,.45)";

  const gradeMark = (grade: "aa" | "large" | "fails"): React.ReactNode => {
    if (grade === "aa") return null;
    return (
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: -3,
          right: -3,
          width: 9,
          height: 9,
          borderRadius: 999,
          background: grade === "fails" ? "#E7899E" : "#EBCB77",
          border: "1.5px solid #12101f",
        }}
      />
    );
  };

  const gradeTitle = (
    label: string,
    grade: "aa" | "large" | "fails"
  ): string => {
    if (grade === "fails")
      return `${label} — hard to read in light mode (fails contrast)`;
    if (grade === "large")
      return `${label} — light mode: headings & labels only (large text)`;
    return label;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* brand colour tokens, generated from the cartridge */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button
          type="button"
          title="Default (inherit)"
          aria-label="Default (inherit)"
          onClick={() => onChange("default")}
          style={{
            ...swBase,
            background: "transparent",
            border: ring(v === "default"),
            backgroundImage:
              "linear-gradient(45deg,#8886 25%,transparent 25%,transparent 75%,#8886 75%),linear-gradient(45deg,#8886 25%,transparent 25%,transparent 75%,#8886 75%)",
            backgroundSize: "8px 8px",
            backgroundPosition: "0 0,4px 4px",
          }}
        />
        {Object.entries(tokens.colors).map(([key, t]) => (
          <button
            key={key}
            type="button"
            title={gradeTitle(t.label, t.grade.dawn)}
            aria-label={t.label}
            onClick={() => onChange(key)}
            style={{ ...swBase, background: t.css, border: ring(v === key) }}
          >
            {gradeMark(t.grade.dawn)}
          </button>
        ))}
      </div>

      {/* the brand palette slots — live vars, re-roll and these follow */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            fontSize: 9,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--puck-color-grey-05, #9a8fae)",
            fontFamily: "monospace",
          }}
        >
          palette
        </span>
        {tokens.palette.map((slot) => (
          <button
            key={slot.key}
            type="button"
            title={`${slot.key} · ${slot.label} — ${slot.hint}`}
            aria-label={`palette ${slot.label}`}
            onClick={() => onChange(slot.key)}
            style={{
              ...swBase,
              width: 20,
              height: 20,
              background: `var(--${slot.key}, ${slot.value})`,
              border: ring(v === slot.key),
            }}
          />
        ))}
      </div>

      {/* free hex — the play lane's door */}
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
              color: "var(--puck-color-grey-05, #9a8fae)",
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
