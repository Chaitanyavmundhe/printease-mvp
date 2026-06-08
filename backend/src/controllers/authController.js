import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
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
  withTransaction,
  updateUserProfile,
  updateCentreProfile
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

function validateUsername(username) {
  if (!/^[a-z0-9]{3,32}$/.test(username)) {
    return 'Username must be 3-32 letters or numbers.';
  }

  return null;
}

function validatePassword(password) {
  if (password.length < 8 || password.length > 128) {
    return 'Password must be 8-128 characters.';
  }

  return null;
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

  const usernameError = validateUsername(username);
  if (usernameError) {
    return res.status(400).json({ success: false, message: usernameError });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ success: false, message: passwordError });
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

  const usernameError = validateUsername(username);
  if (usernameError) {
    return res.status(400).json({ success: false, message: usernameError });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ success: false, message: passwordError });
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

  if (password.length > 128) {
    return res.status(400).json({ success: false, message: 'Invalid username/email or password.' });
  }
  
  const normalizedId = identifier.toLowerCase();

  try {
    const attemptCheck = await pool.query(
      'SELECT attempt_count, locked_until FROM login_attempts WHERE identifier = $1',
      [normalizedId]
    );

    if (attemptCheck.rows.length > 0) {
      const { attempt_count, locked_until } = attemptCheck.rows[0];
      if (locked_until && new Date(locked_until) > new Date()) {
        return res.status(401).json({ success: false, message: 'Account temporarily locked due to too many failed attempts. Try again later.' });
      }
    }
  } catch (error) {
    console.error('Failed to check login attempts', error);
  }

  const user = await findUserByIdentifier(identifier);
  const isMatch = user && user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!isMatch) {
    try {
      await pool.query(
        `INSERT INTO login_attempts (identifier, attempt_count, last_attempt_at)
         VALUES ($1, 1, now())
         ON CONFLICT (identifier) DO UPDATE
         SET attempt_count = login_attempts.attempt_count + 1,
             locked_until = CASE WHEN login_attempts.attempt_count + 1 >= 5 THEN now() + interval '15 minutes' ELSE null END,
             last_attempt_at = now()`,
        [normalizedId]
      );
    } catch (error) {
      console.error('Failed to update login attempts', error);
    }

    return res.status(401).json({ success: false, message: 'Invalid username/email or password.' });
  }

  try {
    await pool.query('DELETE FROM login_attempts WHERE identifier = $1', [normalizedId]);
  } catch (error) {
    // Ignore cleanup errors
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

  const usernameError = validateUsername(username);
  if (usernameError) {
    return res.status(400).json({ success: false, message: usernameError });
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

export const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { name, username, displayHandle, mobile, hubName, centreCode } = req.body;

  if (username) {
    const existingUsernameUser = await findUserByUsername(username);
    if (existingUsernameUser && existingUsernameUser.id !== userId) {
      return res.status(400).json({ success: false, message: 'Username is already taken.' });
    }
  }

  const result = await withTransaction(async (client) => {
    const updatedUser = await updateUserProfile(userId, {
      name, username, displayHandle, mobile
    }, client);

    let updatedCentre = null;
    if (req.user.role === 'hub' && (hubName || centreCode)) {
      updatedCentre = await updateCentreProfile(userId, {
        hubName, centreCode
      }, client);
    }

    return { user: updatedUser, centre: updatedCentre };
  });

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    user: authUser(result.user, result.centre),
    centre: result.centre
  });
});
