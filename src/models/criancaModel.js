import { query } from '../config/db.js';

// ==================== CRIANÇAS ====================

export const getAllCriancas = async (turma = null) => {
  let text = `
    SELECT 
      c.*, 
      COALESCE(b.nome, 'Sem Branch') AS nome_branch
    FROM criancas c
    LEFT JOIN branches b ON c.branch_id = b.id
    WHERE c.ativo = true
  `;
  const values = [];

  if (turma) {
    text += ` AND c.turma = $1`;
    values.push(turma);
  }

  text += ` ORDER BY c.nome ASC`;

  const res = await query(text, values);
  return res.rows;
};

export const findCriancaById = async (id) => {
  const text = `
    SELECT c.*, COALESCE(b.nome, 'Sem Branch') AS nome_branch
    FROM criancas c
    LEFT JOIN branches b ON c.branch_id = b.id
    WHERE c.id = $1
  `;
  const res = await query(text, [id]);
  return res.rows[0];
};

export const createCrianca = async (data, userId) => {
  // codigo NÃO é enviado aqui de propósito — a geração agora vive na base de
  // dados (trigger trg_gerar_codigo_crianca, ver migrations/criancas_codigo_auto.sql),
  // que corre para QUALQUER insert na tabela `criancas`, não só os feitos pela
  // API. Gerar aqui também (como antes, via gerarProximoCodigo) duplicaria a
  // lógica e reintroduziria o risco de colisão que a sequence na BD evita.
  const text = `
    INSERT INTO criancas (
      nome, genero, idade, turma,
      nome_encarregado, contacto_encarregado, branch_id, observacoes, criado_por
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;
  const values = [
    data.nome,
    data.genero || null,
    data.idade || null,
    data.turma,
    data.nome_encarregado || null,
    data.contacto_encarregado || null,
    data.branch_id || null,
    data.observacoes || null,
    userId,
  ];
  const res = await query(text, values);
  return res.rows[0];
};

// codigo NÃO faz parte do UPDATE de propósito — não é editável (o próprio
// pedido do utilizador). Antes fazia `codigo = data.codigo || null`, o que
// escrevia NULL sempre que o frontend não mandasse codigo — inofensivo
// enquanto a coluna era nullable, mas passaria a violar a constraint NOT
// NULL adicionada em criancas_codigo_auto.sql assim que qualquer edição
// fosse feita. Excluir a coluna do SET evita isto e, ao mesmo tempo, é a
// forma mais robusta de impedir a edição (nem um payload malicioso com
// `codigo` consegue alterá-lo através desta rota).
export const updateCrianca = async (id, data) => {
  const text = `
    UPDATE criancas
    SET
      nome = $1,
      genero = $2,
      idade = $3,
      turma = $4,
      nome_encarregado = $5,
      contacto_encarregado = $6,
      branch_id = $7,
      observacoes = $8
    WHERE id = $9
    RETURNING *
  `;
  const values = [
    data.nome,
    data.genero || null,
    data.idade || null,
    data.turma,
    data.nome_encarregado || null,
    data.contacto_encarregado || null,
    data.branch_id || null,
    data.observacoes || null,
    id,
  ];
  const res = await query(text, values);
  return res.rows[0];
};

export const deactivateCrianca = async (id) => {
  const text = `UPDATE criancas SET ativo = false WHERE id = $1 RETURNING *`;
  const res = await query(text, [id]);
  return res.rows[0];
};

// ==================== AULAS ====================

// Verifica se já existe uma aula igual (mesma data + turma + filial),
// para o controller devolver 409 em vez de duplicar — mesmo padrão de criarCulto.
export const findAulaDuplicada = async (data, turma, branch_id) => {
  const text = `SELECT id FROM aulas WHERE data = $1 AND turma = $2 AND branch_id = $3`;
  const res = await query(text, [data, turma, branch_id]);
  return res.rows[0];
};

export const createAula = async (aula, userId) => {
  const text = `
    INSERT INTO aulas (branch_id, data, horario, turma, tema, professor, observacoes, criado_por)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  const values = [
    aula.branch_id,
    aula.data,
    aula.horario || null,
    aula.turma,
    aula.tema || null,
    aula.professor || null,
    aula.observacoes || null,
    userId,
  ];
  const res = await query(text, values);
  return res.rows[0];
};

