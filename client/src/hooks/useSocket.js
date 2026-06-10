import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

// Where to reach the Socket.IO server.
//  • Production (single-service deploy): the server also serves this built
//    client, so connect to the SAME origin — leave the URL undefined and
//    socket.io defaults to window.location.origin.
//  • Dev: Vite serves the client on :3000 and the API runs on :3001, so point
//    there. Override either case with VITE_SERVER_URL at build time.
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001' : undefined);

// Per-tab identity that survives refreshes/reconnects.
// Uses sessionStorage (not localStorage) so two tabs in the SAME browser are
// distinct players — essential for local testing — while a refresh of a given
// tab keeps its identity and auto-rejoins.
function getClientId() {
  let id = sessionStorage.getItem('pokerClientId');
  if (!id) {
    id = (crypto.randomUUID?.() ?? `c_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    sessionStorage.setItem('pokerClientId', id);
  }
  return id;
}

function loadSavedCode() {
  try { return JSON.parse(sessionStorage.getItem('pokerSession') || 'null')?.code ?? null; }
  catch { return null; }
}

// ── Singleton socket ────────────────────────────────────────────────────────
// Created exactly once per page load and never torn down by React's lifecycle.
// This is critical: under StrictMode (and HMR) React mounts→unmounts→remounts,
// and creating/destroying a socket per mount caused an endless
// disconnect/reconnect loop that destabilised rooms on the server.
let sharedSocket = null;

function getSocket(clientId) {
  if (sharedSocket) return sharedSocket;

  // With no URL, socket.io connects to the page's own origin (production
  // single-service). In dev, SERVER_URL points at the separate API server.
  const opts = { transports: ['websocket', 'polling'] };
  const socket = SERVER_URL ? io(SERVER_URL, opts) : io(opts);

  // Auto-rejoin on every (re)connect. Attached once, at creation, so it can
  // never miss the connect event. On success the server broadcasts gameState,
  // which the app handles; on failure we drop the stale session.
  socket.on('connect', () => {
    const code = loadSavedCode();
    if (code) {
      socket.emit('rejoin', { code, clientId }, (res) => {
        if (!res?.ok) {
          // Room/seat is gone (e.g. server restarted). Drop the dead session
          // and tell the app to return to the opening screen instead of
          // showing a frozen, stale room.
          sessionStorage.removeItem('pokerSession');
          window.dispatchEvent(new CustomEvent('poker:session-invalid'));
        }
      });
    }
  });

  sharedSocket = socket;
  return socket;
}

export function useSocket() {
  const clientIdRef = useRef(getClientId());
  const socketRef = useRef(getSocket(clientIdRef.current));
  const [connected, setConnected] = useState(socketRef.current.connected);

  useEffect(() => {
    const socket = socketRef.current;
    const onConn = () => setConnected(true);
    const onDisc = () => setConnected(false);
    socket.on('connect', onConn);
    socket.on('disconnect', onDisc);
    if (socket.connected) setConnected(true);
    // Only remove THESE listeners on unmount — never disconnect the singleton.
    return () => {
      socket.off('connect', onConn);
      socket.off('disconnect', onDisc);
    };
  }, []);

  // Stable references so consumers' effects don't re-run every render.
  const emit = useCallback((event, data) => {
    return new Promise((resolve) => {
      if (!socketRef.current) return resolve({ error: 'Not connected' });
      socketRef.current.emit(event, data, resolve);
    });
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler);
  }, []);

  return { emit, on, off, connected, clientId: clientIdRef.current, socket: socketRef };
}
