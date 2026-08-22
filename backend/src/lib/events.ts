import { EventEmitter } from 'events';

/**
 * In-process event bus decoupling seat-state persistence from real-time fan-out.
 * `server.ts` wires the Socket.IO layer to `seat:update` events; tests can
 * subscribe to verify payloads without a socket.
 */
export interface SeatUpdate {
  showId: string;
  seats: Array<{
    id: string;
    seatId: string;
    label: string;
    row: number;
    col: number;
    category: string;
    status: string;
    holdExpiresAt: string | null;
  }>;
}

export interface ShowStatsUpdate {
  showId: string;
  stats: { available: number; held: number; booked: number; offered: number };
  updatedAt: string;
}

export const eventBus = new EventEmitter();

export function emitSeatUpdate(payload: SeatUpdate): void {
  eventBus.emit('seat:update', payload);
}

export function emitShowStats(payload: ShowStatsUpdate): void {
  eventBus.emit('show:stats', payload);
}