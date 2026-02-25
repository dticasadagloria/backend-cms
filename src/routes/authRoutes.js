import express from "express";
import { query } from "../config/db.js";
import jwt from "jsonwebtoken";
import {
  register,
  login,
  getMe,
  changePassword,
  getAllUsersHandler,
  updateUser,
  deleteUser,
} from "../controllers/authController.js";

import { authenticate, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// Rotas públicas
router.post("/register", register);
router.post("/login", login);

// Rotas protegidas (requerem token)
router.get("/me", authenticate, getMe);
router.put("/change-password", authenticate, changePassword);

// ─── ROTAS ADMIN (só role_id = 1) ────────────────────────────────────────────
router.get("/users", authenticate, requireRole(1), getAllUsersHandler);
router.put("/users/:id", authenticate, requireRole(1), updateUser);
router.delete("/users/:id", authenticate, requireRole(1), deleteUser);

router.post("/login-membro", async (req, res) => {
  try {
    const { codigo, data_nascimento } = req.body;

    if (!codigo || !data_nascimento) {
      return res
        .status(400)
        .json({ error: "Código e data de nascimento são obrigatórios." });
    }

    const result = await query(
      `SELECT 
    m.*,
    m.nome AS nome_membro,
    b.nome AS nome_branch,
    c.nome AS nome_celula
   FROM membros m
   LEFT JOIN branches b ON m.branch_id = b.id
   LEFT JOIN celulas c ON m.celula_id = c.id
   WHERE m.codigo = $1 AND DATE(m.data_nascimento) = $2`,
      [codigo.trim().toUpperCase(), data_nascimento],
    );

    if (result.rowCount === 0) {
      return res
        .status(401)
        .json({ error: "Código ou data de nascimento incorrectos." });
    }

    const membro = result.rows[0];

    const token = jwt.sign(
      { id: membro.id, codigo: membro.codigo, tipo: "membro" },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );

    res.json({ token, membro }); // ← garante que retorna o membro
  } catch (err) {
    console.error("login-membro error:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

export default router;
