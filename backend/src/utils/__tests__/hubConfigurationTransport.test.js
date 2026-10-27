import { expect, it } from 'vitest';
import { normalizeConfigurationFile, configurationPayload, calculatePrintPricingLocal } from '../../../../frontend/src/utils/hubOrderConfiguration.js';
import { normalizePrintOptions } from '../printOptions.js';
import { calculatePrintPricing } from '../calculatePrice.js';

it('hub editor values survive backend normalization and match authoritative pricing', () => {
  const initial = normalizeConfigurationFile({ id: 'order-file', fileName: 'test.pdf', pageCount: 4, copies: 1, printOptions: { sides: 'one_sided' } });
  const edited = { ...initial, copies: 2, sideType: 'double', duplexBinding: 'short-edge', scaleMode: 'fit_to_page', marginMode: 'none', printDpi: 600, pageOrder: 'reverse', backSideRotation: 'rotate-180', pagesPerSheet: 2, colorMode: 'color' };
  const sent = configurationPayload([edited], 'Customer correction').files[0];
  const normalized = normalizePrintOptions(sent.printOptions, 4);
  expect(normalized).toMatchObject({ colorMode: 'color', sides: 'two_sided_short_edge', copies: 2, quality: { dpi: 600 }, margins: { mode: 'none' }, scale: { mode: 'fit_to_page' }, pageOrder: 'reverse', backSideRotation: 'rotate-180', duplexBinding: 'short-edge' });
  const pricing = { bwSingle: 2, bwDouble: 3, colorSingle: 5, colorDouble: 6, watermarkCharge: 2 };
  const local = calculatePrintPricingLocal({ pricing, originalPageCount: 4, copies: 2, colorMode: 'color', sides: normalized.sides, pagesPerSheet: 2 });
  const authoritative = calculatePrintPricing({ centre: { pricing }, originalPageCount: 4, copies: 2, colorType: 'color', sideType: 'double', pagesPerSheet: 2, selectedPages: 'all' });
  expect(local.totalAmountPaise).toBe(authoritative.totalAmountPaise);
});

it('does not add advanced overrides to ordinary orders that inherit printer profiles', () => {
  const normalized = normalizePrintOptions({}, 4);
  expect(normalized).not.toHaveProperty('backSideRotation');
  expect(normalized).not.toHaveProperty('pageOrder');
  expect(normalized).not.toHaveProperty('duplexBinding');
  expect(normalizePrintOptions({ pageOrder: 'evil', backSideRotation: 'evil', duplexBinding: 'evil' }, 4)).not.toHaveProperty('pageOrder');
});
