import express from 'express';
import { checkUsernameAvailability, completeSupabaseProfile, me, supabasePasswordLogin } from '../controllers/authController.js';
import { authMiddleware, supabaseSessionMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

function legacyPasswordAuthDisabled(_req, res) {
  res.status(410).json({
    success: false,
    message: 'Password auth now uses Supabase email/password or Google. Complete profile through /api/auth/profile.'
  });
}

router.post('/register-user', legacyPasswordAuthDisabled);
router.post('/register-hub', legacyPasswordAuthDisabled);
router.post('/register-centre', legacyPasswordAuthDisabled);
router.post('/login', legacyPasswordAuthDisabled);
router.post('/password-login', supabasePasswordLogin);
router.get('/username-available', checkUsernameAvailability);
router.post('/profile', supabaseSessionMiddleware, completeSupabaseProfile);
router.get('/me', authMiddleware, me);

export default router;
