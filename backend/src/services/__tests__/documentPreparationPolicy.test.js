import { describe, expect, it } from 'vitest';
import { assertPreparationReportCanReplace } from '../documentPreparationPolicy.js';

describe('prepared document immutability', () => {
  const document = { preparationStatus: 'prepared', fileSha256: 'original', printReadySha256: 'verified' };
  it('allows first preparation only for pending documents', () => {
    expect(assertPreparationReportCanReplace({ preparationStatus: 'pending' }, { preparationStatus: 'prepared' })).toBe(true);
  });
  it('accepts retries without rewriting verified metadata', () => {
    expect(assertPreparationReportCanReplace(document, { preparationStatus: 'prepared', preparedPageCount: 999 })).toBe(false);
    expect(assertPreparationReportCanReplace(document, { preparationStatus: 'prepared', printReadySha256: 'verified' })).toBe(false);
  });
  it('rejects changed printable bytes and late failures', () => {
    expect(() => assertPreparationReportCanReplace(document, { preparationStatus: 'prepared', printReadySha256: 'other' })).toThrow();
    expect(() => assertPreparationReportCanReplace(document, { preparationStatus: 'failed' })).toThrow();
  });
  it('protects original PDFs too', () => {
    expect(() => assertPreparationReportCanReplace({ ...document, printReadySha256: null }, { preparationStatus: 'prepared', printReadySha256: 'replacement' })).toThrow();
  });
});
