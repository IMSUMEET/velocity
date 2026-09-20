"use client";

import { useEffect } from "react";
import type { Snapshot } from "@velocity/engine";
import { useStore } from "./store";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8080/ws";

/** Opens the snapshot WebSocket once and streams state into the store,
 *  reconnecting automatically if the server restarts. */
export function useLiveFeed() {
  const setSnapshot = useStore((s) => s.setSnapshot);
  const setConnected = useStore((s) => s.setConnected);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout>;
    let closed = false;

    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as { type: string; data: Snapshot };
          if (msg.type === "snapshot") setSnapshot(msg.data);
        } catch { /* ignore malformed */ }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 1500);
      };
      ws.onerror = () => ws?.close();
    };
    connect();

    return () => { closed = true; clearTimeout(retry); ws?.close(); };
  }, [setSnapshot, setConnected]);
}
