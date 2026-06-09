import { getPrinterProfile, upsertPrinterProfile } from '../db/repository.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function getHubId(req) {
  return req.user?.centreId || req.user?.hubId;
}

export const getProfile = asyncHandler(async (req, res) => {
  const hubId = getHubId(req);
  if (!hubId) return res.status(403).json({ success: false, message: 'No hub associated.' });

  const { platform, printerName } = req.query;
  if (!platform || !printerName) {
    return res.status(400).json({ success: false, message: 'Platform and printerName required.' });
  }

  const profile = await getPrinterProfile(hubId, platform, printerName);
  res.json({ success: true, profile: profile || null });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const hubId = getHubId(req);
  if (!hubId) return res.status(403).json({ success: false, message: 'No hub associated.' });

  const { platform, printerName, profile } = req.body;
  if (!platform || !printerName || !profile) {
    return res.status(400).json({ success: false, message: 'Platform, printerName, and profile required.' });
  }

  const updatedProfile = await upsertPrinterProfile(hubId, platform, printerName, profile);
  res.json({ success: true, profile: updatedProfile });
});
