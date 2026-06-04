import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  createCentre,
  createUser,
  findCentreByCode,
  findCentreForUser,
  findUserByEmail,
  findUserById,
  findUserByMobile,
  findUserByUsername,
  withTransaction
} from '../db/repository.js';
import { generateId } from '../utils/generateCode.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function createToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function publicUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function authUser(user, hub = null) {
  const safeUser = publicUser(user);
  const hubId = hub?.id || safeUser.hubId || safeUser.centreId || null;

  return {
    ...safeUser,
    role: safeUser.role,
    centreId: hubId,
    hubId,
    centreCode: hub?.centreCode || safeUser.centreCode || null,
    hubName: hub?.hubName || hub?.name || safeUser.hubName || null
  };
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isEmail(value) {
  return /^\S+@\S+\.\S+$/.test(String(value || '').trim());
}

async function signInWithSupabasePassword(email, password) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const error = new Error('Supabase email/password login is not configured on the backend.');
    error.status = 503;
    throw error;
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error_description || data.msg || data.message || 'Invalid username/email or password.');
    error.status = response.status;
    throw error;
  }

  return data;
}

export const registerUser = asyncHandler(async (req, res) => {
  const { name, mobile, password } = req.body;

  if (!name || !mobile || !password) {
    return res.status(400).json({ success: false, message: 'Name, mobile, and password are required' });
  }

  const exists = await findUserByMobile(mobile);
  if (exists) {
    return res.status(409).json({ success: false, message: 'Mobile number already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser({
    id: generateId(),
    name,
    mobile,
    passwordHash,
    role: 'user',
    createdAt: new Date().toISOString()
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    token: createToken(user),
    user: publicUser(user)
  });
});

export const registerCentre = asyncHandler(async (req, res) => {
  const {
    name,
    ownerName,
    mobile,
    password,
    hubName,
    centreName,
    centreCode,
    upiId
  } = req.body;
  const finalOwnerName = ownerName || name;
  const finalHubName = hubName || centreName;

  if (!finalOwnerName || !mobile || !password || !finalHubName || !centreCode) {
    return res.status(400).json({ success: false, message: 'Name, mobile, password, hub name, and centre code are required' });
  }

  console.log('[REGISTER HUB]', { mobile, hubName: finalHubName, centreCode });

  const exists = await findUserByMobile(mobile);
  if (exists) {
    return res.status(409).json({ success: false, message: 'Mobile number already registered' });
  }

  const codeExists = await findCentreByCode(centreCode);
  if (codeExists) {
    return res.status(409).json({ success: false, message: 'Centre code already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { owner, centre } = await withTransaction(async (client) => {
    const newOwner = await createUser({
      id: generateId(),
      name: finalOwnerName,
      mobile,
      passwordHash,
      role: 'hub',
      createdAt: new Date().toISOString()
    }, client);

    const newCentre = await createCentre({
      id: generateId(),
      hubName: finalHubName,
      name: finalHubName,
      ownerId: newOwner.id,
      centreCode,
      mobile,
      status: 'available',
      upiId: upiId || null,
      pricing: {
        bwSingle: 1,
        bwDouble: 1.5,
        colorSingle: 2,
        colorDouble: 3,
        watermarkCharge: 2
      },
      createdAt: new Date().toISOString()
    }, client);

    const ownerWithCentre = await findUserById(newOwner.id, client);

    return { owner: ownerWithCentre, centre: newCentre };
  });

  res.status(201).json({
    success: true,
    message: 'Print hub registered successfully',
    token: createToken(owner),
    user: authUser(owner, centre),
    centre
  });
});

export const login = asyncHandler(async (req, res) => {
  const { mobile, password } = req.body;

  if (!mobile || !password) {
    return res.status(400).json({ success: false, message: 'Mobile and password are required' });
  }

  const user = await findUserByMobile(mobile);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid mobile or password' });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid mobile or password' });
  }

  const centre = await findCentreForUser(user);

  res.json({
    success: true,
    message: 'Login successful',
    token: createToken(user),
    user: authUser(user, centre),
    centre
  });
});

