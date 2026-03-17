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
  m.ano_batismo,
  m.estado_civil,
  conjuge.nome AS conjugue_nome,
  m.ocupacao,
  COALESCE(b.nome, 'Sem Branch') AS nome_branch,  -- mostra texto padrão
  COALESCE(c.nome, 'Sem Celula') AS nome_celula,
  m.ativo,
  m.ano_ingresso,
  m.escola_da_verdade,
  m.ano_conclusao_escola,
  m.contacto,
  m.email,
  m.data_registo,
  m.parceiro,
  m.email
FROM membros m
LEFT JOIN branches b ON m.branch_id = b.id
LEFT JOIN celulas c ON m.celula_id = c.id
LEFT JOIN membros conjuge ON conjuge.id = m.conjugue_id
ORDER BY m.data_registo DESC;

  `;
  const res = await query(text);
  console.log(res.rows);
  return res.rows;
};

// Criar membro
export const createMembro = async (membroData, userId) => {
  const text = `
    INSERT INTO membros 
      (nome, genero, branch_id, data_nascimento, bairro, estado_civil, faixa_etaria, batizado, ocupacao, ano_ingresso, escola_da_verdade, contacto, email, ano_batismo, ano_conclusao_escola, parceiro)
    VALUES 
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *
  `;
  const values = [
    membroData.nome_membro,        // $1  nome
    membroData.genero,             // $2  genero
    membroData.branch_id,          // $3  branch_id
    membroData.data_nascimento,    // $4  data_nascimento
    membroData.bairro,             // $5  bairro
    membroData.estado_civil,       // $6  estado_civil
    membroData.faixa_etaria,       // $7  faixa_etaria
    membroData.batizado,           // $8  batizado
    membroData.ocupacao,           // $9  ocupacao
    membroData.ano_ingresso,       // $10 ano_ingresso
    membroData.escola_da_verdade,  // $11 escola_da_verdade
    membroData.contacto,           // $12 contacto
    membroData.email,              // $13 email
    membroData.ano_batismo,        // $14 ano_batismo
    membroData.ano_conclusao_escola, // $15 ano_conclusao_escola
    membroData.parceiro,           // $16 parceiro
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
      nome = $1,
      genero = $2,
      branch_id = $3,
      celula_id = $4,
      data_nascimento = $5,
      faixa_etaria = $6,
      bairro = $7,
      estado_civil = $8,
      batizado = $9,
      ano_batismo = $10,
      ocupacao = $11,
      ano_ingresso = $12,
      escola_da_verdade = $13,
      ano_conclusao_escola = $14,
      contacto = $15,
      email = $16,
      parceiro = $17
    WHERE id = $18
    RETURNING *
  `;

  const values = [
    membroData.nome || null,
    membroData.genero || null,
    membroData.branch_id || null,
    membroData.celula_id || null,
    membroData.data_nascimento || null,
    membroData.faixa_etaria || null,
    membroData.bairro || null,
    membroData.estado_civil || null,
    membroData.batizado || false,
    membroData.ano_batismo || null,
    membroData.ocupacao || null,
    membroData.ano_ingresso || null,
    membroData.escola_da_verdade || "Nao frequenta",
    membroData.ano_conclusao_escola || null,
    membroData.contacto || null,
    membroData.email || null,
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
