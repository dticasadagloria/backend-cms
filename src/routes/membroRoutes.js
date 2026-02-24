import express from 'express';
import {
  getAllMembrosHandler,
  getMembroByIdHandler,
  createMembroHandler,
  updateMembroHandler,
  deleteMembroHandler,
  deleteMembroHardHandler,
  reactivateMembroHandler
} from '../controllers/membroController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Todos os users autenticados podem ver
router.get('/', authenticate, getAllMembrosHandler);
router.get('/:id', authenticate, getMembroByIdHandler);

// Apenas Admin e Pastor podem criar/editar/deletar
router.post  ('/',    authenticate, requireRole(1, 2), createMembroHandler);
router.put   ('/:id', authenticate, requireRole(1, 2), updateMembroHandler);
router.delete('/:id/hard', authenticate, requireRole(1), deleteMembroHardHandler);

//Desativar/Ativar o estado do membro para ativo ou inativo
router.delete('/:id', authenticate, requireRole(1), deleteMembroHandler);
router.patch('/:id/reactivate', authenticate, requireRole(1), reactivateMembroHandler);

export default router;