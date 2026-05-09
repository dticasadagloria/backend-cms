import { query } from "../config/db.js";
import cloudinary from "../config/cloudinary.js";
import { logActivity } from "../helpers/logActivity.js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// ── Helper: enviar emails ────────────────────────────────────────────────────
const formatMt = (v) =>
  new Intl.NumberFormat("pt-MZ", { style: "currency", currency: "MZN" }).format(v || 0);

const enviarEmailRequisicao = async ({ requisicao, nomeFilial, nomeDepartamento }) => {
  const { codigo, descricao, valor, nome_solicitante, contacto_solicitante } = requisicao;

  // ── Email para o solicitante (só se tiver email) ──────────────────────────
  if (contacto_solicitante && contacto_solicitante.includes("@")) {
    await resend.emails.send({
      from:    "IICGP <onboarding@resend.dev>",
      to:      contacto_solicitante,
      subject: `Requisição ${codigo} submetida com sucesso`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e2e8f0">
          <h2 style="color:#f59e0b;margin-bottom:4px">Requisição Recebida</h2>
          <p style="color:#64748b;font-size:14px;margin-top:0">A tua requisição foi submetida com sucesso.</p>
          <div style="background:#f8fafc;border-radius:8px;padding:20px;margin:24px 0">
            <table style="width:100%;font-size:14px;border-collapse:collapse">
              <tr><td style="color:#94a3b8;padding:6px 0">Código</td>       <td style="font-weight:700;color:#f59e0b">${codigo}</td></tr>
              <tr><td style="color:#94a3b8;padding:6px 0">Descrição</td>    <td style="color:#334155">${descricao}</td></tr>
              <tr><td style="color:#94a3b8;padding:6px 0">Valor</td>        <td style="font-weight:700;color:#334155">${formatMt(valor)}</td></tr>
              <tr><td style="color:#94a3b8;padding:6px 0">Filial</td>       <td style="color:#334155">${nomeFilial || "—"}</td></tr>
              <tr><td style="color:#94a3b8;padding:6px 0">Departamento</td> <td style="color:#334155">${nomeDepartamento || "—"}</td></tr>
              <tr><td style="color:#94a3b8;padding:6px 0">Estado</td>       <td><span style="background:#fef3c7;color:#d97706;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600">Em Espera</span></td></tr>
            </table>
          </div>
          <p style="color:#64748b;font-size:13px">Serás notificado quando o estado da requisição for actualizado.</p>
          <p style="color:#cbd5e1;font-size:12px;margin-top:32px">IICGP · Sistema de Gestão</p>
        </div>
      `,
    });
  }

  // ── Email para o Admin ────────────────────────────────────────────────────
  if (process.env.ADMIN_EMAIL) {
    await resend.emails.send({
      from:    "IICGP <onboarding@resend.dev>",
      to:      process.env.ADMIN_EMAIL,
      subject: `🔔 Nova Requisição: ${codigo} — ${nomeFilial || ""}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e2e8f0">
          <h2 style="color:#334155;margin-bottom:4px">Nova Requisição Submetida</h2>
          <p style="color:#64748b;font-size:14px;margin-top:0">Uma nova requisição aguarda aprovação.</p>
          <div style="background:#f8fafc;border-radius:8px;padding:20px;margin:24px 0">
            <table style="width:100%;font-size:14px;border-collapse:collapse">
              <tr><td style="color:#94a3b8;padding:6px 0">Código</td>       <td style="font-weight:700;color:#f59e0b">${codigo}</td></tr>
              <tr><td style="color:#94a3b8;padding:6px 0">Solicitante</td>  <td style="color:#334155">${nome_solicitante || "—"}</td></tr>
              <tr><td style="color:#94a3b8;padding:6px 0">Contacto</td>     <td style="color:#334155">${contacto_solicitante || "—"}</td></tr>
              <tr><td style="color:#94a3b8;padding:6px 0">Descrição</td>    <td style="color:#334155">${descricao}</td></tr>
              <tr><td style="color:#94a3b8;padding:6px 0">Valor</td>        <td style="font-weight:700;color:#334155">${formatMt(valor)}</td></tr>
              <tr><td style="color:#94a3b8;padding:6px 0">Filial</td>       <td style="color:#334155">${nomeFilial || "—"}</td></tr>
              <tr><td style="color:#94a3b8;padding:6px 0">Departamento</td> <td style="color:#334155">${nomeDepartamento || "—"}</td></tr>
            </table>
          </div>
          <p style="color:#64748b;font-size:13px">Acede ao sistema para aprovar ou rejeitar esta requisição.</p>
          <p style="color:#cbd5e1;font-size:12px;margin-top:32px">IICGP · Sistema de Gestão</p>
        </div>
      `,
    });
  }
};

// ── Helper: buscar nomes de filial e departamento ────────────────────────────
const buscarNomesFilialDep = async (filial_id, departamento_id) => {
  const filialRes = filial_id
    ? await query(`SELECT nome FROM branches WHERE id = $1`, [filial_id])
    : { rows: [] };
  const depRes = departamento_id
    ? await query(`SELECT nome FROM departamentos WHERE id = $1`, [departamento_id])
    : { rows: [] };
  return {
    nomeFilial:       filialRes.rows[0]?.nome || null,
    nomeDepartamento: depRes.rows[0]?.nome    || null,
  };
};

// ── Criar requisição (autenticado) ───────────────────────────────────────────
export const criarRequisicao = async (req, res) => {
  const {
    departamento_id, lider_solicitante_id,
    descricao, valor, observacoes, itens = []
  } = req.body;
  const { role_id, branch_id, id: criado_por } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;
  const filial  = isAdmin ? (req.body.filial_id || branch_id) : branch_id;

  try {
    const result = await query(`
      INSERT INTO requisicoes
        (filial_id, departamento_id, lider_solicitante_id, descricao, valor, observacoes, criado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `, [filial, departamento_id, lider_solicitante_id, descricao, valor, observacoes, criado_por]);

    const requisicao = result.rows[0];

    for (const item of itens) {
      if (item.descricao) {
        await query(`
          INSERT INTO requisicao_itens (requisicao_id, descricao, quantidade, valor_unitario)
          VALUES ($1, $2, $3, $4)
        `, [requisicao.id, item.descricao, item.quantidade || 1, item.valor_unitario || 0]);
      }
    }

    await query(`
      INSERT INTO requisicao_historico
        (requisicao_id, status_anterior, status_novo, alterado_por, observacao)
      VALUES ($1, null, 'Em Espera', $2, 'Requisição criada')
    `, [requisicao.id, criado_por]);

    await logActivity(req, {
      action:       "CREATE",
      entity_type:  "requisicao",
      entity_id:    requisicao.id,
      entity_label: `Requisição #${requisicao.id}`,
      new_values:   { descricao: requisicao.descricao, valor: requisicao.valor },
      description:  `Criou a requisição #${requisicao.id}: ${requisicao.descricao}`,
    });

    // Busca membro solicitante para ter o email
    if (lider_solicitante_id) {
      const membroRes = await query(
        `SELECT nome_membro, email FROM membros WHERE id = $1`, [lider_solicitante_id]
      );
      const membro = membroRes.rows[0];
      if (membro) {
        requisicao.nome_solicitante      = membro.nome_membro;
        requisicao.contacto_solicitante  = membro.email;
      }
    }

    const { nomeFilial, nomeDepartamento } = await buscarNomesFilialDep(filial, departamento_id);

    enviarEmailRequisicao({ requisicao, nomeFilial, nomeDepartamento })
      .catch((err) => console.error("Erro ao enviar email:", err.message));

    res.status(201).json({ success: true, requisicao });
  } catch (err) {
    console.error("criarRequisicao error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Listar requisições ───────────────────────────────────────────────────────
export const listarRequisicoes = async (req, res) => {
  const { role_id, branch_id: userBranch } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;
  const { status, filial_id } = req.query;

  try {
    let conditions = [];
    let params     = [];
    let idx        = 1;

    if (!isAdmin) {
      conditions.push(`r.filial_id = $${idx++}`);
      params.push(userBranch);
    } else if (filial_id) {
      conditions.push(`r.filial_id = $${idx++}`);
      params.push(filial_id);
    }

    if (status) {
      conditions.push(`r.status = $${idx++}`);
      params.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await query(`
      SELECT
        r.*,
        b.nome                                              AS nome_filial,
        d.nome                                              AS nome_departamento,
        COALESCE(m.nome, r.nome_solicitante)        AS nome_solicitante,
        r.contacto_solicitante,
        u.username                                          AS criado_por_nome
      FROM requisicoes r
      LEFT JOIN branches      b ON r.filial_id             = b.id
      LEFT JOIN departamentos d ON r.departamento_id       = d.id
      LEFT JOIN membros       m ON r.lider_solicitante_id  = m.id
      LEFT JOIN users         u ON r.criado_por            = u.id
      ${where}
      ORDER BY r.criado_em DESC
    `, params);

    res.json({ success: true, requisicoes: result.rows });
  } catch (err) {
    console.error("listarRequisicoes error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Obter requisição por ID ──────────────────────────────────────────────────
export const obterRequisicao = async (req, res) => {
  const { id } = req.params;
  try {
    const req_result = await query(`
      SELECT
        r.*,
        b.nome                                          AS nome_filial,
        d.nome                                          AS nome_departamento,
        COALESCE(m.nome, r.nome_solicitante)    AS nome_solicitante,
        r.contacto_solicitante
      FROM requisicoes r
      LEFT JOIN branches      b ON r.filial_id            = b.id
      LEFT JOIN departamentos d ON r.departamento_id      = d.id
      LEFT JOIN membros       m ON r.lider_solicitante_id = m.id
      WHERE r.id = $1
    `, [id]);

    if (!req_result.rows.length)
      return res.status(404).json({ success: false, error: "Requisição não encontrada" });

    const itens = await query(
      `SELECT * FROM requisicao_itens WHERE requisicao_id = $1 ORDER BY id`, [id]
    );

    const historico = await query(`
      SELECT h.*, u.username AS alterado_por_nome
      FROM requisicao_historico h
      LEFT JOIN users u ON h.alterado_por = u.id
      WHERE h.requisicao_id = $1
      ORDER BY h.alterado_em ASC
    `, [id]);

    res.json({
      success:    true,
      requisicao: req_result.rows[0],
      itens:      itens.rows,
      historico:  historico.rows,
    });
  } catch (err) {
    console.error("obterRequisicao error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Actualizar status ────────────────────────────────────────────────────────
export const actualizarStatus = async (req, res) => {
  const { id }                 = req.params;
  const { status, observacao } = req.body;
  const alterado_por           = req.user?.id;

  const statusValidos = ["Em Espera", "Aprovado", "Pago", "Rejeitado"];
  if (!statusValidos.includes(status))
    return res.status(400).json({ success: false, error: "Status inválido" });

  try {
    const actual = await query(`SELECT status FROM requisicoes WHERE id = $1`, [id]);
    if (!actual.rows.length)
      return res.status(404).json({ success: false, error: "Requisição não encontrada" });

    const status_anterior = actual.rows[0].status;

    let extraFields = "";
    if (status === "Aprovado") extraFields = ", data_aprovacao = CURRENT_DATE";
    if (status === "Pago")     extraFields = ", data_pagamento = CURRENT_DATE";

    await query(`
      UPDATE requisicoes
      SET status = $1, atualizado_em = CURRENT_TIMESTAMP ${extraFields}
      WHERE id = $2
    `, [status, id]);

    await query(`
      INSERT INTO requisicao_historico
        (requisicao_id, status_anterior, status_novo, alterado_por, observacao)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, status_anterior, status, alterado_por, observacao || null]);

    await logActivity(req, {
      action:       "STATUS_CHANGE",
      entity_type:  "requisicao",
      entity_id:    parseInt(id),
      entity_label: `Requisição #${id}`,
      old_values:   { status: status_anterior },
      new_values:   { status },
      description:  `Alterou o status da requisição #${id}: ${status_anterior} → ${status}`,
    });

    res.json({ success: true, message: `Requisição ${status} com sucesso` });
  } catch (err) {
    console.error("actualizarStatus error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Upload comprovativo ──────────────────────────────────────────────────────
export const uploadComprovativo = async (req, res) => {
  const { id } = req.params;
  if (!req.file)
    return res.status(400).json({ success: false, error: "Nenhum ficheiro enviado" });

  try {
    const url = req.file.path;

    await query(`
      UPDATE requisicoes SET comprovativo_url = $1, atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [url, id]);

    res.json({ success: true, url, message: "Comprovativo enviado com sucesso" });
  } catch (err) {
    console.error("uploadComprovativo error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Apagar requisição ────────────────────────────────────────────────────────
export const apagarRequisicao = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query(`SELECT comprovativo_url FROM requisicoes WHERE id = $1`, [id]);
    const url    = result.rows[0]?.comprovativo_url;

    if (url) {
      const publicId = url.split("/").slice(-2).join("/").split(".")[0];
      await cloudinary.uploader.destroy(publicId, { resource_type: "auto" });
    }

    await query(`DELETE FROM requisicoes WHERE id = $1`, [id]);

    await logActivity(req, {
      action:       "DELETE",
      entity_type:  "requisicao",
      entity_id:    parseInt(id),
      entity_label: `Requisição #${id}`,
      description:  `Apagou a requisição #${id}`,
    });

    res.json({ success: true, message: "Requisição apagada com sucesso" });
  } catch (err) {
    console.error("apagarRequisicao error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Relatórios ───────────────────────────────────────────────────────────────
export const relatorios = async (req, res) => {
  try {
    const stats = await query(`
      SELECT
        COUNT(*)                                                        AS total,
        COUNT(CASE WHEN status = 'Em Espera'  THEN 1 END)             AS em_espera,
        COUNT(CASE WHEN status = 'Aprovado'   THEN 1 END)             AS aprovadas,
        COUNT(CASE WHEN status = 'Pago'       THEN 1 END)             AS pagas,
        COUNT(CASE WHEN status = 'Rejeitado'  THEN 1 END)             AS rejeitadas,
        COALESCE(SUM(CASE WHEN status = 'Pago' THEN valor END), 0)    AS total_pago
      FROM requisicoes
    `);

    const porMes = await query(`
      SELECT
        TO_CHAR(data_pagamento, 'Mon YYYY') AS mes,
        TO_CHAR(data_pagamento, 'YYYY-MM')  AS mes_ordem,
        COUNT(*)                            AS total_requisicoes,
        SUM(valor)                          AS total_pago
      FROM requisicoes
      WHERE status = 'Pago' AND data_pagamento IS NOT NULL
      GROUP BY TO_CHAR(data_pagamento, 'Mon YYYY'), TO_CHAR(data_pagamento, 'YYYY-MM')
      ORDER BY mes_ordem ASC
    `);

    const porFilial = await query(`
      SELECT
        b.nome                                                          AS nome_filial,
        COUNT(r.id)                                                     AS total_requisicoes,
        COUNT(CASE WHEN r.status = 'Pago' THEN 1 END)                  AS pagas,
        COALESCE(SUM(CASE WHEN r.status = 'Pago' THEN r.valor END), 0) AS total_pago
      FROM branches b
      LEFT JOIN requisicoes r ON r.filial_id = b.id
      GROUP BY b.id, b.nome
      ORDER BY total_pago DESC
    `);

    const porDepartamento = await query(`
      SELECT
        COALESCE(d.nome, 'Sem Departamento')                           AS nome_departamento,
        COUNT(r.id)                                                     AS total_requisicoes,
        COALESCE(SUM(CASE WHEN r.status = 'Pago' THEN r.valor END), 0) AS total_pago
      FROM requisicoes r
      LEFT JOIN departamentos d ON r.departamento_id = d.id
      GROUP BY d.id, d.nome
      ORDER BY total_pago DESC
    `);

    const topFiliais = await query(`
      SELECT
        b.nome        AS nome_filial,
        SUM(r.valor)  AS total_gasto,
        COUNT(r.id)   AS num_requisicoes
      FROM requisicoes r
      JOIN branches b ON r.filial_id = b.id
      WHERE r.status = 'Pago'
      GROUP BY b.id, b.nome
      ORDER BY total_gasto DESC
      LIMIT 5
    `);

    res.json({
      success:          true,
      stats:            stats.rows[0],
      porMes:           porMes.rows,
      porFilial:        porFilial.rows,
      porDepartamento:  porDepartamento.rows,
      topFiliais:       topFiliais.rows,
    });
  } catch (err) {
    console.error("relatorios error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Criar requisição pública ─────────────────────────────────────────────────
export const criarRequisicaoPublica = async (req, res) => {
  const {
    nome_solicitante, contacto, filial_id,
    departamento_id, descricao, valor, observacoes, itens = []
  } = req.body;

  if (!nome_solicitante || !descricao || !valor || !filial_id)
    return res.status(400).json({
      success: false,
      error: "Nome, descrição, valor e filial são obrigatórios"
    });

  try {
    const result = await query(`
      INSERT INTO requisicoes
        (filial_id, departamento_id, descricao, valor, observacoes, status,
         nome_solicitante, contacto_solicitante)
      VALUES ($1, $2, $3, $4, $5, 'Em Espera', $6, $7)
      RETURNING *
    `, [filial_id, departamento_id || null, descricao, valor, observacoes,
        nome_solicitante, contacto || null]);

    const requisicao = result.rows[0];

    for (const item of itens) {
      if (item.descricao) {
        await query(`
          INSERT INTO requisicao_itens (requisicao_id, descricao, quantidade, valor_unitario)
          VALUES ($1, $2, $3, $4)
        `, [requisicao.id, item.descricao, item.quantidade || 1, item.valor_unitario || 0]);
      }
    }

    await query(`
      INSERT INTO requisicao_historico
        (requisicao_id, status_anterior, status_novo, observacao)
      VALUES ($1, null, 'Em Espera', $2)
    `, [requisicao.id, `Submetido por ${nome_solicitante} — Contacto: ${contacto || "—"}`]);

    const { nomeFilial, nomeDepartamento } = await buscarNomesFilialDep(filial_id, departamento_id);

    enviarEmailRequisicao({ requisicao, nomeFilial, nomeDepartamento })
      .catch((err) => console.error("Erro ao enviar email:", err.message));

    res.status(201).json({
      success: true,
      codigo:  requisicao.codigo,
      message: "Requisição submetida com sucesso"
    });
  } catch (err) {
    console.error("criarRequisicaoPublica error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};