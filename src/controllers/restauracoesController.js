import pool from "../config/db.js";

// 📌 Registrar nova restauração
export const criarRestauracao = async (req, res) => {
  try {
    const { membro_id, motivo, observacoes } = req.body;

    // Buscar o código do membro automaticamente
    const membro = await pool.query("SELECT codigo FROM membros WHERE id = $1", [membro_id]);
    if (membro.rows.length === 0) return res.status(404).json({ message: "Membro não encontrado" });

    const codigo_membro = membro.rows[0].codigo;

    const result = await pool.query(
      `INSERT INTO restauracoes (membro_id, codigo_membro, motivo, observacoes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [membro_id, codigo_membro, motivo, observacoes]
    );

    res.status(201).json({ message: "Restauração iniciada com sucesso", data: result.rows[0] });
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

// Atualizar status (ex: concluir restauração)
export const atualizarStatusRestauracao = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, observacoes } = req.body;

    let data_fim = null;
    if (status === "Concluído") data_fim = new Date();

    const result = await pool.query(
      `UPDATE restauracoes 
       SET status = $1, observacoes = COALESCE($2, observacoes), data_fim = $3
       WHERE id = $4
       RETURNING *`,
      [status, observacoes, data_fim, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ message: "Restauração não encontrada" });

    res.json({ message: "Status atualizado com sucesso", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};