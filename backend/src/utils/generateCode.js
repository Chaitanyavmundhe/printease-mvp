import { randomUUID, randomInt } from 'crypto';

export function generateId() {
  return randomUUID();
}

export function generateShortCode(length = 4) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(randomInt(min, max + 1));
}

export function generateOrderCode(centreCode) {
  return `PRN-${centreCode}-${generateShortCode(4)}`;
}
