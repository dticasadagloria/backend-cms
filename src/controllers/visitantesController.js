import { query } from "../config/db.js";

// ── Registar visitante ───────────────────────────────────────────────────────
export const registarVisitante = async (req, res) => {
  const {
    nome, genero, idade, contacto, bairro,
    culto_id, branch_id, externo, igreja_origem, observacoes
  } = req.body;

  try {
    const result = await query(`
      INSERT INTO visitantes
        (nome, genero, idade, contacto, bairro, culto_id, branch_id, externo, igreja_origem, observacoes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [nome, genero, idade, contacto, bairro, culto_id, branch_id,
        externo ?? true, igreja_origem, observacoes]);

    res.status(201).json({ success: true, visitante: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Listar todos os visitantes ───────────────────────────────────────────────
export const listarVisitantes = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        v.*,
        c.tipo as tipo_culto,
        TO_CHAR(c.data, 'DD/MM/YYYY') as data_culto,
        b.nome as nome_branch
      FROM visitantes v
      LEFT JOIN cultos c ON v.culto_id = c.id
      LEFT JOIN branches b ON v.branch_id = b.id
      ORDER BY v.data__visita DESC
    `);
    res.json({ success: true, visitantes: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Visitantes por culto ─────────────────────────────────────────────────────
export const visitantesPorCulto = async (req, res) => {
  const { culto_id } = req.params;
  try {
    const result = await query(`
      SELECT v.*, b.nome as nome_branch
      FROM visitantes v
      LEFT JOIN branches b ON v.branch_id = b.id
      WHERE v.culto_id = $1
      ORDER BY v.nome ASC
    `, [culto_id]);

    res.json({ success: true, visitantes: result.rows, total: result.rowCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Apagar visitante ─────────────────────────────────────────────────────────
export const apagarVisitante = async (req, res) => {
  const { id } = req.params;
  try {
    await query("DELETE FROM visitantes WHERE id = $1", [id]);
    res.json({ success: true, message: "Visitante apagado com sucesso" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Converter visitante em membro ────────────────────────────────────────────
export const converterEmMembro = async (req, res) => {
  const { id } = req.params;
  const {
    codigo, ano_ingresso, branch_id,
    estado_civil, ocupacao, batizado, escola_da_verdade
  } = req.body;

  try {
    // Busca dados do visitante
    const visitante = await query(
      "SELECT * FROM visitantes WHERE id = $1", [id]
    );

    if (!visitante.rows.length)
      return res.status(404).json({ success: false, error: "Visitante não encontrado" });

    const v = visitante.rows[0];

    // Cria o membro
    const novoMembro = await query(`
      INSERT INTO membros
        (nome_membro, genero, contacto, bairro, branch_id, codigo,
         ano_ingresso, estado_civil, ocupacao, batizado, escola_da_verdade, ativo)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
      RETURNING *
    `, [v.nome, v.genero, v.contacto, v.bairro,
        branch_id || v.branch_id, codigo, ano_ingresso,
        estado_civil, ocupacao, batizado ?? false,
        escola_da_verdade ?? "Nao frequenta"]);

    // Liga o visitante ao novo membro
    await query(
      "UPDATE visitantes SET membro_id = $1, externo = false WHERE id = $2",
      [novoMembro.rows[0].id, id]
    );

    res.json({ success: true, membro: novoMembro.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Relatório mensal ─────────────────────────────────────────────────────────
export const relatorioMensal = async (req, res) => {
  try {
    // Visitantes por mês
    const porMes = await query(`
      SELECT
        TO_CHAR(data__visita, 'Mon YYYY') as mes,
        TO_CHAR(data__visita, 'YYYY-MM')  as mes_ordem,
        COUNT(*)                          as total,
        COUNT(CASE WHEN externo = true  THEN 1 END) as externos,
        COUNT(CASE WHEN externo = false THEN 1 END) as internos
      FROM visitantes
      GROUP BY TO_CHAR(data__visita, 'Mon YYYY'), TO_CHAR(data__visita, 'YYYY-MM')
      ORDER BY mes_ordem ASC
    `);

    // Visitantes por culto
    const porCulto = await query(`
      SELECT
        c.tipo,
        TO_CHAR(c.data, 'DD/MM/YYYY') as data_culto,
        COUNT(v.id) as total_visitantes
      FROM cultos c
      LEFT JOIN visitantes v ON v.culto_id = c.id
      GROUP BY c.id, c.tipo, c.data
      ORDER BY c.data DESC
      LIMIT 10
    `);

    // Stats gerais
    const stats = await query(`
      SELECT
        COUNT(*)                                    as total,
        COUNT(CASE WHEN externo = true  THEN 1 END) as externos,
        COUNT(CASE WHEN externo = false THEN 1 END) as internos,
        COUNT(CASE WHEN membro_id IS NOT NULL THEN 1 END) as convertidos
      FROM visitantes
    `);

    res.json({
      success: true,
      stats:    stats.rows[0],
      porMes:   porMes.rows,
      porCulto: porCulto.rows,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};