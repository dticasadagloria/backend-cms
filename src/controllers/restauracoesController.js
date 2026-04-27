import pool from "../config/db.js";
import { logActivity } from "../helpers/logActivity.js";

// Registar nova restauração
export const criarRestauracao = async (req, res) => {
  try {
    const { membro_id, motivo, observacoes } = req.body;

    const membro = await pool.query("SELECT codigo, nome FROM membros WHERE id = $1", [membro_id]);
    if (membro.rows.length === 0) return res.status(404).json({ message: "Membro não encontrado" });

    const { codigo: codigo_membro, nome: nome_membro } = membro.rows[0];

    const result = await pool.query(
      `INSERT INTO restauracoes (membro_id, codigo_membro, motivo, observacoes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [membro_id, codigo_membro, motivo, observacoes]
    );

    const restauracao = result.rows[0];
    await logActivity(req, {
      action:       "CREATE",
      entity_type:  "restauracao",
      entity_id:    restauracao.id,
      entity_label: nome_membro,
      new_values:   { motivo, observacoes },
      description:  `Iniciou restauração para o membro ${nome_membro}`,
    });

    res.status(201).json({ message: "Restauração iniciada com sucesso", data: restauracao });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Listar todas as restaurações
export const listarRestauracoes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        r.id,
        m.nome AS nome_membro,
        r.codigo_membro,
        r.data_inicio,
        r.data_fim,
        r.status,
        r.motivo,
        r.observacoes
      FROM restauracoes r
      JOIN membros m ON r.membro_id = m.id
      ORDER BY r.data_inicio DESC;
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Atualizar status
export const atualizarStatusRestauracao = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, observacoes } = req.body;

    const anterior = await pool.query("SELECT status, membro_id FROM restauracoes WHERE id = $1", [id]);
    if (!anterior.rows.length) return res.status(404).json({ message: "Restauração não encontrada" });

    const status_anterior = anterior.rows[0].status;
    const membro_id       = anterior.rows[0].membro_id;

    const nomeResult = await pool.query("SELECT nome FROM membros WHERE id = $1", [membro_id]);
    const nome_membro = nomeResult.rows[0]?.nome ?? `Membro #${membro_id}`;

    let data_fim = null;
    if (status === "Concluído") data_fim = new Date();

    const result = await pool.query(
      `UPDATE restauracoes
       SET status = $1, observacoes = COALESCE($2, observacoes), data_fim = $3
       WHERE id = $4
       RETURNING *`,
      [status, observacoes, data_fim, id]
    );

    await logActivity(req, {
      action:       "STATUS_CHANGE",
      entity_type:  "restauracao",
      entity_id:    parseInt(id),
      entity_label: nome_membro,
      old_values:   { status: status_anterior },
      new_values:   { status },
      description:  `Actualizou restauração de ${nome_membro}: ${status_anterior} → ${status}`,
    });

    res.json({ message: "Status atualizado com sucesso", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
