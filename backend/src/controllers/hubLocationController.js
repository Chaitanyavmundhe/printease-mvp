import { findCentreById, updateHubLocation } from '../db/repository.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function getHubId(req) {
  return req.user?.centreId || req.user?.hubId;
}

function isValidLatitude(val) {
  if (val === null || val === undefined) return true;
  const n = Number(val);
  return !isNaN(n) && n >= -90 && n <= 90;
}

function isValidLongitude(val) {
  if (val === null || val === undefined) return true;
  const n = Number(val);
  return !isNaN(n) && n >= -180 && n <= 180;
}

function sanitizeText(val, maxLen = 300) {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, maxLen);
}

export const updateHubLocationHandler = asyncHandler(async (req, res) => {
  const hubId = getHubId(req);

  if (!hubId) {
    return res.status(403).json({ success: false, message: 'No hub associated with this account.' });
  }

  const existingCentre = await findCentreById(hubId);
  if (!existingCentre) {
    return res.status(404).json({ success: false, message: 'Centre not found for logged-in owner.' });
  }

  const {
    locationEnabled,
    latitude,
    longitude,
    addressText,
    area,
    city
  } = req.body;

  // Validate lat/lng
  const lat = latitude === '' || latitude === undefined ? null : latitude;
  const lng = longitude === '' || longitude === undefined ? null : longitude;

  if (!isValidLatitude(lat)) {
    return res.status(400).json({ success: false, message: 'Latitude must be between -90 and 90.' });
  }
  if (!isValidLongitude(lng)) {
    return res.status(400).json({ success: false, message: 'Longitude must be between -180 and 180.' });
  }

  // If enabling location, require lat + lng
  if (locationEnabled && (lat === null || lng === null)) {
    return res.status(400).json({ success: false, message: 'Latitude and longitude are required when enabling location.' });
  }

  const centre = await updateHubLocation(hubId, {
    locationEnabled: Boolean(locationEnabled),
    latitude: lat !== null ? Number(lat) : null,
    longitude: lng !== null ? Number(lng) : null,
    addressText: sanitizeText(addressText),
    area: sanitizeText(area),
    city: sanitizeText(city)
  });

  res.json({ success: true, message: 'Location updated.', centre });
});
