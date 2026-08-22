import express, { Express } from 'express';
import cors from 'cors';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Routes
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import venueRoutes from './routes/venues.routes';
import showRoutes from './routes/shows.routes';
import seatRoutes from './routes/seats.routes';
import bookingRoutes from './routes/bookings.routes';
import { waitlistRouter, offersRouter } from './routes/waitlist.routes';
import organiserRoutes from './routes/organiser.routes';
import adminRoutes from './routes/admin.routes';

export interface AppOptions {
  /** Optional Socket.IO-like callback receiving seat-join events. */
  onSeatEvent?: (event: 'seat:update' | 'show:stats', payload: unknown) => void;
}

export function createApp(_options: AppOptions = {}): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.use(
    cors({
      origin: config.corsOrigins.length ? config.corsOrigins : true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), service: 'ticket-booking-api' });
  });

  app.use('/api', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/venues', venueRoutes);
  app.use('/api/shows', showRoutes);
  app.use('/api/shows', waitlistRouter);
  app.use('/api/shows', seatRoutes);
  app.use('/api/offers', offersRouter);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/organiser', organiserRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}