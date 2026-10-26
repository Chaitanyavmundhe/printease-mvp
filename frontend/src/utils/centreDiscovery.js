import { normalizeCentreSort } from "./centreSort";
const EARTH_RADIUS_KM = 6371;

function toNumber(value) {
  if (value === null || value === undefined || typeof value === "boolean" || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toTimestamp(value) {
  if (!value) return 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function hasCentreLocation(centre) {
  const latitude = toNumber(centre?.latitude);
  const longitude = toNumber(centre?.longitude);
  return Boolean(centre?.locationEnabled && latitude !== null && longitude !== null &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180);
}

export function getCentreDistanceKm(centre, userLocation) {
  if (!userLocation || !hasCentreLocation(centre)) return null;

  const lat1 = toNumber(userLocation.latitude);
  const lng1 = toNumber(userLocation.longitude);
  const lat2 = toNumber(centre.latitude);
  const lng2 = toNumber(centre.longitude);
  if ([lat1, lng1, lat2, lng2].some((value) => value === null)) return null;
  if (Math.abs(lat1) > 90 || Math.abs(lng1) > 180) return null;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  const bounded = Math.min(1, Math.max(0, a));
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded));
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

  for (const [index, order] of (orders || []).entries()) {
    const keys = new Set([order?.centreId, order?.centreCode, order?.hub?.id, order?.hub?.code].filter(Boolean).map(String));
    const orderKey = String(order?.backendId || order?.id || `row-${index}`);
    const usedAt = toTimestamp(order?.createdAt || order?.created_at || order?.date || order?.updatedAt || order?.updated_at);

    for (const key of keys) {
      const normalizedKey = String(key);
      const current = usage.get(normalizedKey) || { count: 0, lastUsedAt: 0, orderKeys: new Set() };
      const orderKeys = new Set([...current.orderKeys, orderKey]);
      usage.set(normalizedKey, {
        count: orderKeys.size,
        lastUsedAt: Math.max(current.lastUsedAt, usedAt),
        orderKeys,
      });
    }
  }

  return usage;
}

function getUsageForCentre(centre, usageProfile) {
  const byId = usageProfile.get(String(centre?.id || "")) || { count: 0, lastUsedAt: 0 };
  const byCode = usageProfile.get(String(centre?.code || "")) || { count: 0, lastUsedAt: 0 };
  const orderKeys = new Set([...(byId.orderKeys || []), ...(byCode.orderKeys || [])]);
  return {
    count: orderKeys.size || Number(centre?.usageCount || 0),
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

  return narrowed.map(([, value]) => value);
}

function tokenizeSearch(query) {
  return String(query || "")
    .toLowerCase()
    .replace(/(?:under|below|less than|upto|up to|<=|<)\s*(?:₹|rs\.?)?\s*\d+(?:\.\d+)?/g, " ")
    .replace(/₹|rs\.?|[^\w\s.-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
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
  const availability = isCentreAvailable(centre) ? "available online open" : "unavailable offline";

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
    const available = isCentreAvailable(centre);
    if (!available) return false;
  }

  if (/\b(?:near|nearby|nearest)\b/.test(normalized) && !hasCentreLocation(centre)) {
    return false;
  }

  const haystack = centreSearchText(centre);
  return tokenizeSearch(normalized).every((token) => haystack.includes(token));
}

export function rankCentres(centres = [], { orders = [], userLocation = null, query = "", sortBy = "smart" } = {}) {
  const mode = normalizeCentreSort(sortBy);
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
      // An explicit choice must be the primary key, not availability in disguise.
      // Availability is only a tie-breaker outside Recommended/Available first.
      let primary = 0;
      if (mode.startsWith("price")) primary = compareKnown(priceForSort(left, mode), priceForSort(right, mode));
      if (mode === "nearest") primary = compareKnown(left.distanceKm, right.distanceKm);
      if (mode === "used") primary = right.usageCount - left.usageCount;
      if (mode === "recent") primary = (right.lastUsedAt || 0) - (left.lastUsedAt || 0);
      if (mode === "name") primary = String(left.name || "").localeCompare(String(right.name || ""));
      if (primary) return primary;
      const available = Number(isCentreAvailable(right)) - Number(isCentreAvailable(left));
      if (available) return available;
      if (mode === "smart") {
        // Fixed distance buckets keep comparison transitive; a pairwise distance
        // threshold mixed with usage can otherwise produce inconsistent ordering.
        const distance = userLocation ? compareKnown(distanceBucket(left.distanceKm), distanceBucket(right.distanceKm)) : 0;
        if (distance) return distance;
        if (right.usageCount !== left.usageCount) return right.usageCount - left.usageCount;
        if (right.lastUsedAt !== left.lastUsedAt) return (right.lastUsedAt || 0) - (left.lastUsedAt || 0);
        const price = compareKnown(left.lowestPrice, right.lowestPrice);
        if (price) return price;
      }
      return String(left.name || "").localeCompare(String(right.name || "")) || String(left.id || "").localeCompare(String(right.id || ""));
    });
}

function isCentreAvailable(centre) {
  if (typeof centre?.printerOnline === "boolean") return centre.printerOnline;
  return String(centre?.status || "").toLowerCase() === "available";
}

function compareKnown(left, right) {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

function distanceBucket(value) { return value === null ? null : Math.floor(value / 0.35); }

function priceForSort(centre, mode) {
  if (mode === "price") return centre.lowestPrice;
  const fields = { price_bw: "bwSingle", price_bw_double: "bwDouble", price_color: "colorSingle", price_color_double: "colorDouble" };
  const value = centrePrices(centre)[fields[mode]];
  return value !== null && value > 0 ? value : null;
}
