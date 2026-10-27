import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import { createUploadCapacity } from '../uploadCapacity.js';
const request = () => new EventEmitter();
const response = () => ({ setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() });
const tick = () => new Promise(resolve => setImmediate(resolve));
afterEach(() => vi.unstubAllEnvs());

it('releases capacity after parser errors without invoking the controller', async () => {
  const gate = createUploadCapacity();
  const next = vi.fn();
  const handler = vi.fn();
  gate((_req, _res, done) => done(new Error('malformed multipart')), handler)(request(), response(), next);
  expect(handler).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalledWith(expect.any(Error));
  gate((_req, _res, done) => done(), handler)(request(), response(), next);
  await tick();
  expect(handler).toHaveBeenCalledTimes(1);
});

it('a client disconnect cannot reopen a slot while expensive work still runs', async () => {
  const gate = createUploadCapacity();
  let finish;
  const handler = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  const middleware = gate((_req, _res, done) => done(), handler);
  const first = request();
  middleware(first, response(), vi.fn());
  await tick();
  first.emit('aborted');
  const busy = response();
  middleware(request(), busy, vi.fn());
  expect(busy.status).toHaveBeenCalledWith(503);
  expect(handler).toHaveBeenCalledTimes(1);
  finish();
  await tick();
  middleware(request(), response(), vi.fn());
  await tick();
  expect(handler).toHaveBeenCalledTimes(2);
  finish();
});

it('aborted parsing frees the slot and never later invokes its controller', async () => {
  const gate = createUploadCapacity();
  let finishParser;
  const handler = vi.fn();
  const first = request();
  gate((_req, _res, done) => { finishParser = done; }, handler)(first, response(), vi.fn());
  first.emit('aborted');
  finishParser();
  gate((_req, _res, done) => done(), handler)(request(), response(), vi.fn());
  await tick();
  expect(handler).toHaveBeenCalledTimes(1);
});

it('customer uploads do not occupy the independent conversion-result budget', async () => {
  const customer = createUploadCapacity('MAX_CONCURRENT_UPLOADS');
  const agent = createUploadCapacity('MAX_CONCURRENT_AGENT_UPLOADS');
  let finish;
  const parser = (_req, _res, done) => done();
  customer(parser, () => new Promise(resolve => { finish = resolve; }))(request(), response(), vi.fn());
  const delivery = vi.fn();
  agent(parser, delivery)(request(), response(), vi.fn());
  await tick();
  expect(delivery).toHaveBeenCalledTimes(1);
  finish();
});
