import { afterEach, expect, it, vi } from 'vitest';
import { cleanupOldData } from '../systemController.js';
import { pool } from '../../config/db.js';

vi.mock('../../config/db.js', () => ({ pool: { query: vi.fn() } }));
vi.mock('../../utils/asyncHandler.js', () => ({ asyncHandler: fn => fn }));
afterEach(() => { delete process.env.SYSTEM_CRON_SECRET; vi.clearAllMocks(); });

it('fails closed without a configured cleanup secret', async () => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  delete process.env.SYSTEM_CRON_SECRET;
  await cleanupOldData({ headers: { authorization: 'Bearer anything' } }, res);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(pool.query).not.toHaveBeenCalled();
});

it('rejects incorrect cleanup credentials without database work', async () => {
  process.env.SYSTEM_CRON_SECRET = 'test-only-configured-secret';
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await cleanupOldData({ headers: { authorization: 'Bearer wrong' } }, res);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(pool.query).not.toHaveBeenCalled();
});
