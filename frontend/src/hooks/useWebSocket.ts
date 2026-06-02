import { useEffect, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import { usePlatformStore } from '../store/platformStore';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const WS_BASE = BASE.replace(/^http/, 'ws');

export function useWebSocket() {
  const clientRef = useRef<Client | null>(null);
  const applySnapshot = usePlatformStore((s) => s.applySnapshot);

  const stableApply = useCallback((snap: any) => {
    applySnapshot(snap);
  }, [applySnapshot]);

  useEffect(() => {
    const client = new Client({
      brokerURL: `${WS_BASE}/ws-raw`,
      reconnectDelay: 3000,
      onConnect: () => {
        console.log('STOMP connected');
        client.subscribe('/topic/snapshot', (msg) => {
          try {
            stableApply(JSON.parse(msg.body));
          } catch { /* ignore */ }
        });
      },
      onStompError: (frame) => {
        console.warn('STOMP error', frame.headers['message']);
      },
      onWebSocketError: (evt) => {
        console.warn('WS error', evt);
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
    };
  }, [stableApply]);

  return clientRef;
}
