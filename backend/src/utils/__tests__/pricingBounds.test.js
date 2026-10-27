import { expect, it } from 'vitest';
import { calculatePrintPricing } from '../calculatePrice.js';
const input = { centre: { pricing: { bwSingle: 2, watermarkCharge: 0 } }, originalPageCount: 2, selectedPages: 'all', copies: 1, colorType: 'bw', sideType: 'single' };
it('rejects excessive or fractional copies instead of sending them to a printer', () => {
  for (const copies of [0, 100, 1.5, Number.MAX_SAFE_INTEGER, Infinity]) {
    expect(() => calculatePrintPricing({ ...input, copies })).toThrow(/Copies/);
  }
});
it('rejects invalid rates and integer bill overflow, not silently inventing a price', () => {
  for (const bwSingle of [undefined, null, -1, NaN, Infinity]) {
    expect(() => calculatePrintPricing({ ...input, centre: { pricing: { bwSingle } } })).toThrow(/pricing/);
  }
  expect(() => calculatePrintPricing({ ...input, originalPageCount: 100000, copies: 99, centre: { pricing: { bwSingle: 10000 } } })).toThrow(/bill amount/);
});
it('retains explicitly configured free pricing and ordinary server totals', () => {
  expect(calculatePrintPricing(input).totalAmountPaise).toBe(400);
  expect(calculatePrintPricing({ ...input, centre: { pricing: { bwSingle: 0 } } }).totalAmountPaise).toBe(0);
});
