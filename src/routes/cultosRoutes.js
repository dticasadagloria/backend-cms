import express from "express";
import {
  criarCulto,
  listarCultos,
  obterCulto,
  apagarCulto,
  salvarPresencas,
  obterPresencas,
  importarCSV,
  estatisticasGerais, presencasPorMes, presencasPorCulto,
  maisAssiduos, maisFaltas, melhorCulto, actualizarCulto 
} from "../controllers/cultosController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ── Rotas fixas PRIMEIRO (antes de qualquer /:id) ────────────────────────
router.get("/",                                authenticate, listarCultos);
router.post("/",                               authenticate, criarCulto);

// Estatísticas gerais dos cultos
router.get("/stats/gerais",        authenticate, estatisticasGerais);
router.get("/stats/por-mes",       authenticate, presencasPorMes);
router.get("/stats/por-culto",     authenticate, presencasPorCulto);

// Estatísticas de membros
router.get("/stats/mais-assiduos", authenticate, maisAssiduos);
router.get("/stats/mais-faltas",   authenticate, maisFaltas);
router.get("/stats/melhor-culto",  authenticate, melhorCulto);

// ── Rotas com parâmetro dinâmico /:id POR ÚLTIMO ─────────────────────────
router.get("/:id/presencas",                   authenticate, obterPresencas);
router.post("/:id/presencas",                  authenticate, salvarPresencas);
router.post("/:id/importar", authenticate, upload.single("ficheiro"), importarCSV);

router.get("/:id",                             authenticate, obterCulto);
router.delete("/:id",                          authenticate, apagarCulto);
router.put("/:id", authenticate, actualizarCulto);

export default router;