/**
 * jsdom lacks the encoding + webcrypto globals the nostr crypto stack
 * (nip44, schnorr signing) needs. Backfill from node before any import.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const { TextEncoder, TextDecoder } = require("node:util");
const { webcrypto } = require("node:crypto");

if (typeof globalThis.TextEncoder === "undefined") {
  (globalThis as any).TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === "undefined") {
  (globalThis as any).TextDecoder = TextDecoder;
}
if (typeof globalThis.crypto === "undefined") {
  (globalThis as any).crypto = webcrypto;
} else if (typeof globalThis.crypto.getRandomValues === "undefined") {
  (globalThis.crypto as any).getRandomValues =
    webcrypto.getRandomValues.bind(webcrypto);
}

export {};
