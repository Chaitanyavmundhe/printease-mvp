const EARTH_RADIUS_KM = 6371;

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toTimestamp(value) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function hasCentreLocation(centre) {
  return Boolean(
    centre?.locationEnabled &&
      toNumber(centre.latitude) !== null &&
      toNumber(centre.longitude) !== null
  );
}

export function getCentreDistanceKm(centre, userLocation) {
  if (!userLocation || !hasCentreLocation(centre)) return null;

  const lat1 = toNumber(userLocation.latitude);
  const lng1 = toNumber(userLocation.longitude);
  const lat2 = toNumber(centre.latitude);
  const lng2 = toNumber(centre.longitude);
  if ([lat1, lng1, lat2, lng2].some((value) => value === null)) return null;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceKm(distanceKm) {
  const distance = toNumber(distanceKm);
  if (distance === null) return "";
  if (distance < 1) return `${Math.max(50, Math.round(distance * 1000 / 50) * 50)} m away`;
  if (distance < 10) return `${distance.toFixed(1)} km away`;
  return `${Math.round(distance)} km away`;
}

function centrePrices(centre) {
  return {
    bwSingle: toNumber(centre?.bwSingle ?? centre?.pricing?.bwSingle),
    bwDouble: toNumber(centre?.bwDouble ?? centre?.pricing?.bwDouble),
    colorSingle: toNumber(centre?.colorSingle ?? centre?.pricing?.colorSingle),
    colorDouble: toNumber(centre?.colorDouble ?? centre?.pricing?.colorDouble),
  };
}

export function getCentreLowestPrice(centre) {
  const prices = Object.values(centrePrices(centre)).filter((value) => value !== null && value > 0);
  return prices.length ? Math.min(...prices) : null;
}

export function buildCentreUsageProfile(orders = []) {
  const usage = new Map();

  for (const order of orders || []) {
    const keys = [order?.centreId, order?.centreCode, order?.hub?.id, order?.hub?.code].filter(Boolean);
    const usedAt = toTimestamp(order?.createdAt || order?.created_at || order?.date || order?.updatedAt || order?.updated_at);

    for (const key of keys) {
      const normalizedKey = String(key);
      const current = usage.get(normalizedKey) || { count: 0, lastUsedAt: 0 };
      usage.set(normalizedKey, {
        count: current.count + 1,
        lastUsedAt: Math.max(current.lastUsedAt, usedAt),
      });
    }
  }

  return usage;
}

function getUsageForCentre(centre, usageProfile) {
  const byId = usageProfile.get(String(centre?.id || "")) || { count: 0, lastUsedAt: 0 };
  const byCode = usageProfile.get(String(centre?.code || "")) || { count: 0, lastUsedAt: 0 };
  return {
    count: byId.count + byCode.count || Number(centre?.usageCount || 0),
    lastUsedAt: Math.max(byId.lastUsedAt, byCode.lastUsedAt, toTimestamp(centre?.lastUsedAt)),
  };
}

function parsePriceLimit(query) {
  const normalized = String(query || "").toLowerCase().replace(/₹|rs\.?/g, " ");
  const match = normalized.match(/(?:under|below|less than|upto|up to|<=|<)\s*(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function requestedPriceValues(centre, query) {
  const normalized = String(query || "").toLowerCase();
  const prices = centrePrices(centre);
  const wantsBw = /\b(?:bw|b\/w|black|blackwhite|black-white)\b/.test(normalized);
  const wantsColor = /\bcolou?r\b/.test(normalized);
  const wantsSingle = /\bsingle\b/.test(normalized);
  const wantsDouble = /\b(?:double|duplex|two-sided|twosided)\b/.test(normalized);

  const entries = Object.entries(prices).filter(([, value]) => value !== null && value > 0);
  const narrowed = entries.filter(([key]) => {
    if (wantsBw && !key.toLowerCase().includes("bw")) return false;
    if (wantsColor && !key.toLowerCase().includes("color")) return false;
    if (wantsSingle && !key.toLowerCase().includes("single")) return false;
    if (wantsDouble && !key.toLowerCase().includes("double")) return false;
    return true;
  });

  return (narrowed.length ? narrowed : entries).map(([, value]) => value);
}

function tokenizeSearch(query) {
  return String(query || "")
    .toLowerCase()
    .replace(/₹|rs\.?|[^\w\s.-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !/^\d+(?:\.\d+)?$/.test(token))
    .filter((token) => ![
      "under",
      "below",
      "less",
      "than",
      "upto",
      "up",
      "to",
      "price",
      "rate",
      "rates",
      "page",
      "per",
      "cheap",
      "cheapest",
      "near",
      "nearby",
      "nearest",
    ].includes(token));
}

function centreSearchText(centre) {
  const prices = centrePrices(centre);
  const availability = centre?.printerOnline || String(centre?.status || "").toLowerCase() === "available" ? "available online open" : "unavailable offline";

  return [
    centre?.name,
    centre?.code,
    centre?.owner,
    centre?.status,
    centre?.addressText,
    centre?.area,
    centre?.city,
    availability,
    "bw black white single double color colour",
    prices.bwSingle !== null ? `bw single ${prices.bwSingle}` : "",
    prices.bwDouble !== null ? `bw double ${prices.bwDouble}` : "",
    prices.colorSingle !== null ? `color colour single ${prices.colorSingle}` : "",
    prices.colorDouble !== null ? `color colour double ${prices.colorDouble}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function centreMatchesSearch(centre, query) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return true;

  const priceLimit = parsePriceLimit(normalized);
  if (priceLimit !== null && !requestedPriceValues(centre, normalized).some((value) => value <= priceLimit)) {
    return false;
  }

  if (/\b(?:available|online|open)\b/.test(normalized)) {
    const available = centre?.printerOnline || String(centre?.status || "").toLowerCase() === "available";
    if (!available) return false;
  }

  if (/\b(?:near|nearby|nearest)\b/.test(normalized) && !hasCentreLocation(centre)) {
    return false;
  }

  const haystack = centreSearchText(centre);
  return tokenizeSearch(normalized).every((token) => haystack.includes(token));
}

export function rankCentres(centres = [], { orders = [], userLocation = null, query = "", sortBy = "smart" } = {}) {
  const usageProfile = buildCentreUsageProfile(orders);
  const now = Date.now();

  return [...(centres || [])]
    .filter((centre) => centreMatchesSearch(centre, query))
    .map((centre) => {
      const distanceKm = getCentreDistanceKm(centre, userLocation);
      const usage = getUsageForCentre(centre, usageProfile);
      const daysSinceUse = usage.lastUsedAt ? Math.max(0, (now - usage.lastUsedAt) / 86400000) : null;
      return {
        ...centre,
        distanceKm,
        distanceLabel: formatDistanceKm(distanceKm),
        usageCount: usage.count,
        lastUsedAt: usage.lastUsedAt || null,
        lowestPrice: getCentreLowestPrice(centre),
        recentUseScore: daysSinceUse === null ? 0 : Math.max(0, 20 - daysSinceUse),
      };
    })
    .sort((left, right) => {
      const rightAvailable = right.printerOnline || String(right.status || "").toLowerCase() === "available" ? 1 : 0;
      const leftAvailable = left.printerOnline || String(left.status || "").toLowerCase() === "available" ? 1 : 0;
      if (rightAvailable !== leftAvailable) return rightAvailable - leftAvailable;

      if (sortBy === "price" || sortBy === "price_bw" || sortBy === "price_color") {
        const getPrice = (c) => {
          if (sortBy === "price_bw") {
            const val = Math.min(
              c.bwSingle ?? Infinity, 
              c.bwDouble ?? Infinity, 
              c.pricing?.bwSingle ?? Infinity, 
              c.pricing?.bwDouble ?? Infinity
            );
            return val === Infinity ? null : val;
          }
          if (sortBy === "price_color") {
            const val = Math.min(
              c.colorSingle ?? Infinity, 
              c.colorDouble ?? Infinity, 
              c.pricing?.colorSingle ?? Infinity, 
              c.pricing?.colorDouble ?? Infinity
            );
            return val === Infinity ? null : val;
          }
          return c.lowestPrice;
        };

        const leftPrice = getPrice(left);
        const rightPrice = getPrice(right);

        if (leftPrice !== rightPrice) {
          if (leftPrice === null) return 1;
          if (rightPrice === null) return -1;
          return leftPrice - rightPrice;
        }
      }

      const leftDistance = left.distanceKm;
      const rightDistance = right.distanceKm;

      if (userLocation && leftDistance !== null && rightDistance !== null && Math.abs(leftDistance - rightDistance) > 0.35) {
        return leftDistance - rightDistance;
      }
      if (userLocation && leftDistance !== rightDistance) {
        if (leftDistance === null) return 1;
        if (rightDistance === null) return -1;
      }

      if (right.usageCount !== left.usageCount) return right.usageCount - left.usageCount;
      if (right.recentUseScore !== left.recentUseScore) return right.recentUseScore - left.recentUseScore;

      if (left.lowestPrice !== right.lowestPrice) {
        if (left.lowestPrice === null) return 1;
        if (right.lowestPrice === null) return -1;
        return left.lowestPrice - right.lowestPrice;
      }

      return String(left.name || "").localeCompare(String(right.name || ""));
    });
}