export const supabasePasswordLogin = asyncHandler(async (req, res) => {
  const identifier = String(req.body.identifier || req.body.email || '').trim();
  const password = String(req.body.password || '');

  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: 'Username/email and password are required.' });
  }

  let email = identifier;

  if (!isEmail(identifier)) {
    const username = normalizeUsername(identifier);
    if (!username) {
      return res.status(400).json({ success: false, message: 'Enter a valid username or email.' });
    }

    const user = await findUserByUsername(username);
    if (!user?.email) {
      return res.status(401).json({ success: false, message: 'Invalid username/email or password.' });
    }
    email = user.email;
  }

  const session = await signInWithSupabasePassword(email, password);
  res.json({ success: true, session });
});

export const checkUsernameAvailability = asyncHandler(async (req, res) => {
  const username = normalizeUsername(req.query.username || req.params.username);

  if (!username) {
    return res.status(400).json({ success: false, message: 'Enter a username.' });
  }

  const existing = await findUserByUsername(username);
  res.json({ success: true, username, available: !existing });
});

export const me = asyncHandler(async (req, res) => {
  const centre = await findCentreForUser(req.user);
  res.json({ success: true, user: authUser(req.user, centre), centre });
});

export const completeSupabaseProfile = asyncHandler(async (req, res) => {
  const supabaseUser = req.supabaseUser;

  if (!supabaseUser) {
    return res.status(400).json({
      success: false,
      message: 'A verified Supabase session is required to complete profile.'
    });
  }

  const existingProfile = req.user || await findUserById(supabaseUser.id);
  const existingCentre = existingProfile ? await findCentreForUser(existingProfile) : null;

  if (existingProfile && (existingProfile.role !== 'hub' || existingCentre)) {
    return res.json({
      success: true,
      message: 'Profile already complete',
      user: authUser(existingProfile, existingCentre),
      centre: existingCentre
    });
  }

  const role = String(req.body.role || '').trim().toLowerCase();
  const name = String(req.body.name || '').trim();
  const username = normalizeUsername(req.body.username || req.body.displayHandle);
  const displayHandle = username;
  const mobile = String(req.body.mobile || '').trim() || null;
  const hubName = String(req.body.hubName || req.body.centreName || '').trim();
  const centreCode = String(req.body.centreCode || '').trim();
  const upiId = String(req.body.upiId || '').trim() || null;
  const email = supabaseUser.email || req.body.email || null;

  if (!['user', 'hub'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Choose User or Print Hub role.' });
  }

  if (!name) {
    return res.status(400).json({ success: false, message: 'Display name is required.' });
  }

  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }

  if (role === 'hub' && (!hubName || !centreCode)) {
    return res.status(400).json({ success: false, message: 'Hub name and centre code are required for print hubs.' });
  }

  const duplicateEmail = email ? await findUserByEmail(email) : null;
  if (!existingProfile && duplicateEmail && duplicateEmail.id !== supabaseUser.id) {
    return res.status(409).json({ success: false, message: 'A profile already exists for this email.' });
  }

  const duplicateUsername = await findUserByUsername(username);
  if (!existingProfile && duplicateUsername && duplicateUsername.id !== supabaseUser.id) {
    return res.status(409).json({ success: false, message: 'Username is already taken.' });
  }

  if (role === 'hub') {
    const codeExists = await findCentreByCode(centreCode);
    if (!existingCentre && codeExists) {
      return res.status(409).json({ success: false, message: 'Centre code already exists' });
    }
  }

  const result = await withTransaction(async (client) => {
    const profile = existingProfile || await createUser({
      id: supabaseUser.id,
      name,
      email,
      username,
      displayHandle,
      mobile,
      passwordHash: null,
      role,
      createdAt: new Date().toISOString()
    }, client);

    if (role !== 'hub') {
      return { user: profile, centre: null };
    }

    const centre = existingCentre || await createCentre({
      id: generateId(),
      hubName,
      name: hubName,
      ownerId: profile.id,
      centreCode,
      mobile: mobile || supabaseUser.phone || '',
      status: 'available',
      upiId,
      pricing: {
        bwSingle: 1,
        bwDouble: 1.5,
        colorSingle: 2,
        colorDouble: 3,
        watermarkCharge: 2
      },
      createdAt: new Date().toISOString()
    }, client);

    const userWithCentre = await findUserById(profile.id, client);
    return { user: userWithCentre, centre };
  });

  res.status(existingProfile ? 200 : 201).json({
    success: true,
    message: 'Profile complete',
    user: authUser(result.user, result.centre),
    centre: result.centre
  });
});
