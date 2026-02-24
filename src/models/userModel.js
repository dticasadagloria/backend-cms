import { query } from '../config/db.js';

// Criar usuário
export const createUser = async (username, password_hash, role_id) => {
  const text = `
    INSERT INTO users (username, password_hash, role_id) 
    VALUES ($1, $2, $3) 
    RETURNING id, username, role_id, ativo, data_criacao
  `;
  const values = [username, password_hash, role_id];
  const res = await query(text, values);
  return res.rows[0];
};

// Buscar usuário por username
export const findUserByUsername = async (username) => {
  const text = 'SELECT * FROM users WHERE username = $1';
  const res = await query(text, [username]);
  return res.rows[0];
};

//CORRIGIDO: faz JOIN com roles para retornar role_nome
export const findUserById = async (id) => {
  const text = `
    SELECT 
      u.id, 
      u.username, 
      u.role_id,
      r.nome     AS role_nome,
      r.descricao AS role_descricao,
      u.ativo, 
      u.data_criacao
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.id = $1
  `;
  const res = await query(text, [id]);
  return res.rows[0];
};

// Listar todos os usuários
export const getAllUsers = async () => {
  const text = `
    SELECT u.id, u.username, u.role_id, r.nome as role_nome, u.ativo, u.data_criacao
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    ORDER BY u.data_criacao DESC
  `;
  const res = await query(text);
  return res.rows;
};