import express from "express";
import multer from "multer";
import {
  criarRequisicao,
  listarRequisicoes,
  obterRequisicao,
  actualizarStatus,
  uploadComprovativo,
  relatorios,
  apagarRequisicao,
  criarRequisicaoPublica
} from "../controllers/requisicoesController.js";
import { authenticate, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// Guarda o ficheiro em memória — o controller faz o upload directo ao Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    cb(null, allowed.includes(file.mimetype));
  },
});

const ADMIN  = 1;
const PASTOR = 2;

// ── Rotas fixas (sem parâmetros) ─────────────────────────────────────────────
router.post("/publica",   criarRequisicaoPublica);
router.get("/relatorios", authenticate, requireRole(ADMIN, PASTOR), relatorios);
router.get("/",           authenticate, listarRequisicoes);
router.post("/",          authenticate, criarRequisicao);

// ── Rotas com parâmetro :id (sempre por último) ───────────────────────────────
router.get("/:id",               authenticate, obterRequisicao);
router.patch("/:id/status",      authenticate, requireRole(ADMIN, PASTOR), actualizarStatus);
router.post("/:id/comprovativo", authenticate, upload.single("ficheiro"), uploadComprovativo);
router.delete("/:id",            authenticate, requireRole(ADMIN), apagarRequisicao);

export default router;