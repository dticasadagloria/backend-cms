import express from "express";
import { query } from "../config/db.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { gerarPresencasHTML } from "../templates/presencasTemplate.js";
import { gerarFichaOfertasHTML } from "../templates/fichaOfertas.js";
import { gerarEscolinhaHTML } from "../templates/escolinhaTemplate.js";

const router = express.Router();

// ── Filtro de filial nos relatórios de presenças ─────────────────────────────
// filial_id (query param) tem prioridade sobre o inter_filial do culto: se
// definido, o relatório conta só membros/presenças/visitantes/convertidos
// dessa filial, mesmo num culto inter-filial que normalmente juntaria todas.
//
// Segurança: um não-admin só pode filtrar pela própria filial — qualquer
// filial_id diferente da sua é ignorado silenciosamente (cai no
// comportamento por defeito), nunca é usado para ver dados de outra filial.
function resolverFilialId(filialIdQuery, isAdmin, branchId) {
  const parsed = parseInt(filialIdQuery, 10);
  const filialIdRequested = Number.isInteger(parsed) ? parsed : null;
  if (isAdmin) return filialIdRequested;
  return filialIdRequested === branchId ? filialIdRequested : null;
}

// Condição usada dentro do COUNT(CASE WHEN ...) que conta presenças: quando
// filial_id está definido, só conta a presença se o membro pertencer a essa
// filial (é preciso o JOIN a `membros mf` para saber o branch_id de f.membro_id).
const PRESENTE_FILIAL_COND = (filialParam) =>
  `f.presente = true AND ($${filialParam}::int IS NULL OR mf.branch_id = $${filialParam}::int)`;

// Condição usada dentro do CROSS JOIN LATERAL que calcula total_membros_culto:
// com filial_id definido, ignora completamente o inter_filial do culto e
// conta só os membros dessa filial; sem filial_id, mantém a regra actual.
const TOTAL_MEMBROS_FILIAL_COND = (filialParam) => `
    (
      ($${filialParam}::int IS NOT NULL AND m.branch_id = $${filialParam}::int)
      OR ($${filialParam}::int IS NULL AND (c.inter_filial = true OR m.branch_id = c.branch_id))
    )`;

async function obterNomeFilial(filialId) {
  if (!filialId) return null;
  const res = await query(`SELECT nome FROM branches WHERE id = $1`, [filialId]);
  return res.rows[0]?.nome ?? null;
}

