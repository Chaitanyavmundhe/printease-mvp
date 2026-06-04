import express from 'express';
import {
  checkUsernameAvailability,
  completeSupabaseProfile,
  login,
  me,
  registerCentre,
  registerUser,
  supabasePasswordLogin
} from '../controllers/authController.js';
import { authMiddleware, supabaseSessionMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register-user', registerUser);
router.post('/register-hub', registerCentre);
router.post('/register-centre', registerCentre);
router.post('/login', login);
router.post('/password-login', supabasePasswordLogin);
router.get('/username-available', checkUsernameAvailability);
router.post('/profile', supabaseSessionMiddleware, completeSupabaseProfile);
router.get('/me', authMiddleware, me);

export default router;
