import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canHubConfigureManualOrder, applyOrderConfigurationChange } from '../orderConfigurationService.js';
import * as repository from '../../db/repository.js';

vi.mock('../../db/repository.js');

describe('orderConfigurationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock repository.executor to return the client or a fallback mock database client
    repository.executor.mockImplementation((client) => client || {
      query: vi.fn().mockResolvedValue({ rows: [{ count: 0 }] })
    });

    // Default mock implementation of withTransaction calls the callback with a mock client
    repository.withTransaction.mockImplementation(async (cb) => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [{ count: 0 }] })
      };
      return cb(mockClient);
    });
  });

  describe('canHubConfigureManualOrder', () => {
    it('returns eligible = true for a valid manual payment order with no print jobs', async () => {
      const order = {
        id: 'order_1',
        centreId: 'hub_1',
        paymentStatus: 'pending',
        status: 'pending',
        configLockedAt: null
      };

      const result = await canHubConfigureManualOrder({ order, hubId: 'hub_1' });
      expect(result).toEqual({ eligible: true });
    });

    it('returns eligible = false if order does not belong to the hub', async () => {
      const order = {
        id: 'order_1',
        centreId: 'hub_other',
        paymentStatus: 'pending',
        status: 'pending',
        configLockedAt: null
      };

      const result = await canHubConfigureManualOrder({ order, hubId: 'hub_1' });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('belong to this hub');
    });

    it('returns eligible = false if payment status is verified (paid online)', async () => {
      const order = {
        id: 'order_1',
        centreId: 'hub_1',
        paymentStatus: 'verified',
        status: 'pending',
        configLockedAt: null
      };

      const result = await canHubConfigureManualOrder({ order, hubId: 'hub_1' });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Only manual payment orders can be configured');
    });

    it('returns eligible = false if order is completed or cancelled', async () => {
      const order = {
        id: 'order_1',
        centreId: 'hub_1',
        paymentStatus: 'pending',
        status: 'completed',
        configLockedAt: null
      };

      const result = await canHubConfigureManualOrder({ order, hubId: 'hub_1' });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('already in completed state');
    });

    it('returns eligible = false if order configuration is locked', async () => {
      const order = {
        id: 'order_1',
        centreId: 'hub_1',
        paymentStatus: 'pending',
        status: 'pending',
        configLockedAt: '2026-06-09T00:00:00Z',
        configLockReason: 'Configuration locked by admin'
      };

      const result = await canHubConfigureManualOrder({ order, hubId: 'hub_1' });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('Configuration locked by admin');
    });

    it('returns eligible = false if print jobs have already been generated', async () => {
      const order = {
        id: 'order_1',
        centreId: 'hub_1',
        paymentStatus: 'pending',
        status: 'pending',
        configLockedAt: null
      };

      // Mock executor to return a client that reports 1 print job exists
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [{ count: 1 }] })
      };
      repository.executor.mockReturnValueOnce(mockClient);

      const result = await canHubConfigureManualOrder({ order, hubId: 'hub_1' });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('after print jobs are generated');
    });
  });

  describe('applyOrderConfigurationChange', () => {
    it('throws error if order does not exist', async () => {
      repository.findOrderByIdOrCode.mockResolvedValueOnce(null);

      await expect(
        applyOrderConfigurationChange({
          orderId: 'nonexistent',
          hubId: 'hub_1',
          actor: { role: 'hub', userId: 'user_1' },
          newFilesConfig: []
        })
      ).rejects.toThrow('Order not found');
    });

    it('applies configuration change, recalculates prices, and logs event inside transaction', async () => {
      const mockOrder = {
        id: 'order_1',
        centreId: 'hub_1',
        paymentStatus: 'pending',
        status: 'pending',
        printOptions: {},
        priceSnapshot: { totalAmountPaise: 100 },
        totalAmountPaise: 100
      };

      const mockHub = {
        id: 'hub_1',
        pricing: {
          bwSingle: 1,
          bwDouble: 1.5,
          colorSingle: 2,
          colorDouble: 3,
          watermarkCharge: 2
        }
      };

      const mockOrderFiles = [
        {
          id: 'file_1',
          documentId: 'doc_1',
          originalPageCount: 10,
          copies: 1,
          printOptions: { colorMode: 'black_white', sides: 'one_sided', watermark: { enabled: false } },
          lineAmountPaise: 1000
        }
      ];

      repository.findOrderByIdOrCode.mockResolvedValueOnce(mockOrder);
      repository.findCentreById.mockResolvedValueOnce(mockHub);
      repository.listOrderFiles.mockResolvedValueOnce(mockOrderFiles);

      const mockUpdatedFile = { ...mockOrderFiles[0], copies: 2 };
      repository.updateOrderFileConfiguration.mockResolvedValueOnce(mockUpdatedFile);
      
      const mockUpdatedOrder = { ...mockOrder, copies: 2, amount: 20 };
      repository.updateOrderConfiguration.mockResolvedValueOnce(mockUpdatedOrder);
      
      const mockEvent = { id: 'event_1' };
      repository.createOrderConfigEvent.mockResolvedValueOnce(mockEvent);

      const result = await applyOrderConfigurationChange({
        orderId: 'order_1',
        hubId: 'hub_1',
        actor: { role: 'hub', userId: 'user_1' },
        newFilesConfig: [
          {
            id: 'file_1',
            copies: 2,
            printOptions: { colorMode: 'black_white', sides: 'one_sided' }
          }
        ],
        note: 'Recounted copies'
      });

      expect(result.success).toBe(true);
      expect(result.order).toEqual(mockUpdatedOrder);
      expect(result.configEvent).toEqual(mockEvent);
      expect(repository.updateOrderFileConfiguration).toHaveBeenCalled();
      expect(repository.updateOrderConfiguration).toHaveBeenCalled();
      expect(repository.createOrderConfigEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order_1',
          actorRole: 'hub',
          actorUserId: 'user_1',
          actorHubId: 'hub_1',
          eventType: 'hub_manual_override',
          note: 'Recounted copies'
        }),
        expect.any(Object)
      );
    });

    it('rejects configuration updates for file IDs outside the order', async () => {
      const mockOrder = {
        id: 'order_1',
        centreId: 'hub_1',
        paymentStatus: 'pending',
        status: 'pending'
      };

      const mockHub = {
        id: 'hub_1',
        pricing: {
          bwSingle: 1,
          bwDouble: 1.5,
          colorSingle: 2,
          colorDouble: 3,
          watermarkCharge: 2
        }
      };

      repository.findOrderByIdOrCode.mockResolvedValueOnce(mockOrder);
      repository.findCentreById.mockResolvedValueOnce(mockHub);
      repository.listOrderFiles.mockResolvedValueOnce([
        {
          id: 'file_1',
          documentId: 'doc_1',
          originalPageCount: 10,
          copies: 1,
          printOptions: {}
        }
      ]);

      await expect(
        applyOrderConfigurationChange({
          orderId: 'order_1',
          hubId: 'hub_1',
          actor: { role: 'hub', userId: 'user_1' },
          newFilesConfig: [
            {
              id: 'file_other',
              copies: 2
            }
          ],
          note: 'Invalid file'
        })
      ).rejects.toThrow('File file_other does not belong to this order');

      expect(repository.updateOrderFileConfiguration).not.toHaveBeenCalled();
      expect(repository.updateOrderConfiguration).not.toHaveBeenCalled();
      expect(repository.createOrderConfigEvent).not.toHaveBeenCalled();
    });

    it('rejects duplicate file configuration IDs', async () => {
      const mockOrder = {
        id: 'order_1',
        centreId: 'hub_1',
        paymentStatus: 'pending',
        status: 'pending'
      };

      const mockHub = {
        id: 'hub_1',
        pricing: {
          bwSingle: 1,
          bwDouble: 1.5,
          colorSingle: 2,
          colorDouble: 3,
          watermarkCharge: 2
        }
      };

      repository.findOrderByIdOrCode.mockResolvedValueOnce(mockOrder);
      repository.findCentreById.mockResolvedValueOnce(mockHub);
      repository.listOrderFiles.mockResolvedValueOnce([
        {
          id: 'file_1',
          documentId: 'doc_1',
          originalPageCount: 10,
          copies: 1,
          printOptions: {}
        }
      ]);

      await expect(
        applyOrderConfigurationChange({
          orderId: 'order_1',
          hubId: 'hub_1',
          actor: { role: 'hub', userId: 'user_1' },
          newFilesConfig: [
            { id: 'file_1', copies: 2 },
            { id: 'file_1', copies: 3 }
          ],
          note: 'Duplicate file'
        })
      ).rejects.toThrow('Duplicate file configuration submitted for file_1');

      expect(repository.updateOrderFileConfiguration).not.toHaveBeenCalled();
      expect(repository.updateOrderConfiguration).not.toHaveBeenCalled();
      expect(repository.createOrderConfigEvent).not.toHaveBeenCalled();
    });
  });
});
