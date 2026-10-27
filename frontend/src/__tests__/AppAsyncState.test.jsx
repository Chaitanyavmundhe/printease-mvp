import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  props: null,
  apiRequest: vi.fn(),
  getOrderStatus: vi.fn(),
}));
vi.mock('../AppRouter', () => ({ default: props => { mocks.props = props; return null; } }));
vi.mock('../services/api', () => ({
  apiRequest: mocks.apiRequest,
  getOrderStatus: mocks.getOrderStatus,
  invalidateUserHistory: vi.fn(),
  createDocumentSignedDownload: vi.fn(),
  getOrderDetail: vi.fn(),
  reprintOrder: vi.fn(),
}));
vi.mock('../utils/filePreparation/prepareBrowserPrintReadyFile', () => ({ prepareBrowserPrintReadyFile: vi.fn() }));
import App from '../App';

it.each(['success', 'rejection'])('ignores startup auth %s arriving after logout', async outcome => {
  let resolveMe;
  let rejectMe;
  const pending = new Promise((resolve, reject) => { resolveMe = resolve; rejectMe = reject; });
  localStorage.setItem('printease_token', 'account-a-token');
  localStorage.setItem('printease_user', JSON.stringify({ id: 'a', role: 'user' }));
  mocks.apiRequest.mockImplementation(async endpoint => {
    if (endpoint === '/api/auth/me') return pending;
    return endpoint === '/api/centres' ? { centres: [] } : {};
  });
  await mount();
  act(() => mocks.props.logout());
  await act(async () => {
    if (outcome === 'success') resolveMe({ user: { id: 'a', role: 'user' } });
    else rejectMe(Object.assign(new Error('Expired session'), { status: 401 }));
  });
  expect(mocks.props.currentUser).toBeNull();
  expect(localStorage.getItem('printease_token')).toBeNull();
  expect(localStorage.getItem('printease_user')).toBeNull();
});


beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem('printease_session_id', 'test-session');
  mocks.apiRequest.mockImplementation(async endpoint => endpoint === '/api/centres' ? { centres: [] } : {});
  mocks.getOrderStatus.mockResolvedValue({});
});
afterEach(cleanup);

async function mount(path = '/') {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
  await waitFor(() => expect(mocks.apiRequest).toHaveBeenCalledWith('/api/centres'));
  await act(async () => {});
}

async function pay() {
  await act(async () => {
    mocks.props.openPaymentRequest({ id: 'order-a', backendId: 'order-a', amount: 10 });
  });
  await act(async () => { await mocks.props.handlePayment(); });
}

it('unblocks a failed manual request without calling any online payment route', async () => {
  await mount();
  mocks.apiRequest.mockRejectedValue(new Error('Request failed'));
  await pay();
  expect(mocks.props.paymentLoading).toBe(false);
  expect(mocks.props.paymentError).toBe('Request failed');
  expect(mocks.apiRequest).toHaveBeenCalledWith('/api/payments/manual-request', expect.objectContaining({ method: 'POST' }));
  expect(mocks.apiRequest.mock.calls.some(([url]) => /razorpay|verify-demo/.test(url))).toBe(false);
});

it('keeps a successful manual request pending until the hub confirms receipt', async () => {
  await mount();
  mocks.apiRequest.mockResolvedValue({
    payment: { id: 'p', method: 'MANUAL_PAYMENT_REQUEST', status: 'pending' },
    order: { id: 'order-a', amount: 10, status: 'payment_requested', paymentStatus: 'requested' },
  });
  await pay();
  expect(mocks.props.paymentLoading).toBe(false);
  expect(mocks.props.pendingPayment.status).toBe('pending');
  expect(mocks.props.order.paymentStatus).not.toBe('collected');
});

it.each(['success', 'rejection'])('ignores a manual request %s after logout', async outcome => {
  let resolve, reject;
  const pending = new Promise((a, b) => { resolve = a; reject = b; });
  await mount();
  act(() => mocks.props.openPaymentRequest({ id: 'order-a', backendId: 'order-a', amount: 10 }));
  mocks.apiRequest.mockReturnValue(pending);
  let request;
  act(() => { request = mocks.props.handlePayment(); });
  expect(mocks.props.paymentLoading).toBe(true);
  act(() => mocks.props.logout());
  await act(async () => {
    if (outcome === 'success') resolve({ order: { id: 'order-a', amount: 10 }, payment: { id: 'p' } });
    else reject(new Error('Late failure'));
    await request;
  });
  expect(mocks.props.order).toBeNull();
  expect(mocks.props.paymentLoading).toBe(false);
  expect(mocks.props.paymentError).toBe('');
});

it('does not restore an old order after navigating to a different order', async () => {
  let releaseOld;
  const old = new Promise(resolve => { releaseOld = resolve; });
  mocks.getOrderStatus.mockImplementation(id => id === 'old' ? old : Promise.resolve({ order: { id: 'new', amount: 20 } }));
  await mount('/track?order=old');
  await act(async () => { mocks.props.navigate('/track?order=new'); });
  await waitFor(() => expect(mocks.props.order?.backendId).toBe('new'));
  await act(async () => { releaseOld({ order: { id: 'old', amount: 10 } }); });
  expect(mocks.props.order.backendId).toBe('new');
  expect(localStorage.getItem('printease_active_order_id')).toBe('new');
});

it('does not resurrect a guest order after logout', async () => {
  let release;
  mocks.getOrderStatus.mockReturnValue(new Promise(resolve => { release = resolve; }));
  localStorage.setItem('printease_order_access_token', 'guest-a');
  await mount('/track?order=old');
  act(() => mocks.props.logout());
  await act(async () => { release({ order: { id: 'old', amount: 10 } }); });
  expect(mocks.props.order).toBeNull();
  expect(localStorage.getItem('printease_active_order_id')).toBeNull();
});
