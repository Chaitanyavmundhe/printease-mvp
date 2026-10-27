// Real loopback HTTP + real routers, auth/role middleware and payment
// policies. Database/provider/storage are fixtures: no production I/O or prints.
import express from 'express';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from '../../db/repository.js';
import orderRoutes from '../../routes/orderRoutes.js';
import paymentRoutes from '../../routes/paymentRoutes.js';
import agentRoutes from '../../routes/agentRoutes.js';
import uploadRoutes from '../../routes/uploadRoutes.js';
import { queuePrintJobIfPaymentReady } from '../../services/printQueueService.js';
import { hashGuestToken } from '../../services/guestAccessService.js';

const fixture = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));
vi.mock('../../db/repository.js');
vi.mock('../../config/db.js', () => ({ query: vi.fn(), withTransaction: vi.fn(), pool: { query: vi.fn(async () => ({ rows: [{ count: 1, reset_at: new Date(Date.now() + 60000) }] })) } }));
vi.mock('../../config/supabase.js', () => ({
  getSupabaseBucketName: () => 'fixture-private',
  getSupabaseAdminClient: () => ({ auth: { getUser: async () => ({ error: true }) }, storage: { from: () => ({ upload: fixture.upload, remove: async () => ({}) }) } }),
}));
vi.mock('../../services/printQueueService.js', () => ({ queuePrintJobIfPaymentReady: vi.fn() }));

const secret = 'local-test-only-jwt-secret-not-a-real-credential';
const guestToken = 'local-guest-capability';
const owner = { id: 'owner', role: 'user' };
const stranger = { id: 'stranger', role: 'user' };
const hub = { id: 'hub-owner', role: 'hub', centreId: 'hub' };
const order = { id: 'order', centreId: 'hub', userId: 'owner', status: 'payment_requested', paymentStatus: 'requested', amount: 2, totalAmountPaise: 200 };
const payment = { id: 'payment', orderId: 'order', providerOrderId: 'provider-order', amount: 2, status: 'created' };
const file = { lineAmountPaise: 200, printablePageCount: 1, document: { preparationStatus: 'prepared', fileType: 'application/pdf', pageCount: 1, storagePath: 'private.pdf', fileSha256: 'verified' } };
let server, base;
const bearer = (user, claims = {}) => `Bearer ${jwt.sign({ id: user.id, role: user.role, ...claims }, secret, { expiresIn: '5m' })}`;

