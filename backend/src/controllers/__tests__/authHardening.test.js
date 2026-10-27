import { beforeEach, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import * as repo from '../../db/repository.js';
import { pool } from '../../config/db.js';
import { login } from '../authController.js';
import { optionalAuthMiddleware } from '../../middleware/authMiddleware.js';

vi.mock('../../db/repository.js');
vi.mock('../../config/db.js', () => ({ pool: { query: vi.fn() } }));
vi.mock('bcryptjs', () => ({ default: { compare: vi.fn() } }));
vi.mock('../../config/supabase.js', () => ({ getSupabaseAdminClient: vi.fn(() => { throw new Error('not configured'); }) }));
vi.mock('../../utils/asyncHandler.js', () => ({ asyncHandler: fn => fn }));
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });
beforeEach(() => {
  vi.resetAllMocks();
  repo.findUserByUsername.mockResolvedValue({ id: 'same-account', passwordHash: 'bcrypt-test' });
  repo.findUserByEmail.mockResolvedValue({ id: 'same-account', passwordHash: 'bcrypt-test' });
  pool.query.mockResolvedValue({ rows: [{ attempt_count: 1 }] });
  bcrypt.compare.mockResolvedValue(false);
});
it('reserves the same account attempt budget for username aliases and email', async () => {
  for (const identifier of ['ali1', 'ALI!1', 'ali@example.test']) {
    await login({ body: { identifier, password: 'wrong-password' } }, response());
  }
  expect(pool.query.mock.calls.map(([, values]) => values[0])).toEqual(['user:same-account', 'user:same-account', 'user:same-account']);
  expect(pool.query.mock.calls[0][0]).toContain('ON CONFLICT');
});
it('does not run expensive password hashing when the account budget is locked', async () => {
  pool.query.mockResolvedValue({ rows: [] });
  const res = response();
  await login({ body: { identifier: 'ali1', password: 'wrong-password' } }, res);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(bcrypt.compare).not.toHaveBeenCalled();
});
it('fails closed when lockout storage is unavailable', async () => {
  pool.query.mockRejectedValue(new Error('offline'));
  const res = response();
  await login({ body: { identifier: 'ali1', password: 'wrong-password' } }, res);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(bcrypt.compare).not.toHaveBeenCalled();
});
it('permits missing optional credentials but rejects malformed or invalid supplied credentials', async () => {
  const next = vi.fn();
  await optionalAuthMiddleware({ headers: {}, query: {} }, response(), next);
  expect(next).toHaveBeenCalledTimes(1);
  for (const authorization of ['bad header', 'Bearer invalid-test-token-long-enough']) {
    const res = response();
    await optionalAuthMiddleware({ headers: { authorization }, query: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  }
  expect(next).toHaveBeenCalledTimes(1);
});
