import express from 'express';
import {
  checkUsernameAvailability,
  completeSupabaseProfile,
  login,
  me,
  registerCentre,
  registerUser,
  supabasePasswordLogin,
  updateProfile
} from '../controllers/authController.js';
import { authMiddleware, supabaseSessionMiddleware } from '../middleware/authMiddleware.js';
import { authRateLimit, usernameLookupRateLimit } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.post('/register-user', authRateLimit, registerUser);
router.post('/register-hub', authRateLimit, registerCentre);
router.post('/register-centre', authRateLimit, registerCentre);
router.post('/login', authRateLimit, login);
router.post('/password-login', authRateLimit, supabasePasswordLogin);
router.get('/username-available', usernameLookupRateLimit, checkUsernameAvailability);
router.post('/profile', supabaseSessionMiddleware, completeSupabaseProfile);
router.put('/profile', authMiddleware, updateProfile);
router.get('/me', authMiddleware, me);

export default router;
