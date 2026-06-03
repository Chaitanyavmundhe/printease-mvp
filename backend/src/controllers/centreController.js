import {
  findCentreByCode,
  findCentreById,
  listCentres,
  updateCentrePaymentMethod,
  updateCentrePricing as saveCentrePricing
} from '../db/repository.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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
  const existingCentre = await findCentreById(req.user.centreId);

  if (!existingCentre) {
    return res.status(404).json({ success: false, message: 'Centre not found for logged in owner' });
  }

  const centre = await saveCentrePricing(req.user.centreId, req.body);

  res.json({ success: true, message: 'Pricing updated', centre });
});

export const updatePaymentMethod = asyncHandler(async (req, res) => {
  const existingCentre = await findCentreById(req.user.centreId);

  if (!existingCentre) {
    return res.status(404).json({ success: false, message: 'Centre not found for logged in owner' });
  }

  const centre = await updateCentrePaymentMethod(req.user.centreId, {
    upiId: typeof req.body.upiId === 'string' ? req.body.upiId.trim().slice(0, 100) : undefined,
    upiQrImageUrl: typeof req.body.upiQrImageUrl === 'string' ? req.body.upiQrImageUrl.trim().slice(0, 500) : undefined
  });

  res.json({ success: true, message: 'Payment method updated', centre });
});
