import express from "express";
import { authenticate, requireRole } from "../middleware/authMiddleware.js";
import { listarLogs, exportarLogsPDF } from "../controllers/logsController.js";

const router = express.Router();

// Admin (1) e Pastor (2) veem logs de todas as filiais (supers).
// Gerente/Sede/Maxixe/Albazine (8, 12, 13, 14) veem só logs da própria filial —
// filtro aplicado dentro de listarLogs/exportarLogsPDF (isAdmin = 1 ou 2 só).
router.get("/",              authenticate, requireRole(1, 2, 8, 12, 13, 14), listarLogs);
router.get("/exportar/pdf",  authenticate, requireRole(1, 2, 8, 12, 13, 14), exportarLogsPDF);

export default router;
