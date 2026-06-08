/**
 * orderPricingPresenter.js
 * 
 * Responsible for formatting internal pricing breakdown objects into
 * safe, consistent metadata objects for the database and frontend.
 */

export function pricingMetadata(price) {
  return {
    physicalSheetCount: price.physicalSheetCount,
    chargeBy: price.chargeBy,
    pricePerPage: price.pricePerPage,
    pricePerSheet: price.pricePerSheet,
    watermarkFee: price.watermarkCharge,
    serviceFee: price.serviceFee,
    totalAmount: price.totalAmount,
    totalAmountPaise: price.totalAmountPaise
  };
}
