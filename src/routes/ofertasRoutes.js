// routes/ofertas.js
import express from 'express';
import { batchInserir, getResumo, getDetalhe, lookupMembro, getHistoricoMembro } from '../controllers/ofertasController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/membros/lookup', authenticate, lookupMembro);
router.post('/ofertas/batch', authenticate, batchInserir);
router.get('/ofertas/resumo/:culto_id', authenticate, getResumo);
router.get('/ofertas/detalhe/:culto_id', authenticate, getDetalhe);
router.get('/ofertas/historico/:membro_id', authenticate, getHistoricoMembro);

export default router;