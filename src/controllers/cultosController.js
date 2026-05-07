import { query } from "../config/db.js";
import csv from "csv-parser";
import { Readable } from "stream";
import { logActivity } from "../helpers/logActivity.js";



function branchScope(user) {
  const isAdmin = user.role_id === 1 || user.role_id === 2;
  return {
    isAdmin,
    filter:        isAdmin ? '' : 'AND c.branch_id = $1',   // para queries com cultos
    filterMembro:  isAdmin ? '' : 'AND m.branch_id = $1',   // para queries com membros
    params:        isAdmin ? [] : [user.branch_id],
  };
}

// ── Criar culto ──────────────────────────────────────────────────────────────
export const criarCulto = async (req, res) => {
  const { data, tipo, categoria, pregador, horario, inter_filial, tipo_registo } = req.body;
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;
  const filial  = isAdmin ? (req.body.branch_id || branch_id) : branch_id;

  try {
    const result = await query(`
      INSERT INTO cultos (branch_id, data, tipo, categoria, pregador, horario, inter_filial, tipo_registo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [filial, data, tipo, categoria || "Culto", pregador, horario, inter_filial || false, tipo_registo || "presencas"]);

    const culto = result.rows[0];
    await logActivity(req, {
      action:       "CREATE",
      entity_type:  "culto",
      entity_id:    culto.id,
      entity_label: `${culto.tipo} – ${culto.data}`,
      new_values:   culto,
      description:  `Criou o culto ${culto.tipo} em ${new Date(culto.data).toLocaleDateString("pt-MZ")}`,
    });
    res.status(201).json({ success: true, culto });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Listar cultos ────────────────────────────────────────────────────────────
export const listarCultos = async (req, res) => {
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;
  const { tipo_registo } = req.query;

  try {
    let conditions = isAdmin ? [] : [`c.branch_id = $1`];
    let params     = isAdmin ? [] : [branch_id];
    let idx        = params.length + 1;

    if (tipo_registo) {
      conditions.push(`c.tipo_registo = $${idx++}`);
      params.push(tipo_registo);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await query(`
      SELECT c.*, b.nome as nome_branch,
        (SELECT COUNT(*) FROM frequencias f WHERE f.culto_id = c.id AND f.presente = true) as total_presentes
      FROM cultos c
      LEFT JOIN branches b ON c.branch_id = b.id
      ${where}
      ORDER BY c.data DESC
    `, params);

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
      `SELECT c.*,c.inter_filial, b.nome as nome_branch FROM cultos c
       LEFT JOIN branches b ON c.branch_id = b.id
       WHERE c.id = $1`,
      [id],
    );
    if (!result.rows.length)
      return res
        .status(404)
        .json({ success: false, error: "Culto não encontrado" });
    res.json({ success: true, culto: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};


//Editar culto
export const actualizarCulto = async (req, res) => {
  const { id } = req.params;
  const { data, tipo, categoria, pregador, horario, branch_id, inter_filial, tipo_registo } = req.body;

  try {
    const result = await query(`
      UPDATE cultos
      SET data = $1, tipo = $2, categoria = $3, pregador = $4,
          horario = $5, branch_id = $6, inter_filial = $7, tipo_registo = $8
      WHERE id = $9
      RETURNING *
    `, [data, tipo, categoria, pregador, horario, branch_id, inter_filial, tipo_registo || "presencas", id]);

    if (!result.rows.length)
      return res.status(404).json({ success: false, error: "Culto não encontrado" });

    const culto = result.rows[0];
    await logActivity(req, {
      action:       "UPDATE",
      entity_type:  "culto",
      entity_id:    parseInt(id),
      entity_label: `${culto.tipo} – ${culto.data}`,
      new_values:   culto,
      description:  `Actualizou o culto ${culto.tipo} (ID ${id})`,
    });
    res.json({ success: true, culto });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};


// ── Apagar culto ─────────────────────────────────────────────────────────────
export const apagarCulto = async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await query("SELECT tipo, data FROM cultos WHERE id = $1", [id]);
    await query("DELETE FROM cultos WHERE id = $1", [id]);
    const c = existing.rows[0];
    await logActivity(req, {
      action:       "DELETE",
      entity_type:  "culto",
      entity_id:    parseInt(id),
      entity_label: c ? `${c.tipo} – ${c.data}` : `ID ${id}`,
      description:  `Apagou o culto ${c?.tipo ?? ""} (ID ${id})`,
    });
    res.json({ success: true, message: "Culto apagado com sucesso" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Salvar presenças ─────────────────────────────────────────────────────────
export const salvarPresencas = async (req, res) => {
  const { id: culto_id } = req.params;
  const { presencas }    = req.body;

  try {
    const presentes = presencas.filter((p) => p.presente === true);
    const ausentes  = presencas.filter((p) => p.presente === false);

    if (presentes.length > 0) {
      await query(`
        INSERT INTO frequencias (membro_id, culto_id, presente)
        SELECT UNNEST($1::int[]), $2, true
        ON CONFLICT (membro_id, culto_id)
        DO UPDATE SET presente = true
      `, [presentes.map((p) => p.membro_id), culto_id]);
    }

    if (ausentes.length > 0) {
      await query(`
        INSERT INTO frequencias (membro_id, culto_id, presente)
        SELECT UNNEST($1::int[]), $2, false
        ON CONFLICT (membro_id, culto_id) DO NOTHING
      `, [ausentes.map((p) => p.membro_id), culto_id]);
    }

    await query(`
      UPDATE cultos SET total_presentes = (
        SELECT COUNT(*) FROM frequencias WHERE culto_id = $1 AND presente = true
      ) WHERE id = $1
    `, [culto_id]);

    res.json({ success: true, message: "Presenças guardadas com sucesso" });
  } catch (err) {
    console.error("salvarPresencas error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Obter presenças do culto ─────────────────────────────────────────────────
export const obterPresencas = async (req, res) => {
  const { id: culto_id } = req.params;
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;

  try {
    const cultoInfo = await query(
      `SELECT branch_id, inter_filial, tipo_registo FROM cultos WHERE id = $1`, [culto_id]
    );

    if (!cultoInfo.rows.length)
      return res.status(404).json({ success: false, error: "Culto não encontrado" });

    const { inter_filial, branch_id: cultoBranch, tipo_registo } = cultoInfo.rows[0];

    if (tipo_registo === "visitantes")
      return res.status(400).json({
        success: false,
        error: "Este culto é para visitantes — usa o módulo de Visitantes.",
        tipo_registo: "visitantes",
      });

    if (!isAdmin && cultoBranch !== branch_id)
      return res.status(403).json({ success: false, error: "Sem permissão para este culto" });

    // Se inter_filial = true, busca membros de TODAS as filiais
    // Se não, só os da filial do culto
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
      ${inter_filial ? "" : "WHERE m.branch_id = $2"}
      ORDER BY b.nome ASC, m.nome ASC
    `, inter_filial ? [culto_id] : [culto_id, cultoBranch]);

    const presentes   = result.rows.filter((r) => r.presente === true).length;
    const ausentes    = result.rows.filter((r) => r.presente === false).length;
    const total       = result.rows.length;
    const percentagem = total > 0 ? ((presentes / total) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      inter_filial,
      tipo_registo,
      stats: { total, presentes, ausentes, percentagem },
      membros: result.rows,
    });
  } catch (err) {
    console.error("obterPresencas error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Importar CSV ─────────────────────────────────────────────────────────────
export const importarCSV = async (req, res) => {
  const { id: culto_id } = req.params;
  if (!req.file)
    return res.status(400).json({ success: false, error: "Nenhum ficheiro enviado" });

  try {
    const conteudo = req.file.buffer.toString();
    const primeiraLinha = conteudo.split("\n")[0];
const separador = primeiraLinha.includes("\t") ? "\t" 
                : primeiraLinha.includes(";") ? ";" 
                : ",";

    console.log("Primeira linha raw:", primeiraLinha);
    console.log("Separador detectado:", separador);

    const resultados = [];
    const stream = Readable.from(conteudo);

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv({ separator: separador }))
        .on("data", (row) => resultados.push(row))
        .on("end", resolve)
        .on("error", reject);
    });

    console.log("Primeira linha parseada:", resultados[0]);
    console.log("Chaves:", Object.keys(resultados[0] || {}));

    let importados = 0;
    for (const row of resultados) {
      const codigo   = row.codigo?.trim().replace(/\r/g, "");
      const presente = row.presente?.trim().toLowerCase() === "true";

      console.log(`Código: "${codigo}" | Presente: ${presente}`);

      const membro = await query(
        "SELECT id FROM membros WHERE codigo = $1", [codigo]
      );

      console.log(`Membro encontrado:`, membro.rows);

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

    await query(
      `UPDATE cultos SET total_presentes = (
        SELECT COUNT(*) FROM frequencias WHERE culto_id = $1 AND presente = true
       ) WHERE id = $1`,
      [culto_id]
    );

    res.json({ success: true, message: `${importados} presenças importadas com sucesso` });
  } catch (err) {
    console.error("importarCSV error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};



// ── Estatísticas gerais ──────────────────────────────────────────────────────
export const estatisticasGerais = async (req, res) => {
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;

  try {
    // Filtra por branch se não for admin
    const branchFilter = isAdmin ? '' : 'WHERE branch_id = $1';
    const branchParams = isAdmin ? [] : [branch_id];

    const totalCultos = await query(
      `SELECT COUNT(*) as total FROM cultos ${branchFilter}`,
      branchParams
    );

    const totalPresencas = await query(
      `SELECT COUNT(*) as total FROM frequencias f
       JOIN cultos c ON c.id = f.culto_id
       ${isAdmin ? '' : 'WHERE c.branch_id = $1'}
       AND f.presente = true`,
      branchParams
    );

    const totalMembros = await query(
      `SELECT COUNT(*) as total FROM membros
       ${isAdmin ? '' : 'WHERE branch_id = $1'}
       AND ativo = true`,
      branchParams
    );

    const mediaPorCulto = await query(
      `SELECT ROUND(AVG(total_presentes), 1) as media
       FROM cultos
       WHERE total_presentes > 0
       ${isAdmin ? '' : 'AND branch_id = $1'}`,
      branchParams
    );

    res.json({
      success: true,
      stats: {
        totalCultos: parseInt(totalCultos.rows[0].total),
        totalPresencas: parseInt(totalPresencas.rows[0].total),
        totalMembros: parseInt(totalMembros.rows[0].total),
        mediaPorCulto: parseFloat(mediaPorCulto.rows[0]?.media) || 0,
      },
    });
  } catch (err) {
    console.error('[estatisticasGerais]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Presenças por mês ────────────────────────────────────────────────────────
export const presencasPorMes = async (req, res) => {
  const { filter, params } = branchScope(req.user);
  try {
    const result = await query(`
      SELECT
        TO_CHAR(c.data, 'Mon YYYY')  AS mes,
        TO_CHAR(c.data, 'YYYY-MM')   AS mes_ordem,
        COUNT(DISTINCT c.id)                                          AS total_cultos,
        SUM(CASE WHEN f.presente = true  THEN 1 ELSE 0 END)          AS presentes,
        SUM(CASE WHEN f.presente = false THEN 1 ELSE 0 END)          AS ausentes,
        COUNT(f.id)                                                   AS total_registos,
        ROUND(
          SUM(CASE WHEN f.presente = true THEN 1 ELSE 0 END)::numeric
          / NULLIF(COUNT(f.id), 0) * 100, 1
        ) AS taxa_presenca
      FROM cultos c
      LEFT JOIN frequencias f ON f.culto_id = c.id
      WHERE 1=1 ${filter}
      GROUP BY TO_CHAR(c.data, 'Mon YYYY'), TO_CHAR(c.data, 'YYYY-MM')
      ORDER BY mes_ordem ASC
    `, params);
 
    res.json({ success: true, dados: result.rows });
  } catch (err) {
    console.error('[presencasPorMes]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
 
// ── Presenças por culto ──────────────────────────────────────────────────────
export const presencasPorCulto = async (req, res) => {
  const { filter, params } = branchScope(req.user);
  try {
    const result = await query(`
      SELECT
        c.id,
        c.tipo,
        c.data,
        TO_CHAR(c.data, 'DD/MM')  AS data_curta,
        c.pregador,
        COUNT(CASE WHEN f.presente = true  THEN 1 END) AS presentes,
        COUNT(CASE WHEN f.presente = false THEN 1 END) AS ausentes,
        COUNT(f.id)                                    AS total,
        ROUND(
          COUNT(CASE WHEN f.presente = true THEN 1 END)::numeric
          / NULLIF(COUNT(f.id), 0) * 100, 1
        ) AS taxa_presenca
      FROM cultos c
      LEFT JOIN frequencias f ON f.culto_id = c.id
      WHERE 1=1 ${filter}
      GROUP BY c.id, c.tipo, c.data, c.pregador
      ORDER BY c.data DESC
      LIMIT 10
    `, params);
 
    res.json({ success: true, dados: result.rows });
  } catch (err) {
    console.error('[presencasPorCulto]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
 
// ── Top 10 membros mais assíduos ─────────────────────────────────────────────
export const maisAssiduos = async (req, res) => {
  const { isAdmin, filterMembro, params } = branchScope(req.user);
  try {
    const result = await query(`
      SELECT
        m.id,
        m.nome              AS nome_membro,
        b.nome              AS nome_branch,
        COUNT(f.id)         AS total_presencas
      FROM membros m
      LEFT JOIN branches   b ON b.id = m.branch_id
      LEFT JOIN frequencias f ON f.membro_id = m.id AND f.presente = true
      WHERE m.ativo = true ${filterMembro}
      GROUP BY m.id, m.nome, b.nome
      ORDER BY total_presencas DESC
      LIMIT 10
    `, params);
 
    res.json({ success: true, dados: result.rows });
  } catch (err) {
    console.error('[maisAssiduos]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
 
// ── Top 10 membros com mais faltas ───────────────────────────────────────────
export const maisFaltas = async (req, res) => {
  const { filterMembro, params } = branchScope(req.user);
  try {
    const result = await query(`
      SELECT
        m.id,
        m.nome              AS nome_membro,
        b.nome              AS nome_branch,
        COUNT(f.id)         AS total_faltas
      FROM membros m
      LEFT JOIN branches   b ON b.id = m.branch_id
      LEFT JOIN frequencias f ON f.membro_id = m.id AND f.presente = false
      WHERE m.ativo = true ${filterMembro}
      GROUP BY m.id, m.nome, b.nome
      ORDER BY total_faltas DESC
      LIMIT 10
    `, params);
 
    res.json({ success: true, dados: result.rows });
  } catch (err) {
    console.error('[maisFaltas]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
 
// ── Top 10 cultos com maior afluência ────────────────────────────────────────
export const melhorCulto = async (req, res) => {
  const { filter, params } = branchScope(req.user);
  try {
    const result = await query(`
      SELECT
        c.id,
        c.tipo,
        TO_CHAR(c.data, 'DD/MM/YYYY') AS data_curta,
        c.pregador,
        COUNT(CASE WHEN f.presente = true THEN 1 END) AS presentes
      FROM cultos c
      LEFT JOIN frequencias f ON f.culto_id = c.id
      WHERE 1=1 ${filter}
      GROUP BY c.id, c.tipo, c.data, c.pregador
      ORDER BY presentes DESC
      LIMIT 10
    `, params);
 
    res.json({ success: true, dados: result.rows });
  } catch (err) {
    console.error('[melhorCulto]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};