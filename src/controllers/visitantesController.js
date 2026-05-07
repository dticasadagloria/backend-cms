import { query } from "../config/db.js";
import { logActivity } from "../helpers/logActivity.js";

// ── Registar visitante ───────────────────────────────────────────────────────
export const registarVisitante = async (req, res) => {
  const { nome, genero, faixa_etaria, contacto, bairro, culto_id, externo, igreja_origem, observacoes } = req.body;
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;

  const filial = isAdmin ? (req.body.branch_id || branch_id) : branch_id;

  try {
    const result = await query(`
      INSERT INTO visitantes
        (nome, genero, faixa_etaria, contacto, bairro, culto_id, branch_id, externo, igreja_origem, observacoes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [nome, genero, faixa_etaria, contacto, bairro, culto_id, filial,
        externo ?? true, igreja_origem, observacoes]);

    const visitante = result.rows[0];
    await logActivity(req, {
      action:       "CREATE",
      entity_type:  "visitante",
      entity_id:    visitante.id,
      entity_label: visitante.nome,
      new_values:   visitante,
      description:  `Registou o visitante ${visitante.nome}`,
    });
    res.status(201).json({ success: true, visitante });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
// ── Listar todos os visitantes ───────────────────────────────────────────────
export const listarVisitantes = async (req, res) => {
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;

  try {
    const result = isAdmin
      ? await query(`
          SELECT v.*, c.tipo as tipo_culto,
            TO_CHAR(c.data, 'DD/MM/YYYY') as data_culto,
            b.nome as nome_branch
          FROM visitantes v
          LEFT JOIN cultos c ON v.culto_id = c.id
          LEFT JOIN branches b ON v.branch_id = b.id
          ORDER BY v.data__visita DESC
        `)
      : await query(`
          SELECT v.*, c.tipo as tipo_culto,
            TO_CHAR(c.data, 'DD/MM/YYYY') as data_culto,
            b.nome as nome_branch
          FROM visitantes v
          LEFT JOIN cultos c ON v.culto_id = c.id
          LEFT JOIN branches b ON v.branch_id = b.id
          WHERE v.branch_id = $1
          ORDER BY v.data__visita DESC
        `, [branch_id]);

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

// ── Actualizar visitante ─────────────────────────────────────────────────────
export const actualizarVisitante = async (req, res) => {
  const { id } = req.params;
  const { nome, genero, faixa_etaria, contacto, bairro, culto_id, externo, igreja_origem, observacoes } = req.body;

  try {
    const existing = await query("SELECT id, nome FROM visitantes WHERE id = $1", [id]);
    if (!existing.rows.length)
      return res.status(404).json({ success: false, error: "Visitante não encontrado" });

    const result = await query(`
      UPDATE visitantes
      SET nome = $1, genero = $2, faixa_etaria = $3, contacto = $4,
          bairro = $5, culto_id = $6, externo = $7, igreja_origem = $8, observacoes = $9
      WHERE id = $10
      RETURNING *
    `, [nome, genero, faixa_etaria, contacto, bairro, culto_id,
        externo ?? true, igreja_origem, observacoes, id]);

    const visitante = result.rows[0];
    await logActivity(req, {
      action:       "UPDATE",
      entity_type:  "visitante",
      entity_id:    parseInt(id),
      entity_label: visitante.nome,
      new_values:   visitante,
      description:  `Actualizou o visitante ${visitante.nome}`,
    });
    res.json({ success: true, visitante });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Apagar visitante ─────────────────────────────────────────────────────────
export const apagarVisitante = async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await query("SELECT nome FROM visitantes WHERE id = $1", [id]);
    await query("DELETE FROM visitantes WHERE id = $1", [id]);
    const nome = existing.rows[0]?.nome ?? `ID ${id}`;
    await logActivity(req, {
      action:       "DELETE",
      entity_type:  "visitante",
      entity_id:    parseInt(id),
      entity_label: nome,
      description:  `Apagou o visitante ${nome}`,
    });
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
        (nome, genero, contacto, bairro, branch_id, codigo,
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

    const membro = novoMembro.rows[0];
    await logActivity(req, {
      action:       "STATUS_CHANGE",
      entity_type:  "visitante",
      entity_id:    parseInt(id),
      entity_label: v.nome,
      description:  `Converteu o visitante ${v.nome} em membro`,
    });
    res.json({ success: true, membro });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Relatório mensal ─────────────────────────────────────────────────────────
export const relatorioMensal = async (req, res) => {
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;

  try {
    let porMesRaw, porCultoRaw, statsRaw;

    if (isAdmin) {
      porMesRaw = await query(`
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

      porCultoRaw = await query(`
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

      statsRaw = await query(`
        SELECT
          COUNT(*)                                    as total,
          COUNT(CASE WHEN externo = true  THEN 1 END) as externos,
          COUNT(CASE WHEN externo = false THEN 1 END) as internos,
          COUNT(CASE WHEN membro_id IS NOT NULL THEN 1 END) as convertidos
        FROM visitantes
      `);
    } else {
      porMesRaw = await query(`
        SELECT
          TO_CHAR(data__visita, 'Mon YYYY') as mes,
          TO_CHAR(data__visita, 'YYYY-MM')  as mes_ordem,
          COUNT(*)                          as total,
          COUNT(CASE WHEN externo = true  THEN 1 END) as externos,
          COUNT(CASE WHEN externo = false THEN 1 END) as internos
        FROM visitantes
        WHERE branch_id = $1
        GROUP BY TO_CHAR(data__visita, 'Mon YYYY'), TO_CHAR(data__visita, 'YYYY-MM')
        ORDER BY mes_ordem ASC
      `, [branch_id]);

      porCultoRaw = await query(`
        SELECT
          c.tipo,
          TO_CHAR(c.data, 'DD/MM/YYYY') as data_culto,
          COUNT(v.id) as total_visitantes
        FROM cultos c
        LEFT JOIN visitantes v ON v.culto_id = c.id AND v.branch_id = $1
        WHERE c.branch_id = $1
        GROUP BY c.id, c.tipo, c.data
        ORDER BY c.data DESC
        LIMIT 10
      `, [branch_id]);

      statsRaw = await query(`
        SELECT
          COUNT(*)                                    as total,
          COUNT(CASE WHEN externo = true  THEN 1 END) as externos,
          COUNT(CASE WHEN externo = false THEN 1 END) as internos,
          COUNT(CASE WHEN membro_id IS NOT NULL THEN 1 END) as convertidos
        FROM visitantes
        WHERE branch_id = $1
      `, [branch_id]);
    }

    res.json({
      success: true,
      stats:    statsRaw.rows[0],
      porMes:   porMesRaw.rows,
      porCulto: porCultoRaw.rows,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};