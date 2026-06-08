import jwt from 'jsonwebtoken';
import { findUserById } from '../db/repository.js';
import { getSupabaseAdminClient } from '../config/supabase.js';

function getBearerToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.split(' ')[1];
  }
  if (req.query.authToken) {
    return req.query.authToken;
  }
  return null;
}

async function findLegacyJwtUser(token) {
  if (!process.env.JWT_SECRET) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return findUserById(decoded.id);
  } catch (error) {
    return null;
  }
}

async function getSupabaseSessionUser(token) {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch (error) {
    return null;
  }
}

async function resolveUserFromBearer(token) {
  if (!token || token.length < 20 || token.length > 4096) return null;

  const legacyUser = await findLegacyJwtUser(token);
  if (legacyUser) return { user: legacyUser, supabaseUser: null, profileRequired: false };

  const supabaseUser = await getSupabaseSessionUser(token);
  if (!supabaseUser) return null;

  const profileUser = await findUserById(supabaseUser.id);
  return {
    user: profileUser,
    supabaseUser,
    profileRequired: !profileUser
  };
}

export async function authMiddleware(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authorization token missing' });
  }

  try {
    const resolved = await resolveUserFromBearer(token);

    if (!resolved) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    if (resolved.profileRequired) {
      return res.status(428).json({
        success: false,
        profileRequired: true,
        message: 'Complete your PrintEase profile before using this route'
      });
    }

    req.user = resolved.user;
    req.supabaseUser = resolved.supabaseUser;
    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuthMiddleware(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    const resolved = await resolveUserFromBearer(token);

    if (!resolved) {
      req.authWarning = 'Invalid or expired optional token ignored';
      next();
      return;
    }

    req.user = resolved.user || null;
    req.supabaseUser = resolved.supabaseUser || null;
    next();
  } catch (error) {
    next(error);
  }
}

export async function supabaseSessionMiddleware(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authorization token missing' });
  }

  try {
    const supabaseUser = await getSupabaseSessionUser(token);
    if (!supabaseUser) {
      const legacyUser = await findLegacyJwtUser(token);
      if (legacyUser) {
        req.user = legacyUser;
        req.supabaseUser = null;
        next();
        return;
      }

      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    req.supabaseUser = supabaseUser;
    req.user = await findUserById(supabaseUser.id);
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}
