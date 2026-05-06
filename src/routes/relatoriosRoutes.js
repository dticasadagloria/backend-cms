import express from "express";
import { query } from "../config/db.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { gerarPresencasHTML } from "../templates/presencasTemplate.js";
import { gerarFichaOfertasHTML } from "../templates/fichaOfertas.js";

const router = express.Router();

// ── Dados do relatório ────────────────────────────────────────────────────────
router.get("/presencas", authenticate, async (req, res) => {
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;
  const { culto_id, mes } = req.query;

  try {
    let conditions = isAdmin ? [] : [`c.branch_id = $1`];
    let params = isAdmin ? [] : [branch_id];
    let idx = params.length + 1;

    if (culto_id) {
      conditions.push(`c.id = $${idx++}`);
      params.push(culto_id);
    }
    if (mes) {
      conditions.push(`TO_CHAR(c.data, 'YYYY-MM') = $${idx++}`);
      params.push(mes);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    // Cultos com stats
    const cultos = await query(
      `
      SELECT
        c.id, c.tipo, c.data, c.horario,
        TO_CHAR(c.data, 'DD/MM/YYYY') as data_formatada,
        b.nome as nome_branch,
        COUNT(CASE WHEN f.presente = true  THEN 1 END) as presentes,
        COUNT(CASE WHEN f.presente = false THEN 1 END) as ausentes,
        COUNT(f.id)                                    as total_membros,
        ROUND(COUNT(CASE WHEN f.presente = true THEN 1 END)::numeric / NULLIF(COUNT(f.id), 0) * 100, 1) as taxa
      FROM cultos c
      LEFT JOIN branches   b ON c.branch_id = b.id
      LEFT JOIN frequencias f ON f.culto_id = c.id
      ${where}
      GROUP BY c.id, c.tipo, c.data, c.horario, b.nome
      ORDER BY c.data DESC
    `,
      params,
    );

    // Visitantes por culto
    const visitantes = await query(
      `
      SELECT
        v.culto_id,
        COUNT(*) as total_visitantes
      FROM visitantes v
      LEFT JOIN cultos c ON v.culto_id = c.id
      ${where
        .replace(/c\.id/g, "v.culto_id")
        .replace(/c\.branch_id/g, "v.branch_id")
        .replace(/TO_CHAR\(c\.data/g, "TO_CHAR(c.data")}
      GROUP BY v.culto_id
    `,
      params,
    ).catch(() => ({ rows: [] }));

    // Convertidos por culto
    const convertidos = await query(
      `
      SELECT
        nc.culto_id,
        COUNT(*) as total_convertidos,
        json_agg(json_build_object('nome', nc.nome, 'contacto', nc.contacto, 'bairro', nc.bairro)) as lista
      FROM novos_convertidos nc
      LEFT JOIN cultos c ON nc.culto_id = c.id
      ${isAdmin ? "" : `WHERE nc.branch_id = $1`}
      GROUP BY nc.culto_id
    `,
      isAdmin ? [] : [branch_id],
    ).catch(() => ({ rows: [] }));

    // Merge dos dados
    const dados = cultos.rows.map((c) => ({
      ...c,
      total_visitantes:
        visitantes.rows.find((v) => v.culto_id === c.id)?.total_visitantes || 0,
      total_convertidos:
        convertidos.rows.find((v) => v.culto_id === c.id)?.total_convertidos ||
        0,
      lista_convertidos:
        convertidos.rows.find((v) => v.culto_id === c.id)?.lista || [],
    }));

    res.json({ success: true, dados });
  } catch (err) {
    console.error("relatorio presencas error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Exportar CSV ──────────────────────────────────────────────────────────────
router.get("/exportar/csv", authenticate, async (req, res) => {
  const { culto_id, mes } = req.query;
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;

  try {
    let conditions = isAdmin ? [] : [`c.branch_id = $1`];
    let params = isAdmin ? [] : [branch_id];
    let idx = params.length + 1;

    if (culto_id) {
      conditions.push(`c.id = $${idx++}`);
      params.push(culto_id);
    }
    if (mes) {
      conditions.push(`TO_CHAR(c.data, 'YYYY-MM') = $${idx++}`);
      params.push(mes);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await query(
      `
      SELECT
        c.tipo                          as "Tipo Culto",
        TO_CHAR(c.data, 'DD/MM/YYYY')  as "Data",
        b.nome                          as "Filial",
        COUNT(CASE WHEN f.presente = true  THEN 1 END) as "Presentes",
        COUNT(CASE WHEN f.presente = false THEN 1 END) as "Ausentes",
        COUNT(f.id)                                    as "Total Membros",
        ROUND(COUNT(CASE WHEN f.presente = true THEN 1 END)::numeric / NULLIF(COUNT(f.id), 0) * 100, 1) as "Taxa %",
        (SELECT COUNT(*) FROM visitantes v WHERE v.culto_id = c.id)       as "Visitantes",
        (SELECT COUNT(*) FROM novos_convertidos nc WHERE nc.culto_id = c.id) as "Convertidos"
      FROM cultos c
      LEFT JOIN branches    b ON c.branch_id = b.id
      LEFT JOIN frequencias f ON f.culto_id  = c.id
      ${where}
      GROUP BY c.id, c.tipo, c.data, b.nome
      ORDER BY c.data DESC
    `,
      params,
    );

    // Gera CSV
    const headers = Object.keys(result.rows[0] || {});
    const csvLines = [
      headers.join(","),
      ...result.rows.map((row) =>
        headers.map((h) => `"${row[h] ?? ""}"`).join(","),
      ),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="relatorio_presencas_${mes || "geral"}.csv"`,
    );
    res.send("\uFEFF" + csvLines.join("\n")); // BOM para Excel reconhecer UTF-8
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// ── Exportar PDF ──────────────────────────────────────────────────────────────
router.get("/exportar/pdf", authenticate, async (req, res) => {
  const { culto_id, mes } = req.query;
  const { role_id, branch_id, username } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;

  try {
    let conditions = isAdmin ? [] : [`c.branch_id = $1`];
    let params     = isAdmin ? [] : [branch_id];
    let idx        = params.length + 1;

    if (culto_id) { conditions.push(`c.id = $${idx++}`);                       params.push(culto_id); }
    if (mes)      { conditions.push(`TO_CHAR(c.data, 'YYYY-MM') = $${idx++}`); params.push(mes); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const cultos = await query(`
      SELECT c.id, c.tipo,
        TO_CHAR(c.data, 'DD/MM/YYYY') as data_formatada,
        b.nome as nome_branch,
        COUNT(CASE WHEN f.presente = true  THEN 1 END) as presentes,
        COUNT(CASE WHEN f.presente = false THEN 1 END) as ausentes,
        COUNT(f.id) as total_membros,
        ROUND(COUNT(CASE WHEN f.presente = true THEN 1 END)::numeric / NULLIF(COUNT(f.id), 0) * 100, 1) as taxa
      FROM cultos c
      LEFT JOIN branches    b ON c.branch_id = b.id
      LEFT JOIN frequencias f ON f.culto_id  = c.id
      ${where}
      GROUP BY c.id, c.tipo, c.data, b.nome
      ORDER BY c.data DESC
    `, params);

    const convertidos = await query(`
      SELECT nc.culto_id, nc.nome, nc.contacto, nc.bairro
      FROM novos_convertidos nc
      LEFT JOIN cultos c ON nc.culto_id = c.id
      ${isAdmin ? "" : "WHERE nc.branch_id = $1"}
      ORDER BY nc.criado_em ASC
    `, isAdmin ? [] : [branch_id]);

    const visitantes = await query(`
      SELECT v.culto_id, v.nome, v.contacto, v.bairro, v.igreja_origem
      FROM visitantes v
      LEFT JOIN cultos c ON v.culto_id = c.id
      ${isAdmin ? (where || "") : (where ? `${where} AND v.branch_id = $${params.length + 1}` : `WHERE v.branch_id = $1`)}
      ORDER BY v.nome ASC
    `, isAdmin ? params : [...params, branch_id]).catch(() => ({ rows: [] }));

    const cultoIds = cultos.rows.map((c) => c.id);
    const presentes = cultoIds.length > 0
      ? await query(`
          SELECT m.nome AS nome_membro, m.contacto, b.nome AS nome_branch, f.culto_id
          FROM frequencias f
          LEFT JOIN membros  m ON f.membro_id = m.id
          LEFT JOIN branches b ON m.branch_id = b.id
          WHERE f.presente = true AND f.culto_id = ANY($1::int[])
          ORDER BY f.culto_id, m.nome ASC
        `, [cultoIds]).catch(() => ({ rows: [] }))
      : { rows: [] };

    const titulo = mes
      ? `Relatório de Presenças — ${mes}`
      : culto_id ? `Relatório de Presenças — Culto`
      : "Relatório Geral de Presenças";

    const totalPresencasCard = cultos.rows.reduce((s, c) => s + parseInt(c.presentes || 0), 0);
    const totalVisitantesCard = visitantes.rows.length;
    const totalConvertidosCard = culto_id
      ? convertidos.rows.filter((v) => String(v.culto_id) === String(culto_id)).length
      : convertidos.rows.length;

    const html = gerarPresencasHTML({
      titulo,
      username,
      cultos:            cultos.rows,
      presentes:         presentes.rows,
      visitantes:        visitantes.rows,
      convertidos:       convertidos.rows,
      totalPresencasCard,
      totalVisitantesCard,
      totalConvertidosCard,
      culto_id,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Ofertas: dados resumidos por culto ────────────────────────────────────────
router.get("/ofertas/dados/:culto_id", authenticate, async (req, res) => {
  const { culto_id } = req.params;
  try {
    const cultoRes = await query(
      `SELECT c.id, c.tipo, TO_CHAR(c.data, 'DD/MM/YYYY') AS data_formatada, c.horario, b.nome AS filial
       FROM cultos c LEFT JOIN branches b ON b.id = c.branch_id WHERE c.id = $1`,
      [culto_id],
    );
    if (!cultoRes.rows.length)
      return res.status(404).json({ message: "Culto não encontrado." });

    const ofertasRes = await query(
      `SELECT * FROM v_detalhe_ofertas WHERE culto_id = $1 ORDER BY tipo, data_registo`,
      [culto_id],
    );
    res.json({ culto: cultoRes.rows[0], ofertas: ofertasRes.rows });
  } catch (err) {
    console.error("ofertas/dados error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Ofertas: exportar PDF (HTML para impressão) ───────────────────────────────
router.get("/ofertas/pdf/:culto_id", authenticate, async (req, res) => {
  const { culto_id } = req.params;
  const { username }  = req.user;
  try {
    const cultoRes = await query(
      `SELECT c.id, c.tipo, TO_CHAR(c.data, 'DD/MM/YYYY') AS data_formatada, c.horario, b.nome AS filial
       FROM cultos c LEFT JOIN branches b ON b.id = c.branch_id WHERE c.id = $1`,
      [culto_id],
    );
    if (!cultoRes.rows.length)
      return res.status(404).json({ message: "Culto não encontrado." });

    const ofertasRes = await query(
      `SELECT * FROM v_detalhe_ofertas WHERE culto_id = $1 ORDER BY tipo, data_registo`,
      [culto_id],
    );
    const culto = cultoRes.rows[0];
    const titulo = `Ficha de Ofertas — ${culto.tipo} (${culto.data_formatada})`;
    const html   = gerarFichaOfertasHTML({ titulo, username, culto, ofertas: ofertasRes.rows });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("ofertas/pdf error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Ofertas: exportar CSV (Excel) ─────────────────────────────────────────────
router.get("/ofertas/csv/:culto_id", authenticate, async (req, res) => {
  const { culto_id } = req.params;
  try {
    const cultoRes = await query(
      `SELECT c.tipo, TO_CHAR(c.data, 'DD/MM/YYYY') AS data_formatada, b.nome AS filial
       FROM cultos c LEFT JOIN branches b ON b.id = c.branch_id WHERE c.id = $1`,
      [culto_id],
    );
    if (!cultoRes.rows.length)
      return res.status(404).json({ message: "Culto não encontrado." });

    const ofertasRes = await query(
      `SELECT
         tipo                                        AS "Tipo",
         canal                                       AS "Canal",
         codigo_membro                               AS "Código Membro",
         membro_nome                                 AS "Nome do Membro",
         valor                                       AS "Valor (MT)",
         TO_CHAR(data_registo, 'DD/MM/YYYY HH24:MI') AS "Data Registo"
       FROM v_detalhe_ofertas
       WHERE culto_id = $1
       ORDER BY tipo, data_registo`,
      [culto_id],
    );

    const culto   = cultoRes.rows[0];
    const headers = ["Tipo", "Canal", "Código Membro", "Nome do Membro", "Valor (MT)", "Data Registo"];
    const csvLines = [
      `# Ficha de Ofertas — ${culto.tipo} (${culto.data_formatada}) — ${culto.filial}`,
      headers.join(","),
      ...ofertasRes.rows.map((row) =>
        headers.map((h) => `"${row[h] ?? ""}"`).join(","),
      ),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="ofertas_culto_${culto_id}.csv"`,
    );
    res.send("﻿" + csvLines.join("\n"));
  } catch (err) {
    console.error("ofertas/csv error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
