import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  createCentre,
  createUser,
  findCentreByCode,
  findCentreForUser,
  findUserById,
  findUserByMobile,
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

export const me = asyncHandler(async (req, res) => {
  const centre = await findCentreForUser(req.user);
  res.json({ success: true, user: authUser(req.user, centre), centre });
});