async function call(path, { user, claims, token, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(user ? { authorization: bearer(user, claims) } : {}), ...(token ? { 'x-order-access-token': token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
beforeAll(async () => {
  const app = express();
  app.use(express.json({ verify: (req, _res, bytes) => { req.rawBody = bytes.toString('utf8'); } }));
  app.use('/api/orders', orderRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/agent', agentRoutes);
  app.use('/api/uploads', uploadRoutes);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ success: false, message: error.message }));
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  vi.unstubAllEnvs();
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('JWT_SECRET', secret);
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('DEMO_PAYMENT_ENABLED', 'true');
  vi.stubEnv('MAX_CONCURRENT_UPLOADS', '1');
  fixture.upload.mockResolvedValue({});
  repo.findUserById.mockImplementation(async id => id === owner.id ? owner : id === stranger.id ? stranger : id === hub.id ? hub : null);
  repo.findOrderByIdOrCode.mockImplementation(async id => id === order.id ? { ...order } : null);
  repo.listOrderFiles.mockResolvedValue([file]);
  repo.findPaymentById.mockResolvedValue({ ...payment });
  repo.findPaymentByProviderOrderId.mockResolvedValue({ ...payment });
  repo.findSettledPaymentForOrder.mockResolvedValue(null);
  repo.withTransaction.mockImplementation(callback => callback({ query: vi.fn() }));
  repo.createPayment.mockImplementation(async value => value);
  repo.createDocument.mockImplementation(async value => value);
  repo.updatePayment.mockImplementation(async (_id, value) => ({ ...payment, ...value }));
  repo.updateOrderPayment.mockImplementation(async (_id, paymentStatus, status) => ({ ...order, paymentStatus, status }));
  repo.findActiveAgentByTokenHash.mockResolvedValue(null);
  queuePrintJobIfPaymentReady.mockResolvedValue({ queued: true });
});

describe('adversarial HTTP boundaries', () => {
  it('blocks cross-account reads even when the signed JWT claims an admin role', async () => {
    expect((await call('/api/orders/order', { user: stranger, claims: { role: 'admin' } })).status).toBe(404);
  });
  it('does not let a customer collect cash or create a request for somebody else', async () => {
    expect((await call('/api/orders/order/collect-payment', { user: stranger, method: 'POST', body: { method: 'cash' } })).status).toBe(403);
    expect((await call('/api/payments/manual-request', { user: stranger, method: 'POST', body: { orderId: 'order' } })).status).toBe(404);
    expect(repo.createPayment).not.toHaveBeenCalled();
  });
  it.each([new Date(0).toISOString(), null, 'not-a-date'])('rejects replay of a guest capability with expiry %s', async expiresAt => {
    repo.findOrderByIdOrCode.mockResolvedValue({ ...order, userId: null, paymentStatus: 'not_requested', expiresAt, guestTokenHash: hashGuestToken(guestToken) });
    const read = await call('/api/orders/order', { token: guestToken });
    const request = await call('/api/payments/manual-request', { token: guestToken, method: 'POST', body: { orderId: 'order' } });
    expect({ read: read.status, request: request.status }).toEqual({ read: 404, request: 404 });
    expect(repo.createPayment).not.toHaveBeenCalled();
  });
  it('keeps a valid loginless request pending without authorizing a print', async () => {
    repo.findOrderByIdOrCode.mockResolvedValue({ ...order, userId: null, paymentStatus: 'not_requested', expiresAt: new Date(Date.now() + 60000).toISOString(), guestTokenHash: hashGuestToken(guestToken) });
    const response = await call('/api/payments/manual-request', { token: guestToken, method: 'POST', body: { orderId: 'order' } });
    expect(response.status).toBe(201);
    expect(repo.createPayment).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', amount: 2 }), expect.anything());
    expect(queuePrintJobIfPaymentReady).not.toHaveBeenCalled();
  });
  it.each([
    ['cash', false, 'CASH'], ['cash', true, 'CASH'],
    ['manual_upi', false, 'MANUAL_UPI'], ['manual_upi', true, 'MANUAL_UPI'],
  ])('only explicit hub collection settles %s with auto-print=%s', async (method, autoPrintAfterCollection, storedMethod) => {
    const response = await call('/api/orders/order/collect-payment', { user: hub, method: 'POST', body: { method, autoPrintAfterCollection } });
    expect(response.status).toBe(200);
    expect(repo.createPayment).toHaveBeenCalledWith(expect.objectContaining({ method: storedMethod, status: 'collected', amount: 2 }), expect.anything());
    expect(repo.updateOrderPayment).toHaveBeenCalledWith('order', 'collected', 'payment_collected', expect.anything());
    expect(queuePrintJobIfPaymentReady).toHaveBeenCalledTimes(autoPrintAfterCollection ? 1 : 0);
  });
  it('cannot request or collect a bill whose conversion is still pending', async () => {
    repo.listOrderFiles.mockResolvedValue([{ ...file, document: { ...file.document, preparationStatus: 'pending' } }]);
    expect((await call('/api/payments/manual-request', { user: owner, method: 'POST', body: { orderId: 'order' } })).status).toBe(409);
    expect((await call('/api/orders/order/collect-payment', { user: hub, method: 'POST', body: { method: 'cash' } })).status).toBe(409);
    expect(repo.createPayment).not.toHaveBeenCalled();
    expect(queuePrintJobIfPaymentReady).not.toHaveBeenCalled();
  });
  it.each(['production', 'staging', 'development', 'test'])('never re-enables removed gateway/demo routes (%s)', async env => {
    vi.stubEnv('NODE_ENV', env);
    vi.stubEnv('RAZORPAY_ENABLED', 'true');
    for (const route of ['razorpay/order', 'razorpay/verify', 'razorpay/upi-qr', 'razorpay/webhook', 'verify-demo']) {
      const response = await call('/api/payments/' + route, {
        user: owner, method: 'POST', body: { orderId: 'order', paymentId: 'payment', demoSuccess: true },
      });
      expect(response.status).toBe(410);
      expect(response.body.code).toBe('ONLINE_PAYMENTS_REMOVED');
    }
    expect(repo.createPayment).not.toHaveBeenCalled();
    expect(repo.updatePayment).not.toHaveBeenCalled();
    expect(repo.updateOrderPayment).not.toHaveBeenCalled();
    expect(queuePrintJobIfPaymentReady).not.toHaveBeenCalled();
  });
  it('advertises only manual payment without exposing gateway keys', async () => {
    expect((await call('/api/payments/config')).body).toEqual({
      success: true, methods: ['manual'], onlinePaymentsEnabled: false,
    });
  });
  it('does not accept a normal login token as an agent credential', async () => {
    expect((await call('/api/agent/jobs/next', { user: owner })).status).toBe(401);
    expect(repo.findNextPrintJobForAgent).not.toHaveBeenCalled();
  });
  it('bounds concurrent multipart processing before buffers and storage work accumulate', async () => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    fixture.upload.mockImplementation(async () => { await gate; return {}; });
    const requests = [];
    let entered;
    try {
      for (let i = 0; i < 3; i++) {
        const form = new FormData();
        form.append('document', new Blob(['fixture-office-bytes'], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }), 'fixture.pptx');
        requests.push(fetch(`${base}/api/uploads`, { method: 'POST', headers: { authorization: bearer(owner) }, body: form }));
      }
      await vi.waitFor(() => expect(fixture.upload).toHaveBeenCalled(), { timeout: 2000 });
      await new Promise(resolve => setTimeout(resolve, 60));
      entered = fixture.upload.mock.calls.length;
    } finally {
      release();
    }
    const statuses = [];
    for (const pending of requests) {
      const response = await pending;
      statuses.push(response.status);
      await response.arrayBuffer();
    }
    expect(entered).toBe(1);
    expect(statuses.sort()).toEqual([201, 503, 503]);
  });
});
