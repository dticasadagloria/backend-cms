import express from 'express';
import {
  register,
  login,
  getMe,
  changePassword,
  getAllUsersHandler,
  updateUser,
  deleteUser,
} from '../controllers/authController.js';

import { authenticate, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Rotas públicas
router.post('/register', register);
router.post('/login', login);

// Rotas protegidas (requerem token)
router.get('/me', authenticate, getMe);
router.put ('/change-password', authenticate, changePassword);

// ─── ROTAS ADMIN (só role_id = 1) ────────────────────────────────────────────
router.get   ('/users',                  authenticate, requireRole(1), getAllUsersHandler);
router.put   ('/users/:id',              authenticate, requireRole(1), updateUser);
router.delete('/users/:id',              authenticate, requireRole(1), deleteUser);


export default router;