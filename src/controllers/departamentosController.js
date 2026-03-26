import { query } from "../config/db.js";

// ── Listar todos os departamentos ────────────────────────────────────────────
export const listarDepartamentos = async (req, res) => {
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;

  try {
    const result = isAdmin
      ? await query(`
          SELECT d.*, b.nome as nome_branch,
            TO_CHAR(d.data_inicio, 'DD/MM/YYYY') as data_inicio_formatada,
            TO_CHAR(d.data_fim, 'DD/MM/YYYY') as data_fim_formatada,
            CASE WHEN d.data_fim IS NULL OR d.data_fim >= CURRENT_DATE THEN true ELSE false END as activo
          FROM departamentos d
          LEFT JOIN branches b ON d.branch_id = b.id
          ORDER BY d.nome ASC
        `)
      : await query(`
          SELECT d.*, b.nome as nome_branch,
            TO_CHAR(d.data_inicio, 'DD/MM/YYYY') as data_inicio_formatada,
            TO_CHAR(d.data_fim, 'DD/MM/YYYY') as data_fim_formatada,
            CASE WHEN d.data_fim IS NULL OR d.data_fim >= CURRENT_DATE THEN true ELSE false END as activo
          FROM departamentos d
          LEFT JOIN branches b ON d.branch_id = b.id
          WHERE d.branch_id = $1
          ORDER BY d.nome ASC
        `, [branch_id]);

    res.json({ success: true, departamentos: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Stats gerais ─────────────────────────────────────────────────────────────
export const totalDepartamentos = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*)                                                        as total,
        COUNT(CASE WHEN data_fim IS NULL OR data_fim >= CURRENT_DATE THEN 1 END) as activos,
        COUNT(CASE WHEN data_fim < CURRENT_DATE THEN 1 END)            as encerrados
      FROM departamentos
    `);

    res.json({ success: true, stats: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};