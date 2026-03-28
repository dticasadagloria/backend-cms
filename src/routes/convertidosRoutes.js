import express from "express";
import {
  registarConvertido,
  listarConvertidos,
  apagarConvertido,
  statsConvertidos,
} from "../controllers/convertidosController.js";
import { authenticate, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/",        authenticate, listarConvertidos);
router.get("/stats",   authenticate, statsConvertidos);
router.post("/",       authenticate, registarConvertido);
router.delete("/:id",  authenticate, requireRole(1, 2), apagarConvertido);

export default router;