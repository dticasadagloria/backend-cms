import express from 'express';
import {
  getAllCriancasHandler,
  getCriancaByIdHandler,
  createCriancaHandler,
  updateCriancaHandler,
  deactivateCriancaHandler,
  getPresencasHandler,
  markPresencaHandler,
  markPresencasLoteHandler,
  getHistoricoHandler,
  getStatsHandler,
} from '../controllers/criancaController.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// ─── PRESENÇAS (definir ANTES de /:id para não colidir) ──────────────────────
router.get('/presencas/dia',   authenticate, getPresencasHandler);          // ?data=&turma=
router.post('/presencas',      authenticate, markPresencaHandler);          // 1 registo
router.post('/presencas/lote', authenticate, markPresencasLoteHandler);     // chamada toda

// ─── CRIANÇAS ─────────────────────────────────────────────────────────────────
router.get('/stats',         authenticate, getStatsHandler);
router.get('/',               authenticate, getAllCriancasHandler);
router.get('/:id',            authenticate, getCriancaByIdHandler);
router.get('/:id/historico',  authenticate, getHistoricoHandler);

router.post('/',   authenticate, requireRole(1, 2), createCriancaHandler);
router.put('/:id', authenticate, requireRole(1, 2), updateCriancaHandler);
router.patch('/:id/deactivate', authenticate, requireRole(1), deactivateCriancaHandler);

export default router;
