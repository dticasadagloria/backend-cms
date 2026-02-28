import express from "express";
import {
  registarVisitante,
  listarVisitantes,
  visitantesPorCulto,
  apagarVisitante,
  converterEmMembro,
  relatorioMensal,
} from "../controllers/visitantesController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/",                    authenticate, registarVisitante);
router.get("/",                     authenticate, listarVisitantes);
router.get("/relatorio",            authenticate, relatorioMensal);
router.get("/culto/:culto_id",      authenticate, visitantesPorCulto);
router.delete("/:id",               authenticate, apagarVisitante);
router.post("/:id/converter",       authenticate, converterEmMembro);

export default router;