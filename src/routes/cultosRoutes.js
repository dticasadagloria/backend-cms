import express from "express";
import {
  criarCulto,
  listarCultos,
  obterCulto,
  apagarCulto,
  salvarPresencas,
  obterPresencas,
  importarCSV,
} from "../controllers/cultosController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/",                          verifyToken, criarCulto);
router.get("/",                           verifyToken, listarCultos);
router.get("/:id",                        verifyToken, obterCulto);
router.delete("/:id",                     verifyToken, apagarCulto);
router.post("/:id/presencas",             verifyToken, salvarPresencas);
router.get("/:id/presencas",              verifyToken, obterPresencas);
router.post("/:id/importar",              verifyToken, upload.single("ficheiro"), importarCSV);

export default router;