import express from "express";
import { query } from "../config/db.js";
import { authenticate } from "../middleware/authMiddleware.js";

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

    const cultos = await query(
      `
      SELECT
        c.id, c.tipo,
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
    `,
      params,
    );

    const convertidos = await query(
      `
      SELECT nc.culto_id, nc.nome, nc.contacto, nc.bairro
      FROM novos_convertidos nc
      LEFT JOIN cultos c ON nc.culto_id = c.id
      ${isAdmin ? "" : "WHERE nc.branch_id = $1"}
      ORDER BY nc.criado_em ASC
    `,
      isAdmin ? [] : [branch_id],
    );

    // ── Visitantes com dados individuais por culto ────────────────────────────
    const visitantes = await query(
      `
      SELECT v.culto_id, v.nome, v.contacto, v.bairro, v.igreja_origem
      FROM visitantes v
      LEFT JOIN cultos c ON v.culto_id = c.id
      ${
        isAdmin
          ? where
            ? where
            : ""
          : where
            ? `${where} AND v.branch_id = $${params.length + 1}`
            : `WHERE v.branch_id = $1`
      }
      ORDER BY v.nome ASC
    `,
      isAdmin ? params : [...params, branch_id],
    ).catch(() => ({ rows: [] }));

    // ── Lista de presentes por culto ──────────────────────────────────────────────
const cultoIds = cultos.rows.map((c) => c.id);

