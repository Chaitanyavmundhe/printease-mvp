import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  createCentre,
  createUser,
  findCentreByCode,
  findCentreForUser,
  findUserByMobile,
  updateUserCentreId,
  withTransaction
} from '../db/repository.js';
import { generateId, generateShortCode } from '../utils/generateCode.js';
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
    id: generateId('user'),
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
  const { ownerName, mobile, password, centreName, centreCode, upiId } = req.body;

  if (!ownerName || !mobile || !password || !centreName) {
    return res.status(400).json({ success: false, message: 'Owner name, mobile, password, and centre name are required' });
  }

  const exists = await findUserByMobile(mobile);
  if (exists) {
    return res.status(409).json({ success: false, message: 'Mobile number already registered' });
  }

  const finalCentreCode = centreCode || generateShortCode(4);
  const codeExists = await findCentreByCode(finalCentreCode);
  if (codeExists) {
    return res.status(409).json({ success: false, message: 'Centre code already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { owner, centre } = await withTransaction(async (client) => {
    const newOwner = await createUser({
      id: generateId('hub-owner'),
      name: ownerName,
      mobile,
      passwordHash,
        role: 'hub',
      createdAt: new Date().toISOString()
    }, client);

    const newCentre = await createCentre({
      id: generateId('centre'),
      name: centreName,
      ownerId: newOwner.id,
      centreCode: finalCentreCode,
      mobile,
      status: 'available',
      upiId: upiId || '',
      pricing: {
        bwSingle: 1,
        bwDouble: 1.5,
        colorSingle: 2,
        colorDouble: 3,
        watermarkCharge: 2
      },
      createdAt: new Date().toISOString()
    }, client);

    const ownerWithCentre = await updateUserCentreId(newOwner.id, newCentre.id, client);

    return { owner: ownerWithCentre, centre: newCentre };
  });

  res.status(201).json({
    success: true,
    message: 'Print centre registered successfully',
    token: createToken(owner),
    user: publicUser(owner),
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

  res.json({
    success: true,
    message: 'Login successful',
    token: createToken(user),
    user: publicUser(user),
    centre: await findCentreForUser(user)
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: publicUser(req.user), centre: await findCentreForUser(req.user) });
});
