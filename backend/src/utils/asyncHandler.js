export const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve().then(() => fn(req, res, next)).catch(next);
};
