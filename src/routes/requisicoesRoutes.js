import express from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";
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

// Cloudinary storage para comprovativos
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          "iicgp/comprovativos",
    allowed_formats: ["jpg", "jpeg", "png", "pdf"],
    resource_type:   "auto",
    type:            "upload",
  },
});
const upload = multer({ storage });

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