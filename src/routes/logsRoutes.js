import express from "express";
import { authenticate, requireRole } from "../middleware/authMiddleware.js";
import { listarLogs } from "../controllers/logsController.js";

const router = express.Router();

// Só Admin (1) e Pastor (2) podem ver os logs
router.get("/", authenticate, requireRole(1, 2), listarLogs);

export default router;
