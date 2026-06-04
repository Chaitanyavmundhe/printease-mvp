import {
  findCentreByCode,
  findCentreById,
  listCentres,
  updateCentrePaymentMethod,
  updateCentrePricing as saveCentrePricing
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

export const updateCentrePricing = asyncHandler(async (req, res) => {
  const hubId = getHubId(req);
  const existingCentre = await findCentreById(hubId);

  if (!existingCentre) {
    return res.status(404).json({ success: false, message: 'Centre not found for logged in owner' });
  }

  const centre = await saveCentrePricing(hubId, req.body);

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
