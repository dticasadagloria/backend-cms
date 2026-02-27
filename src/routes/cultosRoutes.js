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
  maisAssiduos, maisFaltas, melhorCulto 
} from "../controllers/cultosController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Rotas mais específicas PRIMEIRO
router.get("/",                                authenticate, listarCultos);
router.post("/",                               authenticate, criarCulto);

router.get("/:id/presencas",                   authenticate, obterPresencas);
router.post("/:id/presencas",                  authenticate, salvarPresencas);
router.post("/:id/importar", authenticate, upload.single("ficheiro"), importarCSV);

// Rotas genéricas POR ÚLTIMO
router.get("/:id",                             authenticate, obterCulto);
router.delete("/:id",                          authenticate, apagarCulto);


// Estatisticas gerais dos cultos
router.get("/stats/gerais",        authenticate, estatisticasGerais);
router.get("/stats/por-mes",       authenticate, presencasPorMes);
router.get("/stats/por-culto",     authenticate, presencasPorCulto);

// Estatisticas de membros
router.get("/stats/mais-assiduos", authenticate, maisAssiduos);
router.get("/stats/mais-faltas",   authenticate, maisFaltas);
router.get("/stats/melhor-culto",  authenticate, melhorCulto);

export default router;