// ── Dados do relatório ────────────────────────────────────────────────────────
router.get("/presencas", authenticate, async (req, res) => {
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;
  const { culto_id, mes } = req.query;
  const filialId = resolverFilialId(req.query.filial_id, isAdmin, branch_id);

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

    // filial_id é sempre passado como parâmetro (mesmo null), para poder ser
    // referenciado nos CASE/WHERE abaixo através de um único placeholder —
    // quando definido, tem prioridade sobre o inter_filial do culto tanto
    // no total de elegíveis como nos presentes.
    const filialParam = idx;
    params.push(filialId);

    // Cultos com stats
    // ✅ ausentes = membros elegíveis para o culto - presentes confirmados
    // (em vez de contar linhas explícitas presente=false, que ficam
    // incompletas quando nem todos os membros são marcados manualmente).
    const cultos = await query(
      `
      SELECT
        c.id, c.tipo, c.data, c.horario, c.inter_filial,
        TO_CHAR(c.data, 'DD/MM/YYYY') as data_formatada,
        b.nome as nome_branch,
        COUNT(CASE WHEN ${PRESENTE_FILIAL_COND(filialParam)} THEN 1 END) as presentes,
        mc.total_membros_culto - COUNT(CASE WHEN ${PRESENTE_FILIAL_COND(filialParam)} THEN 1 END) as ausentes,
        mc.total_membros_culto                                                 as total_membros_culto,
        ROUND(COUNT(CASE WHEN ${PRESENTE_FILIAL_COND(filialParam)} THEN 1 END)::numeric / NULLIF(mc.total_membros_culto, 0) * 100, 1) as taxa
      FROM cultos c
      LEFT JOIN branches   b  ON c.branch_id = b.id
      LEFT JOIN frequencias f ON f.culto_id  = c.id
      LEFT JOIN membros    mf ON mf.id       = f.membro_id
      CROSS JOIN LATERAL (
        SELECT COUNT(*) AS total_membros_culto
        FROM membros m
        WHERE m.ativo = true
          AND ${TOTAL_MEMBROS_FILIAL_COND(filialParam)}
      ) mc
      ${where}
      GROUP BY c.id, c.tipo, c.data, c.horario, c.inter_filial, b.nome, mc.total_membros_culto
      ORDER BY c.data DESC
    `,
      params,
    );

    // Visitantes por culto (branch_id próprio, filtra por filial_id quando definido)
    const visitantesWhere = where
      .replace(/c\.id/g, "v.culto_id")
      .replace(/c\.branch_id/g, "v.branch_id")
      .replace(/TO_CHAR\(c\.data/g, "TO_CHAR(c.data");
    const filialClause = `($${filialParam}::int IS NULL OR v.branch_id = $${filialParam}::int)`;
    const visitantes = await query(
      `
      SELECT
        v.culto_id,
        COUNT(*) as total_visitantes
      FROM visitantes v
      LEFT JOIN cultos c ON v.culto_id = c.id
      ${visitantesWhere ? `${visitantesWhere} AND ${filialClause}` : `WHERE ${filialClause}`}
      GROUP BY v.culto_id
    `,
      params,
    ).catch(() => ({ rows: [] }));

    // Convertidos por culto (branch_id próprio, filtra por filial_id quando definido)
    const convertidosConditions = [];
    const convertidosParams = [];
    if (!isAdmin) { convertidosConditions.push(`nc.branch_id = $${convertidosParams.length + 1}`); convertidosParams.push(branch_id); }
    if (filialId)  { convertidosConditions.push(`nc.branch_id = $${convertidosParams.length + 1}`); convertidosParams.push(filialId); }
    const convertidosWhere = convertidosConditions.length ? `WHERE ${convertidosConditions.join(" AND ")}` : "";

    const convertidos = await query(
      `
      SELECT
        nc.culto_id,
        COUNT(*) as total_convertidos,
        json_agg(json_build_object('nome', nc.nome, 'contacto', nc.contacto, 'bairro', nc.bairro)) as lista
      FROM novos_convertidos nc
      LEFT JOIN cultos c ON nc.culto_id = c.id
      ${convertidosWhere}
      GROUP BY nc.culto_id
    `,
      convertidosParams,
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
  const filialId = resolverFilialId(req.query.filial_id, isAdmin, branch_id);

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

    const filialParam = idx;
    params.push(filialId);

    // ✅ ausentes = membros elegíveis para o culto - presentes confirmados
    const result = await query(
      `
      SELECT
        c.tipo                          as "Tipo Culto",
        TO_CHAR(c.data, 'DD/MM/YYYY')  as "Data",
        b.nome                          as "Filial",
        CASE WHEN c.inter_filial THEN 'Inter-Filial' ELSE 'Filial' END as "Âmbito",
        COUNT(CASE WHEN ${PRESENTE_FILIAL_COND(filialParam)} THEN 1 END) as "Presentes",
        mc.total_membros_culto - COUNT(CASE WHEN ${PRESENTE_FILIAL_COND(filialParam)} THEN 1 END) as "Ausentes",
        mc.total_membros_culto                                                 as "Total Membros",
        ROUND(COUNT(CASE WHEN ${PRESENTE_FILIAL_COND(filialParam)} THEN 1 END)::numeric / NULLIF(mc.total_membros_culto, 0) * 100, 1) as "Taxa %",
        (SELECT COUNT(*) FROM visitantes v         WHERE v.culto_id  = c.id AND ($${filialParam}::int IS NULL OR v.branch_id  = $${filialParam}::int)) as "Visitantes",
        (SELECT COUNT(*) FROM novos_convertidos nc WHERE nc.culto_id = c.id AND ($${filialParam}::int IS NULL OR nc.branch_id = $${filialParam}::int)) as "Convertidos"
      FROM cultos c
      LEFT JOIN branches    b  ON c.branch_id = b.id
      LEFT JOIN frequencias f  ON f.culto_id  = c.id
      LEFT JOIN membros     mf ON mf.id       = f.membro_id
      CROSS JOIN LATERAL (
        SELECT COUNT(*) AS total_membros_culto
        FROM membros m
        WHERE m.ativo = true
          AND ${TOTAL_MEMBROS_FILIAL_COND(filialParam)}
      ) mc
      ${where}
      GROUP BY c.id, c.tipo, c.data, c.inter_filial, b.nome, mc.total_membros_culto
      ORDER BY c.data DESC
    `,
      params,
    );

    // Gera CSV
    const headers = Object.keys(result.rows[0] || {});
    const nomeFilial = await obterNomeFilial(filialId);
    const tituloLinha = nomeFilial ? [`# Relatório de Presenças — ${nomeFilial}`] : [];
    const csvLines = [
      ...tituloLinha,
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
  const filialId = resolverFilialId(req.query.filial_id, isAdmin, branch_id);

  try {
    let conditions = isAdmin ? [] : [`c.branch_id = $1`];
    let params     = isAdmin ? [] : [branch_id];
    let idx        = params.length + 1;

    if (culto_id) { conditions.push(`c.id = $${idx++}`);                       params.push(culto_id); }
    if (mes)      { conditions.push(`TO_CHAR(c.data, 'YYYY-MM') = $${idx++}`); params.push(mes); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const filialParam = idx;
    params.push(filialId);

    // ✅ ausentes = membros elegíveis para o culto - presentes confirmados
    // (mesma abordagem já usada em estatisticasGerais/presencasPorMes/presencasPorCulto)
    const cultos = await query(`
      SELECT c.id, c.tipo, c.inter_filial,
        TO_CHAR(c.data, 'DD/MM/YYYY') as data_formatada,
        b.nome as nome_branch,
        COUNT(CASE WHEN ${PRESENTE_FILIAL_COND(filialParam)} THEN 1 END) as presentes,
        mc.total_membros_culto - COUNT(CASE WHEN ${PRESENTE_FILIAL_COND(filialParam)} THEN 1 END) as ausentes,
        mc.total_membros_culto                                                 as total_membros_culto,
        ROUND(COUNT(CASE WHEN ${PRESENTE_FILIAL_COND(filialParam)} THEN 1 END)::numeric / NULLIF(mc.total_membros_culto, 0) * 100, 1) as taxa
      FROM cultos c
      LEFT JOIN branches    b  ON c.branch_id = b.id
      LEFT JOIN frequencias f  ON f.culto_id  = c.id
      LEFT JOIN membros     mf ON mf.id       = f.membro_id
      CROSS JOIN LATERAL (
        SELECT COUNT(*) AS total_membros_culto
        FROM membros m
        WHERE m.ativo = true
          AND ${TOTAL_MEMBROS_FILIAL_COND(filialParam)}
      ) mc
      ${where}
      GROUP BY c.id, c.tipo, c.data, c.inter_filial, b.nome, mc.total_membros_culto
      ORDER BY c.data DESC
    `, params);

    // Convertidos/visitantes: branch_id próprio + filial_id quando definido
    // (prioridade sobre inter_filial, tal como no resto do relatório).
    const convertidosConditions = [];
    const convertidosParams = [];
    if (!isAdmin) { convertidosConditions.push(`nc.branch_id = $${convertidosParams.length + 1}`); convertidosParams.push(branch_id); }
    if (filialId)  { convertidosConditions.push(`nc.branch_id = $${convertidosParams.length + 1}`); convertidosParams.push(filialId); }
    const convertidosWhere = convertidosConditions.length ? `WHERE ${convertidosConditions.join(" AND ")}` : "";

    const convertidos = await query(`
      SELECT nc.culto_id, nc.nome, nc.contacto, nc.bairro
      FROM novos_convertidos nc
      LEFT JOIN cultos c ON nc.culto_id = c.id
      ${convertidosWhere}
      ORDER BY nc.criado_em ASC
    `, convertidosParams);

    const visitantesWhere = where
      .replace(/c\.id/g, "v.culto_id")
      .replace(/c\.branch_id/g, "v.branch_id")
      .replace(/TO_CHAR\(c\.data/g, "TO_CHAR(c.data");
    const filialClause = `($${filialParam}::int IS NULL OR v.branch_id = $${filialParam}::int)`;
    const visitantes = await query(`
      SELECT v.culto_id, v.nome, v.contacto, v.bairro, v.igreja_origem
      FROM visitantes v
      LEFT JOIN cultos c ON v.culto_id = c.id
      ${visitantesWhere ? `${visitantesWhere} AND ${filialClause}` : `WHERE ${filialClause}`}
      ORDER BY v.nome ASC
    `, params).catch(() => ({ rows: [] }));

    const cultoIds = cultos.rows.map((c) => c.id);
    const presentes = cultoIds.length > 0
      ? await query(`
          SELECT m.nome AS nome_membro, m.contacto, b.nome AS nome_branch, f.culto_id
          FROM frequencias f
          LEFT JOIN membros  m ON f.membro_id = m.id
          LEFT JOIN branches b ON m.branch_id = b.id
          WHERE f.presente = true AND f.culto_id = ANY($1::int[])
            AND ($2::int IS NULL OR m.branch_id = $2::int)
          ORDER BY f.culto_id, m.nome ASC
        `, [cultoIds, filialId]).catch(() => ({ rows: [] }))
      : { rows: [] };

    const nomeFilial = await obterNomeFilial(filialId);
    const filialSufixo = nomeFilial ? ` — ${nomeFilial}` : "";
    const titulo = mes
      ? `Relatório de Presenças${filialSufixo} — ${mes}`
      : culto_id ? `Relatório de Presenças${filialSufixo} — Culto`
      : `Relatório Geral de Presenças${filialSufixo}`;

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

// ── Escolinha da Verdade: dados do relatório ──────────────────────────────────
router.get("/escolinha", authenticate, async (req, res) => {
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;
  const { aula_id, mes } = req.query;

  try {
    let conditions = isAdmin ? [] : [`a.branch_id = $1`];
    let params = isAdmin ? [] : [branch_id];
    let idx = params.length + 1;

    if (aula_id) {
      conditions.push(`a.id = $${idx++}`);
      params.push(aula_id);
    }
    if (mes) {
      conditions.push(`TO_CHAR(a.data, 'YYYY-MM') = $${idx++}`);
      params.push(mes);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    // ✅ ausentes = crianças activas elegíveis (mesma turma + filial da aula) - presentes confirmados
    const aulas = await query(
      `
      SELECT
        a.id, a.data, a.horario, a.turma, a.tema, a.professor,
        TO_CHAR(a.data, 'DD/MM/YYYY') as data_formatada,
        b.nome as nome_branch,
        COUNT(CASE WHEN p.presente = true THEN 1 END) as presentes,
        mc.total_criancas - COUNT(CASE WHEN p.presente = true THEN 1 END) as ausentes,
        mc.total_criancas as total_criancas,
        ROUND(COUNT(CASE WHEN p.presente = true THEN 1 END)::numeric / NULLIF(mc.total_criancas, 0) * 100, 1) as taxa
      FROM aulas a
      LEFT JOIN branches b ON a.branch_id = b.id
      LEFT JOIN presencas_escolinha p ON p.aula_id = a.id
      CROSS JOIN LATERAL (
        SELECT COUNT(*) AS total_criancas
        FROM criancas c
        WHERE c.ativo = true AND c.turma = a.turma AND c.branch_id = a.branch_id
      ) mc
      ${where}
      GROUP BY a.id, a.data, a.horario, a.turma, a.tema, a.professor, b.nome, mc.total_criancas
      ORDER BY a.data DESC
    `,
      params,
    );

    res.json({ success: true, dados: aulas.rows });
  } catch (err) {
    console.error("relatorio escolinha error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Escolinha da Verdade: exportar CSV ────────────────────────────────────────
router.get("/escolinha/exportar/csv", authenticate, async (req, res) => {
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;
  const { aula_id, mes } = req.query;

  try {
    let conditions = isAdmin ? [] : [`a.branch_id = $1`];
    let params = isAdmin ? [] : [branch_id];
    let idx = params.length + 1;

    if (aula_id) { conditions.push(`a.id = $${idx++}`); params.push(aula_id); }
    if (mes)     { conditions.push(`TO_CHAR(a.data, 'YYYY-MM') = $${idx++}`); params.push(mes); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await query(
      `
      SELECT
        TO_CHAR(a.data, 'DD/MM/YYYY') as "Data",
        a.turma                        as "Turma",
        COALESCE(a.tema, '—')          as "Tema",
        b.nome                         as "Filial",
        COUNT(CASE WHEN p.presente = true THEN 1 END) as "Presentes",
        mc.total_criancas - COUNT(CASE WHEN p.presente = true THEN 1 END) as "Ausentes",
        mc.total_criancas as "Total Crianças",
        ROUND(COUNT(CASE WHEN p.presente = true THEN 1 END)::numeric / NULLIF(mc.total_criancas, 0) * 100, 1) as "Taxa %"
      FROM aulas a
      LEFT JOIN branches b ON a.branch_id = b.id
      LEFT JOIN presencas_escolinha p ON p.aula_id = a.id
      CROSS JOIN LATERAL (
        SELECT COUNT(*) AS total_criancas
        FROM criancas c
        WHERE c.ativo = true AND c.turma = a.turma AND c.branch_id = a.branch_id
      ) mc
      ${where}
      GROUP BY a.id, a.data, a.turma, a.tema, b.nome, mc.total_criancas
      ORDER BY a.data DESC
    `,
      params,
    );

    const headers = Object.keys(result.rows[0] || {});
    const csvLines = [
      headers.join(","),
      ...result.rows.map((row) => headers.map((h) => `"${row[h] ?? ""}"`).join(",")),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="relatorio_escolinha_${mes || "geral"}.csv"`);
    res.send("﻿" + csvLines.join("\n"));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Escolinha da Verdade: exportar PDF ────────────────────────────────────────
router.get("/escolinha/exportar/pdf", authenticate, async (req, res) => {
  const { role_id, branch_id, username } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;
  const { aula_id, mes } = req.query;

  try {
    let conditions = isAdmin ? [] : [`a.branch_id = $1`];
    let params = isAdmin ? [] : [branch_id];
    let idx = params.length + 1;

    if (aula_id) { conditions.push(`a.id = $${idx++}`); params.push(aula_id); }
    if (mes)     { conditions.push(`TO_CHAR(a.data, 'YYYY-MM') = $${idx++}`); params.push(mes); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const aulas = await query(
      `
      SELECT
        a.id, a.turma, a.tema, a.professor,
        TO_CHAR(a.data, 'DD/MM/YYYY') as data_formatada,
        b.nome as nome_branch,
        COUNT(CASE WHEN p.presente = true THEN 1 END) as presentes,
        mc.total_criancas - COUNT(CASE WHEN p.presente = true THEN 1 END) as ausentes,
        mc.total_criancas as total_criancas,
        ROUND(COUNT(CASE WHEN p.presente = true THEN 1 END)::numeric / NULLIF(mc.total_criancas, 0) * 100, 1) as taxa
      FROM aulas a
      LEFT JOIN branches b ON a.branch_id = b.id
      LEFT JOIN presencas_escolinha p ON p.aula_id = a.id
      CROSS JOIN LATERAL (
        SELECT COUNT(*) AS total_criancas
        FROM criancas c
        WHERE c.ativo = true AND c.turma = a.turma AND c.branch_id = a.branch_id
      ) mc
      ${where}
      GROUP BY a.id, a.turma, a.tema, a.professor, a.data, b.nome, mc.total_criancas
      ORDER BY a.data DESC
    `,
      params,
    );

    const aulaIds = aulas.rows.map((a) => a.id);
    const presentes = aulaIds.length > 0
      ? await query(`
          SELECT c.nome AS nome_crianca, b.nome AS nome_branch, p.aula_id
          FROM presencas_escolinha p
          LEFT JOIN criancas c ON p.crianca_id = c.id
          LEFT JOIN branches b ON c.branch_id = b.id
          WHERE p.presente = true AND p.aula_id = ANY($1::int[])
          ORDER BY p.aula_id, c.nome ASC
        `, [aulaIds]).catch(() => ({ rows: [] }))
      : { rows: [] };

    const totalPresencasCard = aulas.rows.reduce((s, a) => s + parseInt(a.presentes || 0), 0);

    const titulo = mes
      ? `Relatório Escolinha da Verdade — ${mes}`
      : aula_id ? `Relatório Escolinha da Verdade — Aula`
      : "Relatório Geral — Escolinha da Verdade";

    const html = gerarEscolinhaHTML({
      titulo,
      username,
      aulas: aulas.rows,
      presentes: presentes.rows,
      totalPresencasCard,
      aula_id,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
