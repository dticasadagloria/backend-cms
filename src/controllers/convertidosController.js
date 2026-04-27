import { query } from "../config/db.js";
import { logActivity } from "../helpers/logActivity.js";

// ── Registar convertido ──────────────────────────────────────────────────────
export const registarConvertido = async (req, res) => {
  const { nome, contacto, bairro, culto_id } = req.body;
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;
  const filial  = isAdmin ? (req.body.branch_id || branch_id) : branch_id;

  if (!nome) return res.status(400).json({ success: false, error: "Nome é obrigatório" });

  try {
    const result = await query(`
      INSERT INTO novos_convertidos (nome, contacto, bairro, culto_id, branch_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [nome, contacto, bairro, culto_id, filial]);

    const convertido = result.rows[0];
    await logActivity(req, {
      action:       "CREATE",
      entity_type:  "convertido",
      entity_id:    convertido.id,
      entity_label: convertido.nome,
      new_values:   convertido,
      description:  `Registou o novo convertido ${convertido.nome}`,
    });
    res.status(201).json({ success: true, convertido });
  } catch (err) {
    console.error("registarConvertido error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Listar convertidos ───────────────────────────────────────────────────────
export const listarConvertidos = async (req, res) => {
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;
  const { culto_id, mes } = req.query;

  try {
    let conditions = isAdmin ? [] : [`nc.branch_id = $1`];
    let params     = isAdmin ? [] : [branch_id];
    let idx        = params.length + 1;

    if (culto_id) { conditions.push(`nc.culto_id = $${idx++}`); params.push(culto_id); }
    if (mes)      { conditions.push(`TO_CHAR(nc.data_conversao, 'YYYY-MM') = $${idx++}`); params.push(mes); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await query(`
      SELECT
        nc.*,
        c.tipo   as tipo_culto,
        TO_CHAR(c.data, 'DD/MM/YYYY') as data_culto,
        b.nome   as nome_branch
      FROM novos_convertidos nc
      LEFT JOIN cultos   c ON nc.culto_id  = c.id
      LEFT JOIN branches b ON nc.branch_id = b.id
      ${where}
      ORDER BY nc.criado_em DESC
    `, params);

    res.json({ success: true, convertidos: result.rows, total: result.rowCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Apagar convertido ────────────────────────────────────────────────────────
export const apagarConvertido = async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await query(`SELECT nome FROM novos_convertidos WHERE id = $1`, [id]);
    await query(`DELETE FROM novos_convertidos WHERE id = $1`, [id]);
    const nome = existing.rows[0]?.nome ?? `ID ${id}`;
    await logActivity(req, {
      action:       "DELETE",
      entity_type:  "convertido",
      entity_id:    parseInt(id),
      entity_label: nome,
      description:  `Apagou o convertido ${nome}`,
    });
    res.json({ success: true, message: "Convertido apagado com sucesso" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Stats gerais ─────────────────────────────────────────────────────────────
export const statsConvertidos = async (req, res) => {
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;

  try {
    const where = isAdmin ? "" : "WHERE nc.branch_id = $1";
    const params = isAdmin ? [] : [branch_id];

    const result = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN TO_CHAR(nc.data_conversao, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM') THEN 1 END) as este_mes
      FROM novos_convertidos nc
      ${where}
    `, params);

    res.json({ success: true, stats: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};