const presentes = cultoIds.length > 0
  ? await query(`
      SELECT
        m.nome AS nome_membro,
        m.contacto,
        b.nome AS nome_branch,
        f.culto_id
      FROM frequencias f
      LEFT JOIN membros  m ON f.membro_id = m.id
      LEFT JOIN branches b ON m.branch_id = b.id
      WHERE f.presente = true
        AND f.culto_id = ANY($1::int[])
      ORDER BY f.culto_id, m.nome ASC
    `, [cultoIds]).catch(() => ({ rows: [] }))
  : { rows: [] };

    const titulo = mes
      ? `Relatório de Presenças — ${mes}`
      : culto_id
        ? `Relatório de Presenças — Culto`
        : "Relatório Geral de Presenças";

    // Totais para os cards — por culto específico ou geral
    const totalVisitantesCard = visitantes.rows.length;
    const totalConvertidosCard = culto_id
      ? convertidos.rows.filter((v) => String(v.culto_id) === String(culto_id))
          .length
      : convertidos.rows.length;
    const totalPresencasCard = cultos.rows.reduce(
      (s, c) => s + parseInt(c.presentes || 0),
      0,
    );

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 30px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #b6852e; padding-bottom: 15px; }
          .header h1 { font-size: 20px; color: #1e293b; }
          .header p  { color: #64748b; font-size: 11px; margin-top: 4px; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 11px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          th { background: #fef3c7; color: #92400e; font-size: 10px; text-transform: uppercase; padding: 8px 10px; text-align: left; }
          td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: bold; }
          .badge-green { background: #d1fae5; color: #065f46; }
          .badge-red   { background: #fee2e2; color: #991b1b; }
          .badge-amber { background: #fef3c7; color: #92400e; }
          .section-title { font-size: 13px; font-weight: bold; color: #1e293b; margin: 20px 0 10px; border-left: 3px solid #b6852e; padding-left: 8px; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px; }
          .summary { display: flex; gap: 15px; margin-bottom: 20px; }
          .summary-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
          .summary-card .value { font-size: 22px; font-weight: bold; color: #b6852e; }
          .summary-card .label { font-size: 10px; color: #64748b; margin-top: 2px; }
        </style>
      </head>
      <body>
        <div class="header">
        <img 
    src="https://casadagloria-cms.vercel.app/Logo1.png" 
    style="width: 120px; height: auto; display: block; margin: 0 auto 10px;" 
    alt="Logo IICGP"
  />
          <h1>Igreja Internacional Casa da Glória da Palavra</h1>
          <p>${titulo}</p>
        </div>

        <div class="meta">
          <span>Gerado por: <strong>${username}</strong></span>
          <span>Data: <strong>${new Date().toLocaleDateString("pt-MZ")}</strong></span>
          <span>Total de cultos: <strong>${cultos.rows.length}</strong></span>
        </div>

        <!-- Cards — valores filtrados pelo culto/mês seleccionado -->
        <div class="summary">
          <div class="summary-card">
            <div class="value">${cultos.rows.length}</div>
            <div class="label">Cultos</div>
          </div>
          <div class="summary-card">
            <div class="value">${totalPresencasCard}</div>
            <div class="label">Total Presenças</div>
          </div>
          <div class="summary-card">
            <div class="value">${totalVisitantesCard}</div>
            <div class="label">Visitantes${culto_id ? " neste Culto" : ""}</div>
          </div>
          <div class="summary-card">
            <div class="value">${totalConvertidosCard}</div>
            <div class="label">Novos Convertidos${culto_id ? " neste Culto" : ""}</div>
          </div>
        </div>

        <!-- Tabela de cultos -->
        <div class="section-title">Detalhes por Culto</div>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Filial</th>
              <th>Presentes</th>
              <th>Ausentes</th>
              <th>Visitantes</th>
              <th>Convertidos</th>
              <th>Taxa</th>
            </tr>
          </thead>
          <tbody>
            ${cultos.rows
              .map((c) => {
                const vis = visitantes.rows.filter(
                  (v) => v.culto_id === c.id,
                ).length;
                const conv = convertidos.rows.filter(
                  (v) => v.culto_id === c.id,
                ).length;
                return `
                <tr>
                  <td>${c.data_formatada}</td>
                  <td>${c.tipo}</td>
                  <td>${c.nome_branch || "—"}</td>
                  <td><span class="badge badge-green">${c.presentes}</span></td>
                  <td><span class="badge badge-red">${c.ausentes}</span></td>
                  <td>${vis}</td>
                  <td>${conv}</td>
                  <td><span class="badge badge-amber">${c.taxa ?? 0}%</span></td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>


        <!-- Lista de presentes por culto -->
${cultos.rows
  .map((c) => {
    const presentesDoCulto = presentes.rows.filter(
      (p) => String(p.culto_id) === String(c.id),
    );
    if (!presentesDoCulto.length) return "";
    return `
    <div class="section-title">Presentes — ${c.tipo} (${c.data_formatada}) — ${presentesDoCulto.length}</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Nome</th>
          <th>Contacto</th>
          <th>Filial</th>
        </tr>
      </thead>
      <tbody>
        ${presentesDoCulto
          .map(
            (p, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${p.nome_membro || "—"}</td>
            <td>${p.contacto || "—"}</td>
            <td>${p.nome_branch || "—"}</td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
  })
  .join("")}

        <!-- Lista de visitantes por culto -->
        ${cultos.rows
          .map((c) => {
            const visDoculto = visitantes.rows.filter(
              (v) => v.culto_id === c.id,
            );
            if (!visDoculto.length) return "";
            return `
            <div class="section-title">Visitantes — ${c.tipo} (${c.data_formatada}) — ${visDoculto.length}</div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nome</th>
                  <th>Contacto</th>
                  <th>Bairro</th>
                  <th>Igreja Origem</th>
                </tr>
              </thead>
              <tbody>
                ${visDoculto
                  .map(
                    (v, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${v.nome}</td>
                    <td>${v.contacto || "—"}</td>
                    <td>${v.bairro || "—"}</td>
                    <td>${v.igreja_origem || "—"}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          `;
          })
          .join("")}

        <!-- Lista de convertidos por culto -->
        ${cultos.rows
          .map((c) => {
            const convDoCulto = convertidos.rows.filter(
              (v) => v.culto_id === c.id,
            );
            if (!convDoCulto.length) return "";
            return `
            <div class="section-title">Novos Convertidos — ${c.tipo} (${c.data_formatada}) — ${convDoCulto.length}</div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nome</th>
                  <th>Contacto</th>
                  <th>Bairro</th>
                </tr>
              </thead>
              <tbody>
                ${convDoCulto
                  .map(
                    (cv, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${cv.nome}</td>
                    <td>${cv.contacto || "—"}</td>
                    <td>${cv.bairro || "—"}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          `;
          })
          .join("")}

        <div class="footer">
          Sistema de Gestão IICGP · Relatório gerado automaticamente
        </div>
      </body>
      </html>
    `;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
