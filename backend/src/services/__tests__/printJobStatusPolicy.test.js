import { describe, expect, it } from 'vitest';
import { assertPrintJobTransition } from '../printJobStatusPolicy.js';
describe('print state transitions', () => {
  it.each([['assigned', 'accepted'], ['accepted', 'downloading'], ['downloading', 'printing'], ['printing', 'completed']])('allows %s -> %s', (status, next) => {
    expect(() => assertPrintJobTransition({ status }, next, { status: 'queued_for_print' })).not.toThrow();
  });
  it.each(['accepted', 'printing', 'completed'])('never resurrects cancellation as %s', next => {
    expect(() => assertPrintJobTransition({ status: 'cancelled' }, next, { status: 'cancelled' })).toThrow(/cannot move/);
  });
  it('rejects skipped states and allows an idempotent terminal acknowledgment', () => {
    expect(() => assertPrintJobTransition({ status: 'assigned' }, 'completed', { status: 'queued_for_print' })).toThrow();
    expect(() => assertPrintJobTransition({ status: 'completed' }, 'completed', { status: 'completed' })).not.toThrow();
  });
});
