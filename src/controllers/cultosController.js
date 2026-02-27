import { query } from "../config/db.js";
import csv from "csv-parser";
import { Readable } from "stream";

// ── Criar culto ──────────────────────────────────────────────────────────────
export const criarCulto = async (req, res) => {
  const { branch_id, data, tipo, categoria, pregador, horario } = req.body;
  try {
    const result = await query(
      `INSERT INTO cultos (branch_id, data, tipo, categoria, pregador, horario)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [branch_id, data, tipo, categoria || "Culto", pregador, horario]
    );
    res.status(201).json({ success: true, culto: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Listar cultos ────────────────────────────────────────────────────────────
export const listarCultos = async (req, res) => {
  try {
    const result = await query(`
      SELECT c.*, b.nome as nome_branch,
        (SELECT COUNT(*) FROM frequencias f WHERE f.culto_id = c.id AND f.presente = true) as total_presentes
      FROM cultos c
      LEFT JOIN branches b ON c.branch_id = b.id
      ORDER BY c.data DESC
    `);
    res.json({ success: true, cultos: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Obter culto por ID ───────────────────────────────────────────────────────
export const obterCulto = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query(
      `SELECT c.*, b.nome as nome_branch FROM cultos c
       LEFT JOIN branches b ON c.branch_id = b.id
       WHERE c.id = $1`,
      [id]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, error: "Culto não encontrado" });
    res.json({ success: true, culto: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Apagar culto ─────────────────────────────────────────────────────────────
export const apagarCulto = async (req, res) => {
  const { id } = req.params;
  try {
    await query("DELETE FROM cultos WHERE id = $1", [id]);
    res.json({ success: true, message: "Culto apagado com sucesso" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Salvar presenças ─────────────────────────────────────────────────────────
export const salvarPresencas = async (req, res) => {
  const { id: culto_id } = req.params;
  const { presencas } = req.body;
  // presencas: [{ membro_id, presente, observacao }]
  try {
    for (const p of presencas) {
      await query(
        `INSERT INTO frequencias (membro_id, culto_id, presente, observacao)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (membro_id, culto_id)
         DO UPDATE SET presente = $3, observacao = $4`,
        [p.membro_id, culto_id, p.presente, p.observacao || null]
      );
    }

    // Atualiza total_presentes no culto
    await query(
      `UPDATE cultos SET total_presentes = (
        SELECT COUNT(*) FROM frequencias WHERE culto_id = $1 AND presente = true
       ) WHERE id = $1`,
      [culto_id]
    );

    res.json({ success: true, message: "Presenças guardadas com sucesso" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Obter presenças do culto ─────────────────────────────────────────────────
export const obterPresencas = async (req, res) => {
  const { id: culto_id } = req.params;
  try {
    // Todos os membros activos com a sua presença neste culto
    const result = await query(`
      SELECT
        m.id as membro_id,
        m.nome as nome_membro, 
        m.contacto,
        m.codigo,
        b.nome as nome_branch,
        COALESCE(f.presente, false) as presente,
        f.observacao
      FROM membros m
      LEFT JOIN branches b ON m.branch_id = b.id
      LEFT JOIN frequencias f ON f.membro_id = m.id AND f.culto_id = $1
      WHERE m.ativo = true
      ORDER BY m.nome ASC
    `, [culto_id]);

    const presentes  = result.rows.filter((r) => r.presente === true).length;
    const ausentes   = result.rows.filter((r) => r.presente === false).length;
    const total      = result.rows.length;
    const percentagem = total > 0 ? ((presentes / total) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      stats: { total, presentes, ausentes, percentagem },
      membros: result.rows,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Importar CSV ─────────────────────────────────────────────────────────────
export const importarCSV = async (req, res) => {
  const { id: culto_id } = req.params;
  if (!req.file)
    return res.status(400).json({ success: false, error: "Nenhum ficheiro enviado" });

  try {
    const resultados = [];
    const stream = Readable.from(req.file.buffer.toString());

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on("data", (row) => resultados.push(row))
        .on("end", resolve)
        .on("error", reject);
    });

    // CSV esperado: codigo,presente (true/false)
    let importados = 0;
    for (const row of resultados) {
      const codigo   = row.codigo?.trim();
      const presente = row.presente?.trim().toLowerCase() === "true";

      const membro = await query(
        "SELECT id FROM membros WHERE codigo = $1",
        [codigo]
      );

      if (membro.rows.length) {
        await query(
          `INSERT INTO frequencias (membro_id, culto_id, presente)
           VALUES ($1, $2, $3)
           ON CONFLICT (membro_id, culto_id)
           DO UPDATE SET presente = $3`,
          [membro.rows[0].id, culto_id, presente]
        );
        importados++;
      }
    }

    // Atualiza total_presentes
    await query(
      `UPDATE cultos SET total_presentes = (
        SELECT COUNT(*) FROM frequencias WHERE culto_id = $1 AND presente = true
       ) WHERE id = $1`,
      [culto_id]
    );

    res.json({ success: true, message: `${importados} presenças importadas com sucesso` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};