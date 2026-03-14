import express from "express";
import { listarDepartamentos, totalDepartamentos } from "../controllers/departamentosController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/",  listarDepartamentos);
router.get("/stats",  authenticate, totalDepartamentos);

export default router;