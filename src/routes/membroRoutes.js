import express from "express";
import {
  getAllMembrosHandler,
  getMembroByIdHandler,
  createMembroHandler,
  updateMembroHandler,
  deleteMembroHandler,
  deleteMembroHardHandler,
  reactivateMembroHandler,
  membrosSemCelula,
} from "../controllers/membroController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/authMiddleware.js";
import { lookupMembro } from "../controllers/ofertasController.js";
import { query } from "../config/db.js";
import { inactivosTemplate } from "../templates/inactivosTemplate.js";

const router = express.Router();

// Todos os users autenticados podem ver
router.get("/", authenticate, getAllMembrosHandler);
router.get("/lista/sem-celula", authenticate, membrosSemCelula);
router.get("/lookup", authenticate, lookupMembro); 
router.get("/:id", authenticate, getMembroByIdHandler);

// Apenas Admin e Pastor podem criar/editar/deletar
router.post("/", authenticate, requireRole(1, 2), createMembroHandler);
router.put("/:id", authenticate, requireRole(1, 2), updateMembroHandler);
router.delete(
  "/:id/hard",
  authenticate,
  requireRole(1),
  deleteMembroHardHandler,
);

//Desativar/Ativar o estado do membro para ativo ou inativo
router.delete("/:id", authenticate, requireRole(1), deleteMembroHandler);
router.patch(
  "/:id/reactivate",
  authenticate,
  requireRole(1),
  reactivateMembroHandler,
);

// ── Exportar SOS Inactivos PDF ────────────────────────────────────────────────
router.get("/exportar/inactivos/pdf", authenticate, async (req, res) => {
  const { username, role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;

  try {
    const membrosResult = await query(
      `
      SELECT
        m.nome    AS nome_membro,
        m.contacto,
        b.nome    AS nome_branch
      FROM membros m
      LEFT JOIN branches b ON m.branch_id = b.id
      WHERE m.ativo = false
        ${!isAdmin ? "AND m.branch_id = $1" : ""}
      ORDER BY b.nome ASC, m.nome ASC
      `,
      isAdmin ? [] : [branch_id],
    );

    const statsResult = await query(
      `
      SELECT
        COUNT(*)                                        AS total,
        COUNT(CASE WHEN ativo = true  THEN 1 END)       AS ativos,
        COUNT(CASE WHEN ativo = false THEN 1 END)       AS inativos
      FROM membros
      ${!isAdmin ? "WHERE branch_id = $1" : ""}
      `,
      isAdmin ? [] : [branch_id],
    );

    const s = statsResult.rows[0];
    const dataGeracao = new Date().toLocaleDateString("pt-MZ", {
      day: "2-digit", month: "long", year: "numeric",
    });

    const html = inactivosTemplate(membrosResult.rows, {
      username,
      dataGeracao,
      total:    parseInt(s.total),
      ativos:   parseInt(s.ativos),
      inativos: parseInt(s.inativos),
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("inactivos pdf error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Exportar Call Center PDF ──────────────────────────────────────────────────
router.get("/exportar/call-center/pdf", authenticate, async (req, res) => {
  const { username, role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;

  try {
    const result = await query(
      `
      SELECT
        m.nome AS nome_membro,
        m.contacto,
        b.nome AS nome_branch
      FROM membros m
      LEFT JOIN branches b ON m.branch_id = b.id
      LEFT JOIN celulas  c ON m.celula_id = c.id
      WHERE m.ativo = true
        AND m.celula_id IS NULL
        ${!isAdmin ? "AND m.branch_id = $1" : ""}
      ORDER BY b.nome ASC, m.nome ASC
      `,
      isAdmin ? [] : [branch_id],
    );

    const membros = result.rows;
    const total = membros.length;
    const dataGeracao = new Date().toLocaleDateString("pt-MZ", {
      day: "2-digit", month: "long", year: "numeric",
    });

    const linhas = membros
      .map(
        (m, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${m.nome_membro || "—"}</td>
          <td>${m.nome_branch || "—"}</td>
          <td>${m.contacto || "—"}</td>
        </tr>`,
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Call Center — Membros Sem Célula</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 30px; }
          .header { text-align: center; margin-bottom: 28px; border-bottom: 2px solid #b6852e; padding-bottom: 16px; }
          .header img { width: 90px; height: auto; display: block; margin: 0 auto 10px; }
          .header h1 { font-size: 17px; color: #1e293b; font-weight: bold; }
          .header h2 { font-size: 13px; color: #b6852e; font-weight: 600; margin-top: 4px; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 18px; font-size: 10px; color: #64748b; }
          .summary { display: flex; gap: 14px; margin-bottom: 22px; }
          .summary-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
          .summary-card .value { font-size: 26px; font-weight: bold; color: #b6852e; }
          .summary-card .label { font-size: 10px; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.05em; }
          .section-title { font-size: 12px; font-weight: bold; color: #1e293b; margin: 0 0 10px; border-left: 3px solid #b6852e; padding-left: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
          table { width: 100%; border-collapse: collapse; }
          thead th { background: #fef3c7; color: #92400e; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 8px 10px; text-align: left; }
          tbody td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
          tbody tr:last-child td { border-bottom: none; }
          tbody tr:nth-child(even) { background: #fafafa; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px; }
          @media print { body { padding: 15px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="https://casadagloria-cms.vercel.app/Logo1.png" alt="Logo IICGP" />
          <h1>Igreja Internacional Casa da Glória da Palavra</h1>
          <h2>Call Center — Membros Sem Célula</h2>
        </div>

        <div class="meta">
          <span>Gerado por: <strong>${username}</strong></span>
          <span>Data: <strong>${dataGeracao}</strong></span>
          <span>Total de registos: <strong>${total}</strong></span>
        </div>

        <div class="summary">
          <div class="summary-card">
            <div class="value">${total}</div>
            <div class="label">Membros Sem Célula</div>
          </div>
        </div>

        <div class="section-title">Lista de Membros para Contactar</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Nome</th>
              <th>Filial</th>
              <th>Contacto</th>
            </tr>
          </thead>
          <tbody>
            ${linhas || '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:20px;">Sem registos</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          Sistema de Gestão IICGP &middot; Call Center &middot; Gerado em ${dataGeracao}
        </div>
      </body>
      </html>
    `;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("call-center pdf error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
