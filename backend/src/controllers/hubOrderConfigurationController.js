import { applyOrderConfigurationChange, confirmOrderBill } from '../services/orderConfigurationService.js';
import { getOrderConfigEvents, findOrderByIdOrCode } from '../db/repository.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function getHubId(req) {
  return req.user?.centreId || req.user?.hubId;
}

/**
 * Endpoint to override the print settings / configuration of a cash-payment order.
 * PATCH /api/hubs/orders/:orderId/configuration
 */
export const updateHubOrderConfiguration = asyncHandler(async (req, res) => {
  const hubId = getHubId(req);
  if (!hubId) {
    return res.status(400).json({
      success: false,
      message: 'Logged in hub user is not linked to a hub'
    });
  }

  const { orderId } = req.params;
  const { files, note } = req.body;

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one file configuration is required'
    });
  }

  try {
    const result = await applyOrderConfigurationChange({
      orderId,
      hubId,
      actor: {
        role: 'hub',
        userId: req.user?.id
      },
      newFilesConfig: files,
      note: note || ''
    });

    return res.json({
      success: true,
      message: 'Order configuration updated successfully',
      order: result.order,
      configEvent: result.configEvent,
      files: result.files
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update order configuration'
    });
  }
});

/**
 * Endpoint to retrieve the configuration audit history events for an order.
 * GET /api/hubs/orders/:orderId/configuration-history
 */
export const getHubOrderConfigurationHistory = asyncHandler(async (req, res) => {
  const hubId = getHubId(req);
  if (!hubId) {
    return res.status(400).json({
      success: false,
      message: 'Logged in hub user is not linked to a hub'
    });
  }

  const { orderId } = req.params;
  
  // Verify order exists and belongs to the hub first
  const order = await findOrderByIdOrCode(orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  if (order.centreId !== hubId) {
    return res.status(403).json({
      success: false,
      message: 'You do not have access to this order configuration history'
    });
  }

  try {
    const history = await getOrderConfigEvents(order.id);
    return res.json({
      success: true,
      history
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve configuration history'
    });
  }
});

/**
 * Endpoint to confirm the bill for an order awaiting hub confirmation.
 * POST /api/hubs/orders/:orderId/confirm-bill
 */
export const confirmBill = asyncHandler(async (req, res) => {
  const hubId = getHubId(req);
  if (!hubId) {
    return res.status(400).json({
      success: false,
      message: 'Logged in hub user is not linked to a hub'
    });
  }

  const { orderId } = req.params;

  try {
    const updatedOrder = await confirmOrderBill({ orderId, hubId });
    return res.json({
      success: true,
      message: 'Bill confirmed successfully',
      order: updatedOrder
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to confirm bill'
    });
  }
});
