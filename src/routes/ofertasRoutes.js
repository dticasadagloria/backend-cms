// routes/ofertas.js
const express = require('express');
const router = express.Router();
const {
  batchInserir,
  getResumo,
  getDetalhe,
  lookupMembro,
  getHistoricoMembro,
} = require('../controllers/ofertasController');

// Middleware de autenticação (adapta ao teu sistema)
const { requireAuth } = require('../middleware/auth');

// ─── Membros ──────────────────────────────────────────────────────────────────
// GET /api/membros/lookup?codigo=M-00042
router.get('/membros/lookup', requireAuth, lookupMembro);

// ─── Ofertas ──────────────────────────────────────────────────────────────────
// POST /api/ofertas/batch
router.post('/ofertas/batch', requireAuth, batchInserir);

// GET /api/ofertas/resumo/:culto_id
router.get('/ofertas/resumo/:culto_id', requireAuth, getResumo);

// GET /api/ofertas/detalhe/:culto_id?tipo=Dizimo
router.get('/ofertas/detalhe/:culto_id', requireAuth, getDetalhe);

// GET /api/ofertas/historico/:membro_id?tipo=Dizimo&ano=2025
router.get('/ofertas/historico/:membro_id', requireAuth, getHistoricoMembro);

module.exports = router;