export const GUEST_PRINT_LIMIT_CODE = 'LOGIN_REQUIRED_FOR_MORE_THAN_5_PAGES';

export function getGuestPrintPageLimit() {
  const configuredLimit = Number(process.env.GUEST_PRINT_PAGE_LIMIT);
  return Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 5;
}

export function isGuestUser(user) {
  return !user;
}

export function getPrintablePageCountFromPricedFiles(pricedFiles) {
  return pricedFiles.reduce((sum, file) => sum + Number(file.price?.printablePageCount || 0), 0);
}

export function assertGuestPrintLimit({ user, pricedFiles }) {
  if (!isGuestUser(user)) return;

  const limit = getGuestPrintPageLimit();
  const requestedPages = getPrintablePageCountFromPricedFiles(pricedFiles);

  if (requestedPages > limit) {
    const error = new Error(`Guest users can print up to ${limit} pages only. Please login to print larger documents.`);
    error.statusCode = 403;
    error.code = GUEST_PRINT_LIMIT_CODE;
    error.limit = limit;
    error.requestedPages = requestedPages;
    throw error;
  }
}
