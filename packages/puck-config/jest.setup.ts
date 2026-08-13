// react-dom/server (browser build, picked under jsdom) schedules through
// MessageChannel and encodes through TextEncoder — jsdom ships neither.
// Node's worker_threads MessageChannel would hold the event loop open
// (assigning onmessage refs the port, so jest never exits); react-dom only
// needs port1.onmessage + port2.postMessage, so a setImmediate-backed
// stand-in covers it without any live handle.
import { TextDecoder, TextEncoder } from "util";

type MessageHandler = ((event: { data: unknown }) => void) | null;

class ImmediateMessageChannel {
  port1: { onmessage: MessageHandler } = { onmessage: null };
  port2: { postMessage: (data?: unknown) => void };

  constructor() {
    const { port1 } = this;
    this.port2 = {
      postMessage: (data?: unknown) => {
        setImmediate(() => port1.onmessage?.({ data }));
      },
    };
  }
}

const g = globalThis as Record<string, unknown>;
if (typeof g.MessageChannel === "undefined")
  g.MessageChannel = ImmediateMessageChannel;
if (typeof g.TextEncoder === "undefined") g.TextEncoder = TextEncoder;
if (typeof g.TextDecoder === "undefined") g.TextDecoder = TextDecoder;

// @dnd-kit observes elements at module scope; jsdom has no ResizeObserver.
if (typeof g.ResizeObserver === "undefined")
  g.ResizeObserver = class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
