export function calculatePrice({ centre, pages, copies, colorType, sideType, watermarkEnabled }) {
  if (!centre) throw new Error('Centre not found');

  let pricePerPage;

  if (colorType === 'bw' && sideType === 'single') pricePerPage = centre.pricing.bwSingle;
  else if (colorType === 'bw' && sideType === 'double') pricePerPage = centre.pricing.bwDouble;
  else if (colorType === 'color' && sideType === 'single') pricePerPage = centre.pricing.colorSingle;
  else pricePerPage = centre.pricing.colorDouble;

  const base = Number(pages) * Number(copies) * Number(pricePerPage);
  const watermarkCharge = watermarkEnabled ? Number(centre.pricing.watermarkCharge || 0) : 0;

  return {
    pricePerPage,
    watermarkCharge,
    totalAmount: base + watermarkCharge
  };
}
