import express from 'express';
import { login, me, registerCentre, registerUser } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register-user', registerUser);
router.post('/register-hub', registerCentre);
router.post('/register-centre', registerCentre);
router.post('/login', login);
router.get('/me', authMiddleware, me);

export default router;
