import express from 'express';
import {
  getAllCriancasHandler,
  getCriancaByIdHandler,
  createCriancaHandler,
  updateCriancaHandler,
  deactivateCriancaHandler,
  listarAulasHandler,
  obterAulaHandler,
  criarAulaHandler,
  getPresencasHandler,
  markPresencaHandler,
  markPresencasLoteHandler,
  getHistoricoHandler,
  getStatsHandler,
} from '../controllers/criancaController.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// ─── AULAS (definir ANTES de /:id para não colidir) ──────────────────────────
router.get('/aulas',      authenticate, listarAulasHandler);
router.get('/aulas/:id',  authenticate, obterAulaHandler);
router.post('/aulas',     authenticate, requireRole(1, 2, 5), criarAulaHandler);

// ─── PRESENÇAS ────────────────────────────────────────────────────────────────
router.get('/presencas/dia',   authenticate, getPresencasHandler);                       // ?aula_id=
router.post('/presencas',      authenticate, requireRole(1, 2, 5), markPresencaHandler);      // 1 registo
router.post('/presencas/lote', authenticate, requireRole(1, 2, 5), markPresencasLoteHandler); // chamada toda

// ─── CRIANÇAS ─────────────────────────────────────────────────────────────────
router.get('/stats',         authenticate, getStatsHandler);
router.get('/',               authenticate, getAllCriancasHandler);
router.get('/:id',            authenticate, getCriancaByIdHandler);
router.get('/:id/historico',  authenticate, getHistoricoHandler);

router.post('/',   authenticate, requireRole(1, 2, 5), createCriancaHandler);
router.put('/:id', authenticate, requireRole(1, 2, 5), updateCriancaHandler);
router.patch('/:id/deactivate', authenticate, requireRole(1), deactivateCriancaHandler);

export default router;