export const getAllAulas = async (filter = '', params = []) => {
  const text = `
    SELECT a.*, b.nome AS nome_branch
    FROM aulas a
    LEFT JOIN branches b ON a.branch_id = b.id
    WHERE 1=1 ${filter}
    ORDER BY a.data DESC, a.horario DESC
  `;
  const res = await query(text, params);
  return res.rows;
};

export const findAulaById = async (id) => {
  const text = `
    SELECT a.*, b.nome AS nome_branch
    FROM aulas a
    LEFT JOIN branches b ON a.branch_id = b.id
    WHERE a.id = $1
  `;
  const res = await query(text, [id]);
  return res.rows[0];
};

// ==================== PRESENÇAS ====================

// Busca presenças de uma aula específica (para a chamada)
// ✅ COALESCE(p.presente, false): sem registo ainda = ausente por defeito —
// mesmo critério já usado em Cultos (COALESCE(f.presente, false) na query
// de presenças). Antes devolvia NULL e cada frontend (web e mobile) tinha
// de decidir o defeito por conta própria — os dois escolheram `true`, ao
// contrário do resto do sistema, daí "todos aparecerem presentes".
export const getPresencasByAula = async (aula_id, turma) => {
  const text = `
    SELECT
      c.id AS crianca_id,
      c.nome,
      c.codigo,
      c.turma,
      p.id AS presenca_id,
      COALESCE(p.presente, false) AS presente
    FROM criancas c
    LEFT JOIN presencas_escolinha p
      ON p.crianca_id = c.id AND p.aula_id = $1
    WHERE c.ativo = true AND c.turma = $2
    ORDER BY c.nome ASC
  `;
  const res = await query(text, [aula_id, turma]);
  return res.rows;
};

// Regista/actualiza presença (upsert simétrico — presente = EXCLUDED.presente
// tanto para true como para false, sem o bug de ON CONFLICT DO NOTHING já
// corrigido no módulo de Cultos)
//
// data_presenca vem sempre da própria aula (subquery por aula_id), nunca do
// pedido — nem o frontend web nem o mobile mandam essa data no payload, e não
// devem: a data de uma presença é a data da aula a que pertence, não um
// valor independente que cada chamador tenha de saber replicar.
export const markPresenca = async (crianca_id, aula_id, presente, userId) => {
  const text = `
    INSERT INTO presencas_escolinha (crianca_id, aula_id, presente, registado_por, data_presenca)
    VALUES ($1, $2, $3, $4, (SELECT data FROM aulas WHERE id = $2))
    ON CONFLICT (crianca_id, aula_id)
    DO UPDATE SET presente = EXCLUDED.presente, registado_por = EXCLUDED.registado_por
    RETURNING *
  `;
  const res = await query(text, [crianca_id, aula_id, presente === true, userId]);
  return res.rows[0];
};

// Histórico de presenças de uma criança (com data/turma/tema via JOIN a aulas)
export const getHistoricoPresencas = async (crianca_id) => {
  const text = `
    SELECT p.*, a.data, a.turma, a.tema, a.professor
    FROM presencas_escolinha p
    JOIN aulas a ON a.id = p.aula_id
    WHERE p.crianca_id = $1
    ORDER BY a.data DESC
    LIMIT 20
  `;
  const res = await query(text, [crianca_id]);
  return res.rows;
};

// Estatísticas gerais (para dashboard/lista)
export const getStatsCriancas = async () => {
  const text = `
    SELECT 
      turma,
      COUNT(*) AS total
    FROM criancas
    WHERE ativo = true
    GROUP BY turma
  `;
  const res = await query(text);
  return res.rows;
};
