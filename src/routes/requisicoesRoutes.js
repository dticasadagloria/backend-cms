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
} from "../controllers/requisicoesController.js";
import { authenticate, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// Cloudinary storage para comprovativos
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         "iicgp/comprovativos",
    allowed_formats: ["jpg", "jpeg", "png", "pdf"],
    resource_type:  "auto",
  },
});
const upload = multer({ storage });

const ADMIN  = 1;
const PASTOR = 2;

router.get("/",                    authenticate, listarRequisicoes);
router.get("/relatorios",          authenticate, requireRole(ADMIN, PASTOR), relatorios);
router.get("/:id",                 authenticate, obterRequisicao);
router.post("/",                   authenticate, criarRequisicao);
router.patch("/:id/status",        authenticate, requireRole(ADMIN, PASTOR), actualizarStatus);
router.post("/:id/comprovativo",   authenticate, upload.single("ficheiro"), uploadComprovativo);
router.delete("/:id",              authenticate, requireRole(ADMIN), apagarRequisicao);

export default router;