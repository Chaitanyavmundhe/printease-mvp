import jwt from 'jsonwebtoken';
import { findUserById } from '../db/repository.js';

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization token missing' });
  }

  let decoded;

  try {
    const token = header.split(' ')[1];
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  try {
    const user = await findUserById(decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid user token' });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuthMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next();
    return;
  }

  let decoded;

  try {
    const token = header.split(' ')[1];
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  try {
    req.user = await findUserById(decoded.id);

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Invalid user token' });
    }

    next();
  } catch (error) {
    next(error);
  }
}
