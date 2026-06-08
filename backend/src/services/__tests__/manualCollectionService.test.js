import { describe, it, expect, vi } from 'vitest';
import { processManualCollection } from '../manualCollectionService.js';
import * as repository from '../../db/repository.js';
import * as printQueueService from '../printQueueService.js';
import * as orderUtils from '../orderUtils.js';

vi.mock('../../db/repository.js');
vi.mock('../printQueueService.js');
vi.mock('../orderUtils.js');

describe('manualCollectionService', () => {
  describe('processManualCollection', () => {
    it('returns INVALID_METHOD error for methods other than cash or manual_upi', async () => {
      const result = await processManualCollection({
        orderId: '123',
        hubId: 'hub_1',
        rawMethod: 'credit_card',
        transactionNoteInput: '',
        autoPrintAfterCollection: false
      });

      expect(result).toEqual({
        error: 'INVALID_METHOD',
        message: 'Invalid collection method. Allowed values: cash, manual_upi'
      });
    });

    it('proceeds for valid method cash', async () => {
      repository.withTransaction.mockResolvedValueOnce({ success: true, fakeResult: true });
      
      const result = await processManualCollection({
        orderId: '123',
        hubId: 'hub_1',
        rawMethod: 'cash',
        transactionNoteInput: '',
        autoPrintAfterCollection: false
      });

      expect(result).toEqual({ success: true, fakeResult: true });
      expect(repository.withTransaction).toHaveBeenCalled();
    });

    it('proceeds for valid method manual_upi', async () => {
      repository.withTransaction.mockResolvedValueOnce({ success: true, fakeResult: true });
      
      const result = await processManualCollection({
        orderId: '123',
        hubId: 'hub_1',
        rawMethod: 'manual_upi',
        transactionNoteInput: '',
        autoPrintAfterCollection: false
      });

      expect(result).toEqual({ success: true, fakeResult: true });
      expect(repository.withTransaction).toHaveBeenCalled();
    });
  });
});
