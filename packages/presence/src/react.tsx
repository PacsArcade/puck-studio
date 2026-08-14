"use client";

import { useEffect, useState } from "react";
import { createUsePuck } from "@puckeditor/core";
import type { PresencePeer, TransportStatus } from "./types";
import type { PresenceClient } from "./presence";

const usePuck = createUsePuck();

/**
 * Subscribe to a presence client. Null-safe: with no client the hook
 * reports an empty room and a "down" transport.
 */
export const usePresence = (
  client: PresenceClient | null
): { peers: PresencePeer[]; status: TransportStatus } => {
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const [status, setStatus] = useState<TransportStatus>("down");

  useEffect(() => {
    if (!client) {
      setPeers([]);
      setStatus("down");
      return;
    }
    setPeers(client.peers());
    setStatus(client.status());
    const unsubscribePeers = client.subscribe(setPeers);
    const unsubscribeStatus = client.onStatus(setStatus);
    return () => {
      unsubscribePeers();
      unsubscribeStatus();
    };
  }, [client]);

  return { peers, status };
};

/** The slice of a changelog the bridge rides — structural, no hard dep. */
export type PresenceLog = {
  subscribe(fn: (rec: { rev: number }) => void): () => void;
};

export type PresenceBridgeProps = {
  client: PresenceClient | null;
  /** Which page/document this editor session is on. */
  slug: string;
  /** Optional changelog — every new record bumps the broadcast rev. */
  log?: PresenceLog;
  /** Optional unsaved-changes flag, forwarded as-is. */
  dirty?: boolean;
};

const toBreakpoint = (
  width: unknown
): "phone" | "tablet" | "desktop" | null => {
  if (typeof width !== "number") return null; // "100%" et al
  if (width >= 1080) return "desktop";
  if (width >= 768) return "tablet";
  return "phone";
};

/**
 * PresenceBridge — renders null; must live inside `<Puck>`. Mirrors the
 * local editor's selection (selectedItem props.id — core's resolution of
 * ui.itemSelector) and target breakpoint (ui.viewports.current.width:
 * >=1080 desktop, >=768 tablet, otherwise phone; non-numeric null) into
 * the presence client, and bumps the broadcast rev on every changelog
 * record.
 */
export const PresenceBridge = ({
  client,
  slug,
  log,
  dirty,
}: PresenceBridgeProps): null => {
  const selectedBlockId = usePuck((s) => {
    const id = (s.selectedItem?.props as { id?: unknown } | undefined)?.id;
    return typeof id === "string" ? id : null;
  });
  const width = usePuck((s) => s.appState.ui.viewports.current.width);
  const targetBreakpoint = toBreakpoint(width);

  useEffect(() => {
    if (!client) return;
    client.setState({
      slug,
      selectedBlockId,
      targetBreakpoint,
      ...(dirty === undefined ? {} : { dirty }),
    });
  }, [client, slug, selectedBlockId, targetBreakpoint, dirty]);

  useEffect(() => {
    if (!client || !log) return;
    return log.subscribe((rec) => {
      if (typeof rec?.rev === "number") client.setState({ rev: rec.rev });
    });
  }, [client, log]);

  return null;
};

/**
 * PresenceChips — one small avatar chip per peer (peers already exclude
 * self). Nothing for a null client or an empty room.
 */
export const PresenceChips = ({
  client,
}: {
  client: PresenceClient | null;
}) => {
  const { peers } = usePresence(client);

  if (!client || peers.length === 0) return null;

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 4 }}
      aria-label="Also here"
    >
      {peers.map((peer) => (
        <span
          key={peer.sessionId}
          title={`${peer.name}·${peer.slug}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: peer.color,
            color: "#0b0b0f",
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1,
            textTransform: "uppercase",
            userSelect: "none",
          }}
        >
          {(peer.name.trim().charAt(0) || "?").toUpperCase()}
        </span>
      ))}
    </div>
  );
};

const HALOS_STYLE_ID = "oc-presence-halos";

/** Block ids beyond this alphabet are rejected outright — no halo. */
const BLOCK_ID_RE = /^[A-Za-z0-9_-]+$/;

/** Strict color check: 3/6-digit hex, or plain hsl(h, s%, l%). */
const COLOR_RE =
  /^(?:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})|hsl\(\s*\d{1,3}(?:\.\d+)?\s*,\s*\d{1,3}(?:\.\d+)?%\s*,\s*\d{1,3}(?:\.\d+)?%\s*\))$/;

const cssEscape = (value: string): string =>
  typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(value)
    : value;

/**
 * PresenceHalos — renders null; maintains ONE `<style id="oc-presence-halos">`
 * in document.head outlining each same-slug peer's selected block in that
 * peer's color, via `[data-puck-component="<id>"]` (the attribute
 * DraggableComponent stamps on every block).
 *
 * Peer data is REMOTE data: block ids must pass a strict
 * `[A-Za-z0-9_-]+` whitelist AND CSS.escape; colors must match a strict
 * hex/hsl pattern. Anything else gets no halo — a peer can never inject
 * CSS into this editor.
 */
export const PresenceHalos = ({
  client,
  slug,
}: {
  client: PresenceClient | null;
  slug: string;
}): null => {
  const { peers } = usePresence(client);

  useEffect(() => {
    const rules: string[] = [];
    for (const peer of peers) {
      if (peer.slug !== slug || !peer.selectedBlockId) continue;
      if (!BLOCK_ID_RE.test(peer.selectedBlockId)) continue;
      if (!COLOR_RE.test(peer.color)) continue;
      rules.push(
        `[data-puck-component="${cssEscape(
          peer.selectedBlockId
        )}"]{outline:2px solid ${
          peer.color
        } !important;outline-offset:3px;border-radius:2px}`
      );
    }

    let el = document.getElementById(HALOS_STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = HALOS_STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = rules.join("\n");
  }, [peers, slug]);

  useEffect(
    () => () => {
      document.getElementById(HALOS_STYLE_ID)?.remove();
    },
    []
  );

  return null;
};
