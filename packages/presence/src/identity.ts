import type { PresenceIdentityInput } from "./presence";

export type PresenceIdentity = PresenceIdentityInput;

const STORAGE_KEY = "oc-presence-identity";

/** Fresh per-tab session id — never persisted, never reused. */
export const newSessionId = (): string =>
  `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** FNV-1a — tiny, stable, good spread for hue picking. */
const fnv1a = (input: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/**
 * Deterministic identity color: hash → hue, fixed saturation/lightness
 * chosen to read clearly on the night chrome.
 */
export const colorFor = (seed: string): string =>
  `hsl(${fnv1a(seed) % 360}, 70%, 62%)`;

const storage = (): Storage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // SSR or storage-blocked browsers
  }
};

/**
 * Load the persisted identity (name + color under "oc-presence-identity"),
 * minting a fresh sessionId every call. Falls back to "guest" with a
 * color derived from the session id.
 */
export const loadIdentity = (): PresenceIdentity => {
  const sessionId = newSessionId();
  let name = "guest";
  let color: string | null = null;
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { name?: unknown; color?: unknown };
      if (typeof parsed.name === "string" && parsed.name !== "") {
        name = parsed.name;
      }
      if (typeof parsed.color === "string" && parsed.color !== "") {
        color = parsed.color;
      }
    }
  } catch {
    // corrupt storage → defaults
  }
  return {
    sessionId,
    name,
    color: color ?? colorFor(name === "guest" ? sessionId : name),
  };
};

/** Persist name (+ optional color; derived from the name otherwise). */
export const saveIdentity = (identity: {
  name: string;
  color?: string;
}): void => {
  try {
    storage()?.setItem(
      STORAGE_KEY,
      JSON.stringify({
        name: identity.name,
        color: identity.color ?? colorFor(identity.name),
      })
    );
  } catch {
    // storage full/blocked — identity stays session-local
  }
};
