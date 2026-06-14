import {
  findCentreByCode,
  findCentreById,
  listCentres,
  updateCentrePaymentMethod,
  updateCentrePricing as saveCentrePricing,
  deleteCentreByOwner,
  updateCentreAfterOrderSettings
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

  const { listPrintJobsByHub } = await import('../db/repository.js');
  const jobs = await listPrintJobsByHub(centre.id);
  const queuedJobs = jobs.filter(j => ['queued', 'assigned', 'accepted', 'downloading', 'printing'].includes(String(j.status).toLowerCase()));
  
  let queuedOfficeCount = 0;
  let queuedEstimatedSeconds = 0;
  
  for (const job of queuedJobs) {
    // Rough estimate: 5s per copy + 2s per job
    queuedEstimatedSeconds += (job.copies || 1) * 5 + 2;
    if (job.fileType && (job.fileType.includes('officedocument') || job.fileType.includes('msword') || job.fileType.includes('ms-excel'))) {
      queuedOfficeCount += 1;
    }
  }

  centre.hubLoad = {
    queuedEstimatedSeconds,
    queuedOfficeCount,
    isOnline: centre.printerOnline
  };

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

export const updateAfterOrderSettings = asyncHandler(async (req, res) => {
  const hubId = getHubId(req);
  const existingCentre = await findCentreById(hubId);

  if (!existingCentre) {
    return res.status(404).json({ success: false, message: 'Centre not found for logged in owner' });
  }

  const { afterOrderSettings } = req.body;
  if (!afterOrderSettings || typeof afterOrderSettings !== 'object') {
    return res.status(400).json({ success: false, message: 'Invalid settings format. Must be an object.' });
  }

  // Basic validation of fields
  const enabled = !!afterOrderSettings.enabled;
  const type = ['blank', 'custom', 'watermark'].includes(afterOrderSettings.type) ? afterOrderSettings.type : 'blank';
  const customText = typeof afterOrderSettings.customText === 'string' ? afterOrderSettings.customText.slice(0, 1000) : '';
  
  const watermarkMetadata = {
    printerId: !!afterOrderSettings.watermarkMetadata?.printerId,
    pickupCode: !!afterOrderSettings.watermarkMetadata?.pickupCode,
    clientName: !!afterOrderSettings.watermarkMetadata?.clientName,
    serialNo: !!afterOrderSettings.watermarkMetadata?.serialNo
  };

  const layout = {
    fontSize: typeof afterOrderSettings.layout?.fontSize === 'number' ? Math.max(1, Math.min(100, afterOrderSettings.layout.fontSize)) : 12,
    opacity: typeof afterOrderSettings.layout?.opacity === 'number' ? Math.max(0, Math.min(1, afterOrderSettings.layout.opacity)) : 0.5,
    location: {
      x: typeof afterOrderSettings.layout?.location?.x === 'number' ? Math.max(0, Math.min(2000, afterOrderSettings.layout.location.x)) : 100,
      y: typeof afterOrderSettings.layout?.location?.y === 'number' ? Math.max(0, Math.min(2000, afterOrderSettings.layout.location.y)) : 100
    },
    orientation: typeof afterOrderSettings.layout?.orientation === 'number' ? Math.max(-360, Math.min(360, afterOrderSettings.layout.orientation)) : 0,
    shape: ['text', 'box', 'circle'].includes(afterOrderSettings.layout?.shape) ? afterOrderSettings.layout.shape : 'text'
  };

  const sanitizedSettings = {
    enabled,
    type,
    customText,
    watermarkMetadata,
    layout
  };

  const centre = await updateCentreAfterOrderSettings(hubId, sanitizedSettings);
  res.json({ success: true, message: 'After-order page settings updated', centre });
});

