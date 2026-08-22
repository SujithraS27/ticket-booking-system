import { createApp } from '../src/app';

/** Shared express app instance used across tests. */
let cached: ReturnType<typeof createApp> | null = null;

export function app(): ReturnType<typeof createApp> {
  if (!cached) cached = createApp();
  return cached;
}