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

async function findUserByIdentifier(identifier) {
  if (isEmail(identifier)) return findUserByEmail(identifier);
  return findUserByUsername(normalizeUsername(identifier));
}

export const registerUser = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim() || null;
  const username = normalizeUsername(req.body.username || req.body.displayHandle);
  const mobile = String(req.body.mobile || '').trim() || null;
  const password = String(req.body.password || '');

  if (!name || !username || !password) {
    return res.status(400).json({ success: false, message: 'Name, username, and password are required.' });
  }

  if (email && !isEmail(email)) {
    return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  }

  const usernameExists = await findUserByUsername(username);
  if (usernameExists) {
    return res.status(409).json({ success: false, message: 'Username is already taken.' });
  }

  const emailExists = email ? await findUserByEmail(email) : null;
  if (emailExists) {
    return res.status(409).json({ success: false, message: 'Email is already registered.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser({
    id: generateId(),
    name,
    email,
    username,
    displayHandle: username,
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
    hubName,
    centreName,
    centreCode,
    upiId
  } = req.body;
  const finalOwnerName = ownerName || name;
  const finalHubName = hubName || centreName;
  const email = String(req.body.email || '').trim() || null;
  const username = normalizeUsername(req.body.username || req.body.displayHandle);
  const mobile = String(req.body.mobile || '').trim() || null;
  const password = String(req.body.password || '');

  if (!finalOwnerName || !username || !password || !finalHubName || !centreCode) {
    return res.status(400).json({ success: false, message: 'Name, username, password, hub name, and centre code are required.' });
  }

  if (email && !isEmail(email)) {
    return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  }

  const usernameExists = await findUserByUsername(username);
  if (usernameExists) {
    return res.status(409).json({ success: false, message: 'Username is already taken.' });
  }

  const emailExists = email ? await findUserByEmail(email) : null;
  if (emailExists) {
    return res.status(409).json({ success: false, message: 'Email is already registered.' });
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
      email,
      username,
      displayHandle: username,
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
      mobile: mobile || '',
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

async function loginWithPassword(req, res) {
  const identifier = String(req.body.identifier || req.body.email || req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: 'Username/email and password are required.' });
  }

  const user = await findUserByIdentifier(identifier);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid username/email or password.' });
  }

  const isMatch = user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid username/email or password.' });
  }

  const centre = await findCentreForUser(user);

  res.json({
    success: true,
    message: 'Login successful',
    token: createToken(user),
    user: authUser(user, centre),
    centre
  });
}

export const login = asyncHandler(loginWithPassword);

export const supabasePasswordLogin = asyncHandler(loginWithPassword);

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
