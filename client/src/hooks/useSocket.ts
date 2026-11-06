import { useEffect, useRef, useState, useCallback } from 'react';

const RECONNECT_DELAY_MS = 2000;

export type SocketStatus = 'connecting' | 'open' | 'closed';

export interface UseSocketResult<TIn> {
  send: (msg: unknown) => void;
  lastMessage: TIn | null;
  status: SocketStatus;
  reconnected: boolean;
}

export function useSocket<TIn>(url: string): UseSocketResult<TIn> {
  const [lastMessage, setLastMessage] = useState<TIn | null>(null);
  const [status, setStatus]           = useState<SocketStatus>('connecting');
  const [reconnected, setReconnected] = useState(false);

  const wsRef           = useRef<WebSocket | null>(null);
  const everClosed      = useRef(false);
  const toastTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      ws.onopen = () => {
        setStatus('open');
        if (everClosed.current) {
          setReconnected(true);
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => { setReconnected(false); }, 2000);
        }
      };

      ws.onmessage = (ev: MessageEvent<string>) => {
        try {
          setLastMessage(JSON.parse(ev.data) as TIn);
        } catch {
          // ignore unparseable frames
        }
      };

      ws.onclose = () => {
        everClosed.current = true;
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
      if (toastTimer.current) clearTimeout(toastTimer.current);
      socket?.close();
      if (wsRef.current === socket) wsRef.current = null;
    };
  }, [url]);

  const send = useCallback((msg: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { send, lastMessage, status, reconnected };
}

/** WebSocket URL: env в проде, автоопределение через proxy в dev */
export function wsUrl(role?: 'present'): string {
  const base = import.meta.env.VITE_WS_URL as string | undefined;
  if (base) {
    const url = `${base.replace(/\/$/, '')}/ws`;
    return role ? `${url}?role=${role}` : url;
  }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const path  = role ? `/ws?role=${role}` : '/ws';
  return `${proto}//${location.host}${path}`;
}

/** HTTP URL для API: в проде берёт хост из VITE_WS_URL, в dev — относительный (proxy) */
export function apiUrl(path: string): string {
  const base = import.meta.env.VITE_WS_URL as string | undefined;
  if (base) {
    const httpBase = base.replace(/\/$/, '').replace(/^wss?:\/\//, 'https://');
    return `${httpBase}${path}`;
  }
  return path;
}
