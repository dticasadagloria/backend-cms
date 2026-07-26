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

// ==================== GERAR CÓDIGO AUTOMÁTICO ====================
export const gerarProximoCodigo = async () => {
  // Busca o último código registado na tabela criancas que comece por 'C'
  const text = `
    SELECT codigo 
    FROM criancas 
    WHERE codigo LIKE 'C%' 
    ORDER BY id DESC 
    LIMIT 1
  `;
  const res = await query(text);

  // Se ainda não existir nenhum registo, inicia em C001
  if (res.rows.length === 0 || !res.rows[0].codigo) {
    return 'C001';
  }

  const ultimoCodigo = res.rows[0].codigo; // Ex: "C007"

  // Extrai a parte numérica removendo o prefixo 'C'
  const numeroAtual = parseInt(ultimoCodigo.replace('C', ''), 10);

  // Incrementa +1 ao número extraído
  const proximoNumero = isNaN(numeroAtual) ? 1 : numeroAtual + 1;

  // Formata de volta no padrão C000 (ex: 8 -> "C008")
  return `C${String(proximoNumero).padStart(3, '0')}`;
};

export const createCrianca = async (data, userId) => {
  // Gera automaticamente o próximo código e ignora qualquer valor enviado do frontend
  const codigoAuto = await gerarProximoCodigo();

  const text = `
    INSERT INTO criancas (
      codigo, nome, genero, data_nascimento, turma,
      nome_encarregado, contacto_encarregado, branch_id, observacoes, criado_por
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `;
  const values = [
    codigoAuto, // <--- Código gerado automaticamente
    data.nome,
    data.genero || null,
    data.data_nascimento || null,
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

export const updateCrianca = async (id, data) => {
  const text = `
    UPDATE criancas
    SET
      codigo = $1,
      nome = $2,
      genero = $3,
      data_nascimento = $4,
      turma = $5,
      nome_encarregado = $6,
      contacto_encarregado = $7,
      branch_id = $8,
      observacoes = $9
    WHERE id = $10
    RETURNING *
  `;
  const values = [
    data.codigo || null,
    data.nome,
    data.genero || null,
    data.data_nascimento || null,
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

// ==================== PRESENÇAS ====================

// Busca presenças de uma data específica (para a chamada)
export const getPresencasByData = async (data_presenca, turma = null) => {
  let text = `
    SELECT 
      c.id AS crianca_id,
      c.nome,
      c.turma,
      p.id AS presenca_id,
      p.presente
    FROM criancas c
    LEFT JOIN presencas_escolinha p 
      ON p.crianca_id = c.id AND p.data_presenca = $1
    WHERE c.ativo = true
  `;
  const values = [data_presenca];

  if (turma) {
    text += ` AND c.turma = $2`;
    values.push(turma);
  }

  text += ` ORDER BY c.nome ASC`;

  const res = await query(text, values);
  return res.rows;
};

// Regista/actualiza presença (upsert)
export const markPresenca = async (crianca_id, data_presenca, presente, turma, userId) => {
  const text = `
    INSERT INTO presencas_escolinha (crianca_id, data_presenca, presente, turma, registado_por)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (crianca_id, data_presenca)
    DO UPDATE SET presente = $3, registado_por = $5
    RETURNING *
  `;
  const res = await query(text, [crianca_id, data_presenca, presente, turma, userId]);
  return res.rows[0];
};

// Histórico de presenças de uma criança
export const getHistoricoPresencas = async (crianca_id) => {
  const text = `
    SELECT * FROM presencas_escolinha
    WHERE crianca_id = $1
    ORDER BY data_presenca DESC
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
