import {
  findCentreByCode,
  findCentreById,
  listCentres,
  updateCentrePaymentMethod,
  updateCentrePricing as saveCentrePricing,
  deleteCentreByOwner
} from '../db/repository.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function getHubId(req) {
  return req.user?.centreId || req.user?.hubId;
}

function isSafeQrImageUrl(value) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return ['https:', 'data:'].includes(url.protocol) && value.length <= 500;
  } catch {
    return false;
  }
}

export const getCentres = asyncHandler(async (req, res) => {
  res.json({ success: true, centres: await listCentres() });
});

export const getCentreByCode = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const centre = await findCentreByCode(code);

  if (!centre) {
    return res.status(404).json({ success: false, message: 'Centre not found' });
  }

  res.json({ success: true, centre });
});

function isValidPrice(val) {
  if (val === undefined) return true;
  if (typeof val !== 'number' || isNaN(val)) return false;
  if (val < 0 || val > 10000) return false;
  return true;
}

export const updateCentrePricing = asyncHandler(async (req, res) => {
  const hubId = getHubId(req);
  const existingCentre = await findCentreById(hubId);

  if (!existingCentre) {
    return res.status(404).json({ success: false, message: 'Centre not found for logged in owner' });
  }

  const { bwSingle, bwDouble, colorSingle, colorDouble, watermarkCharge } = req.body;
  
  if (!isValidPrice(bwSingle) || !isValidPrice(bwDouble) || !isValidPrice(colorSingle) || !isValidPrice(colorDouble) || !isValidPrice(watermarkCharge)) {
    return res.status(400).json({ success: false, message: 'Invalid pricing values. Must be a positive number.' });
  }

  const centre = await saveCentrePricing(hubId, { bwSingle, bwDouble, colorSingle, colorDouble, watermarkCharge });

  res.json({ success: true, message: 'Pricing updated', centre });
});

export const updatePaymentMethod = asyncHandler(async (req, res) => {
  const hubId = getHubId(req);
  const existingCentre = await findCentreById(hubId);

  if (!existingCentre) {
    return res.status(404).json({ success: false, message: 'Centre not found for logged in owner' });
  }

  const upiQrImageUrl = typeof req.body.upiQrImageUrl === 'string' ? req.body.upiQrImageUrl.trim().slice(0, 500) : undefined;

  if (!isSafeQrImageUrl(upiQrImageUrl)) {
    return res.status(400).json({ success: false, message: 'UPI QR image must be an HTTPS or data image URL.' });
  }

  const centre = await updateCentrePaymentMethod(hubId, {
    upiId: typeof req.body.upiId === 'string' ? req.body.upiId.trim().slice(0, 100) : undefined,
    upiQrImageUrl
  });

  res.json({ success: true, message: 'Payment method updated', centre });
});

export const deleteMyCentre = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  // Note: the foreign key from print_orders to print_hubs is "on delete cascade".
  // This will cascade delete printers, agents, print_orders, and print_jobs associated with the hub.
  await deleteCentreByOwner(userId);
  
  res.json({ success: true, message: 'Centre deleted successfully' });
});
