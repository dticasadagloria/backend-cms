import { query } from "../config/db.js";
import cloudinary from "../config/cloudinary.js";
import { logActivity } from "../helpers/logActivity.js";

// ── Criar requisição ─────────────────────────────────────────────────────────
export const criarRequisicao = async (req, res) => {
  const { departamento_id, lider_solicitante_id, descricao, valor, observacoes, itens = [] } = req.body;
  const { role_id, branch_id, id: criado_por } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;

  const filial = isAdmin ? (req.body.filial_id || branch_id) : branch_id;

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
      INSERT INTO requisicao_historico (requisicao_id, status_anterior, status_novo, alterado_por, observacao)
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
        COALESCE(m.nome_membro, r.nome_solicitante)        AS nome_solicitante,
        r.contacto_solicitante,
        u.username                                          AS criado_por_nome
      FROM requisicoes r
      LEFT JOIN branches     b ON r.filial_id            = b.id
      LEFT JOIN departamentos d ON r.departamento_id     = d.id
      LEFT JOIN membros       m ON r.lider_solicitante_id = m.id
      LEFT JOIN usuarios      u ON r.criado_por           = u.id
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
        COALESCE(m.nome_membro, r.nome_solicitante)    AS nome_solicitante,
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
      LEFT JOIN usuarios u ON h.alterado_por = u.id
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
      success:         true,
      stats:           stats.rows[0],
      porMes:          porMes.rows,
      porFilial:       porFilial.rows,
      porDepartamento: porDepartamento.rows,
      topFiliais:      topFiliais.rows,
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
        nome_solicitante || null, contacto || null]);

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