import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, resetDb, registerUser } from './helpers';

describe('Authentication', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('registers a customer and returns a JWT', async () => {
    const res = await request(app())
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'alice@example.com', password: 'password1', role: 'CUSTOMER' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toMatchObject({ email: 'alice@example.com', role: 'CUSTOMER' });
  });

  it('rejects duplicate emails', async () => {
    await registerUser('CUSTOMER', 'dup@example.com');
    const res = await request(app())
      .post('/api/auth/register')
      .send({ name: 'Bob', email: 'dup@example.com', password: 'password1', role: 'CUSTOMER' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('logs in with correct credentials and rejects bad ones', async () => {
    const { user } = await registerUser('CUSTOMER', 'login@example.com');
    const ok = await request(app())
      .post('/api/auth/login')
      .send({ email: user.email, password: 'password123' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();

    const bad = await request(app())
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrongpassword' });
    expect(bad.status).toBe(401);
  });

  it('returns the current user via /me', async () => {
    const { token } = await registerUser('ORG', 'orgme@example.com');
    const res = await request(app()).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('ORG');
  });

  it('rejects unauthenticated /me', async () => {
    const res = await request(app()).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('allows registering an admin and an organiser', async () => {
    const admin = await registerUser('ADMIN', 'admin-test@example.com');
    const org = await registerUser('ORG', 'org-test@example.com');
    expect(admin.user.role).toBe('ADMIN');
    expect(org.user.role).toBe('ORG');
  });
});