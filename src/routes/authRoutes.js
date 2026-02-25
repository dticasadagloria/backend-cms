import express from 'express';
import { query } from '../config/db.js'; 
import jwt from 'jsonwebtoken';
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
router.put('/change-password', authenticate, changePassword);

// ─── ROTAS ADMIN (só role_id = 1) ────────────────────────────────────────────
router.get('/users', authenticate, requireRole(1), getAllUsersHandler);
router.put('/users/:id', authenticate, requireRole(1), updateUser);
router.delete('/users/:id', authenticate, requireRole(1), deleteUser);

router.post('/login-membro', async (req, res) => {
  const { codigo, data_nascimento } = req.body;
  
  const membro = await query(
    'SELECT * FROM membros WHERE codigo = $1 AND data_nascimento = $2',
    [codigo, data_nascimento]
  );

  if (!membro) return res.status(401).json({ error: 'Código ou data de nascimento incorrectos' });

  const token = jwt.sign(
    { id: membro.id, codigo: membro.codigo, tipo: 'membro' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token });
});


export default router;