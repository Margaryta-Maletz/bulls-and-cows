import { useEffect, useRef, useState, useCallback } from 'react';

const RECONNECT_DELAY_MS = 2000;

export type SocketStatus = 'connecting' | 'open' | 'closed';

export interface UseSocketResult<TIn> {
  send: (msg: unknown) => void;
  lastMessage: TIn | null;
  status: SocketStatus;
}

export function useSocket<TIn>(url: string): UseSocketResult<TIn> {
  const [lastMessage, setLastMessage] = useState<TIn | null>(null);
  const [status, setStatus]           = useState<SocketStatus>('connecting');

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const lifecycle = { disposed: false };
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let socket: WebSocket | null = null;

    const connect = () => {
      if (lifecycle.disposed) return;

      const ws = new WebSocket(url);
      socket = ws;
      wsRef.current = ws;
      setStatus('connecting');

      ws.onopen = () => setStatus('open');

      ws.onmessage = (ev: MessageEvent<string>) => {
        try {
          setLastMessage(JSON.parse(ev.data) as TIn);
        } catch {
          // ignore unparseable frames
        }
      };

      ws.onclose = () => {
        setStatus('closed');
        if (!lifecycle.disposed) {
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };

      ws.onerror = () => ws.close(); // onclose fires next and handles reconnect
    };

    connect();
    return () => {
      lifecycle.disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
      if (wsRef.current === socket) wsRef.current = null;
    };
  }, [url]);

  const send = useCallback((msg: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { send, lastMessage, status };
}

/** WebSocket URL: env в проде, автоопределение через proxy в dev */
export function wsUrl(role?: 'present'): string {
  const base = import.meta.env.VITE_WS_URL as string | undefined;
  if (base) return role ? `${base}?role=${role}` : base;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const path  = role ? `/ws?role=${role}` : '/ws';
  return `${proto}//${location.host}${path}`;
}
