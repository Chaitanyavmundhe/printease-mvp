export function getPricePerPage(centre, colorType, sideType) {
  if (!centre) return 0;
  if (colorType === "bw" && sideType === "single") return centre.bwSingle;
  if (colorType === "bw" && sideType === "double") return centre.bwDouble;
  if (colorType === "color" && sideType === "single") return centre.colorSingle;
  return centre.colorDouble;
}

export function calculateTotalAmount({ pages, copies, pricePerPage, watermark, watermarkCharge = 2 }) {
  const base = Number(pages || 0) * Number(copies || 0) * Number(pricePerPage || 0);
  const watermarkAmount = watermark ? Number(watermarkCharge || 0) : 0;
  return base + watermarkAmount;
}
