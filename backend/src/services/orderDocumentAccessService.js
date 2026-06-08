export function assertCanUseDocumentForOrder({ user, document }) {
  if (!document) {
    const error = new Error('Uploaded document not found');
    error.statusCode = 404;
    throw error;
  }

  if (user?.role === 'admin') return;

  if (!user && !document.userId) return;

  if (user?.role === 'user' && document.userId === user.id) return;

  if (user && !document.userId) {
    const error = new Error('Guest uploaded documents cannot be attached to an order. Please upload again while logged in.');
    error.statusCode = 403;
    throw error;
  }

  const error = new Error('You are not allowed to use this uploaded document');
  error.statusCode = 403;
  throw error;
}
