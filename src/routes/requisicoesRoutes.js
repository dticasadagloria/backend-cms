import express from "express";
import multer from "multer";
import path from "path";
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
  const allowedMimes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
  const allowedExts  = [".jpg", ".jpeg", ".png", ".pdf"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de ficheiro não permitido: ${file.mimetype}`));
  }
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