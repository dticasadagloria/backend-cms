import { query } from '../config/db.js';

// Listar todos os membros
export const getAllMembros = async () => {
  const text = `
 SELECT 
  m.id,
  m.codigo,
  m.nome AS nome_membro,
  m.genero,
  m.data_nascimento,
  m.bairro,
  m.faixa_etaria,
  m.batizado,
  m.data_batismo,
  m.estado_civil,
  m.ocupacao,
  COALESCE(b.nome, 'Sem Branch') AS nome_branch,  -- mostra texto padrão
  COALESCE(c.nome, 'Sem Celula') AS nome_celula,
  m.ativo,
  m.ano_ingresso,
  m.escola_da_verdade,
  m.data_conclusao_escola,
  m.contacto,
  m.email,
  m.data_registo,
  m.tipo_documento,
  m.numero_documento,
  m.parceiro,
  m.email
FROM membros m
LEFT JOIN branches b ON m.branch_id = b.id
LEFT JOIN celulas c ON m.celula_id = c.id
ORDER BY m.data_registo DESC;

  `;
  const res = await query(text);
  console.log(res.rows);
  return res.rows;
};

// Criar membro
export const createMembro = async (membroData, userId) => {
  const text = `
    INSERT INTO membros (codigo, nome, genero, branch_id, data_nascimento, bairro, estado_civil, faixa_etaria, batizado, data_batismo, ocupacao, ano_ingresso, escola_da_verdade, data_conclusao_escola, contacto, email, tipo_documento, numero_documento, parceiro)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    RETURNING *
  `;
  const values = [
    membroData.codigo,
    membroData.nome_membro,
    membroData.genero,
    membroData.branch_id,
    membroData.data_nascimento,
    membroData.bairro,
    membroData.estado_civil,
    membroData.faixa_etaria,
    membroData.batizado,
    membroData.data_batismo,
    membroData.ocupacao,
    membroData.ano_ingresso,
    membroData.escola_da_verdade,
    membroData.data_conclusao_escola,
    membroData.contacto,
    membroData.email,
    membroData.tipo_documento,
    membroData.numero_documento,
    membroData.parceiro
  ];
  const res = await query(text, values);
  return res.rows[0];
};

// Buscar por ID
export const findMembroById = async (id) => {
  const text = `
    SELECT 
      m.*,
      COALESCE(b.nome, 'Sem Branch') AS nome_branch,
      COALESCE(c.nome, 'Sem Célula') AS nome_celula
    FROM membros m
    LEFT JOIN branches b ON m.branch_id = b.id
    LEFT JOIN celulas c ON m.celula_id = c.id
    WHERE m.id = $1
  `;
  const res = await query(text, [id]);
  return res.rows[0];
};
// Actualizar
export const updateMembro = async (id, membroData) => {
  const text = `
    UPDATE membros
    SET 
      codigo = $1,
      nome = $2,
      genero = $3,
      branch_id = $4,
      celula_id = $5,
      data_nascimento = $6,
      faixa_etaria = $7,
      bairro = $8,
      estado_civil = $9,
      batizado = $10,
      data_batismo = $11,
      ocupacao = $12,
      ano_ingresso = $13,
      escola_da_verdade = $14,
      data_conclusao_escola = $15,
      contacto = $16,
      email = $17,
      tipo_documento = $18,
      numero_documento = $19,
      parceiro = $20
    WHERE id = $21
    RETURNING *
  `;

  const values = [
    membroData.codigo || null,
    membroData.nome || null,
    membroData.genero || null,
    membroData.branch_id || null,
    membroData.celula_id || null,
    membroData.data_nascimento || null,
    membroData.faixa_etaria || null,
    membroData.bairro || null,
    membroData.estado_civil || null,
    membroData.batizado || false,
    membroData.data_batismo || null,
    membroData.ocupacao || null,
    membroData.ano_ingresso || null,
    membroData.escola_da_verdade || "Nao frequenta",
    membroData.data_conclusao_escola || null,
    membroData.contacto || null,
    membroData.email || null,
    membroData.tipo_documento || null,
    membroData.numero_documento || null,
    membroData.parceiro || false,
    id
  ];

  const res = await query(text, values);
  return res.rows[0];
};



// Desactivar (soft delete)
export const deactivateMembro = async (id) => {
  const text = 'UPDATE membros SET ativo = false WHERE id = $1 RETURNING *';
  const res = await query(text, [id]);
  return res.rows[0];
};

// ==================== HARD DELETE MEMBRO ====================
// ATENÇÃO: Esta função APAGA PERMANENTEMENTE o registo da base de dados
export const deleteMembroHard = async (id) => {
  const text = `
    DELETE FROM membros 
    WHERE id = $1 
    RETURNING *
  `;
  const res = await query(text, [id]);
  return res.rows[0];
};

// ==================== REACTIVATE MEMBRO ====================
export const reactivateMembro = async (id) => {
  const text = `
    UPDATE membros 
    SET ativo = true 
    WHERE id = $1 
    RETURNING *
  `;
  const res = await query(text, [id]);
  return res.rows[0];
};
