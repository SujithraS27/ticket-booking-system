import { io, Socket } from 'socket.io-client';
import { useEffect, useState } from 'react';
import type { Seat } from './types';

let socket: Socket | null = null;

/** Lazily connects the Socket.IO client (proxied by Vite in dev). */
export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', { transports: ['websocket', 'polling'] });
  }
  return socket;
}

/**
 * Subscribes the current page to a show room and returns live seat updates.
 */
export function useSeatUpdates(showId: string): Seat[] {
  const [updates, setUpdates] = useState<Seat[]>([]);

  useEffect(() => {
    const s = getSocket();
    s.emit('join:show', showId);

    const onUpdate = (payload: { showId: string; seats: Seat[] }) => {
      if (payload.showId === showId) setUpdates(payload.seats);
    };

    s.on('seat:update', onUpdate);
    return () => {
      s.off('seat:update', onUpdate);
      s.emit('leave:show', showId);
    };
  }, [showId]);

  return updates;
}
