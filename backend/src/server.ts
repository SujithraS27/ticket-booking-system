import http from 'http';
import { Server, Socket } from 'socket.io';
import { config } from './config';
import { createApp } from './app';
import { eventBus, type SeatUpdate, type ShowStatsUpdate } from './lib/events';
import { prisma } from './lib/prisma';
import { applyRealisticPrices } from './lib/updatePrices';
import { syncDemoShowData } from './lib/demoShows';
import { startScheduler } from './services/scheduler.service';

/**
 * HTTP + Socket.IO bootstrap.
 * Real-time seat updates flow one way: every seat-state mutation publishes
 * a `seat:update` / `show:stats` event on the in-process eventBus, and the
 * Socket.IO layer forwards it to every client in the `show:{showId}` room.
 */

export function createSocketServer(httpServer: http.Server): Server {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigins.length ? config.corsOrigins : true, credentials: true },
  });

  io.on('connection', (socket: Socket) => {
    socket.on('join:show', (showId: string) => {
      if (typeof showId !== 'string' || !showId) return;
      socket.join(`show:${showId}`);
    });
    socket.on('leave:show', (showId: string) => {
      if (typeof showId !== 'string') return;
      socket.leave(`show:${showId}`);
    });
  });

  eventBus.on('seat:update', (payload: SeatUpdate) => {
    io.to(`show:${payload.showId}`).emit('seat:update', payload);
  });
  eventBus.on('show:stats', (payload: ShowStatsUpdate) => {
    io.to(`show:${payload.showId}`).emit('show:stats', payload);
  });

  return io;
}

export async function bootstrap() {
  const app = createApp();
  const httpServer = http.createServer(app);
  createSocketServer(httpServer);

  // Idempotent startup price sync — applies realistic 2026 ticket prices
  // to the connected database (e.g. the deployed Neon database) BEFORE the
  // server starts serving traffic. Runs against the same DATABASE_URL the
  // app uses, every boot, so deployments self-heal to the canonical prices.
  // Skips only in tests and can be explicitly disabled via DISABLE_PRICE_UPDATE=1.
  if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_PRICE_UPDATE !== '1') {
    try {
      const touched = await applyRealisticPrices(prisma);
      console.log(`[prices] startup price sync complete (${touched} rows touched)`);
    } catch (err) {
      console.warn('[prices] startup price sync skipped:', (err as Error).message);
    }
    try {
      await syncDemoShowData(prisma);
    } catch (err) {
      console.warn('[demo] show data sync skipped:', (err as Error).message);
    }
  }

  startScheduler();

  await new Promise<void>((resolve) => {
    httpServer.listen(config.port, () => resolve());
  });
  console.log(`[api] Ticket Booking API listening on http://localhost:${config.port}`);
  console.log(`[api] seat hold TTL = ${config.seatHoldTtlMs}ms`);
  console.log(`[api] waitlist offer TTL = ${config.waitlistOfferTtlMs}ms`);
  return httpServer;
}

/* istanbul ignore next */
if (require.main === module) {
  bootstrap().catch((err) => {
    console.error('[api] failed to start:', err);
    process.exit(1);
  });
}