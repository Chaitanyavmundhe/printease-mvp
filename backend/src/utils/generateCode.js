import { randomUUID } from 'crypto';

export function generateId() {
  return randomUUID();
}

export function generateShortCode(length = 4) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(Math.floor(min + Math.random() * (max - min)));
}

export function generateOrderCode(centreCode) {
  return `PRN-${centreCode}-${generateShortCode(4)}`;
}
