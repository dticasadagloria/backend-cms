import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createUser, findUserByUsername, findUserById, getAllUsers } from '../models/userModel.js';
import { query } from '../config/db.js';
import { logActivity, logAuthEvent } from '../helpers/logActivity.js';

const SALT_ROUNDS = 10;

if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in .env');
  process.exit(1);
}

// ==================== REGISTER ====================
export const register = async (req, res) => {
  const { username, password, role_id, branch_id } = req.body;

  try {
    if (!username || !password || !role_id) {
      return res.status(400).json({ message: 'username, password, and role_id are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ message: 'Username already in use' });
    }

    const roleCheck = await query('SELECT id, nome FROM roles WHERE id = $1', [role_id]);
    if (roleCheck.rowCount === 0) {
      return res.status(400).json({ message: 'Invalid role_id. Please ensure the role exists.' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = await createUser(username, password_hash, role_id, branch_id ?? null);

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role_id: newUser.role_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logAuthEvent(req, {
      user_id:     newUser.id,
      username:    newUser.username,
      role_id:     newUser.role_id,
      action:      'REGISTER',
      description: `Novo utilizador registado: ${newUser.username} (role ${newUser.role_id})`,
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        role_id: newUser.role_id,
        branch_id: newUser.branch_id,
        ativo: newUser.ativo,
        data_criacao: newUser.data_criacao
      },
      token
    });

  } catch (error) {
    console.error('REGISTRATION ERROR:', error.message);
    if (error.code === '23505') return res.status(409).json({ message: 'Username already in use' });
    if (error.code === '23503') return res.status(400).json({ message: 'Invalid role_id' });
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// ==================== LOGIN ====================
export const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    if (!username || !password) {
      return res.status(400).json({ message: 'username and password are required' });
    }

    const user = await findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.ativo) {
      return res.status(403).json({ message: 'User account is inactive' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role_id: user.role_id, branch_id: user.branch_id },
      process.env.JWT_SECRET,
      { expiresIn: '3h' }
    );

    await logAuthEvent(req, {
      user_id:     user.id,
      username:    user.username,
      role_id:     user.role_id,
      branch_id:   user.branch_id,
      action:      'LOGIN',
      description: `Login efectuado por ${user.username}`,
    });

    res.status(200).json({
      message: 'Login successful',
      user: { id: user.id, username: user.username, role_id: user.role_id, ativo: user.ativo },
      token
    });

  } catch (error) {
    console.error('LOGIN ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ==================== GET ME ====================
export const getMe = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);

  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ==================== CHANGE PASSWORD ====================
export const changePassword = async (req, res) => {
  const { senhaActual, novaSenha, confirmarSenha } = req.body;

  try {
    if (!senhaActual || !novaSenha || !confirmarSenha) {
      return res.status(400).json({ message: 'senhaActual, novaSenha e confirmarSenha são obrigatórios' });
    }

    if (novaSenha !== confirmarSenha) {
      return res.status(400).json({ message: 'Nova senha e confirmação não coincidem' });
    }

    if (novaSenha.length < 6) {
      return res.status(400).json({ message: 'Nova senha deve ter pelo menos 6 caracteres' });
    }

    if (senhaActual === novaSenha) {
      return res.status(400).json({ message: 'Nova senha não pode ser igual à senha actual' });
    }

    const userResult = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'Utilizador não encontrado' });
    }
    const user = userResult.rows[0];

    const isMatch = await bcrypt.compare(senhaActual, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Senha actual incorrecta' });
    }

    const newHash = await bcrypt.hash(novaSenha, SALT_ROUNDS);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

    await logActivity(req, {
      action:       'UPDATE',
      entity_type:  'user',
      entity_id:    req.user.id,
      entity_label: req.user.username,
      description:  `Alterou a sua própria senha`,
    });

    res.status(200).json({ message: 'Senha alterada com sucesso' });

  } catch (error) {
    console.error('CHANGE PASSWORD ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ==================== GET ALL USERS ====================
export const getAllUsersHandler = async (req, res) => {
  try {
    const users = await getAllUsers();
    res.status(200).json({ success: true, count: users.length, users });
  } catch (error) {
    console.error('GET ALL USERS ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ==================== UPDATE USER ====================
export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { username, role_id } = req.body;

  try {
    const existing = await findUserById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Utilizador não encontrado' });
    }

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ message: 'Use /auth/change-password para alterar os seus próprios dados' });
    }

    if (username && username.length < 3) {
      return res.status(400).json({ message: 'Username deve ter pelo menos 3 caracteres' });
    }

    if (username && username !== existing.username) {
      const taken = await findUserByUsername(username);
      if (taken) {
        return res.status(409).json({ message: 'Username já está em uso' });
      }
    }

    if (role_id) {
      const roleCheck = await query('SELECT id FROM roles WHERE id = $1', [role_id]);
      if (roleCheck.rowCount === 0) {
        return res.status(400).json({ message: 'role_id inválido' });
      }
    }

    const newUsername = username ?? existing.username;
    const newRoleId   = role_id  ?? existing.role_id;

    const result = await query(
      `UPDATE users SET username = $1, role_id = $2 WHERE id = $3
       RETURNING id, username, role_id, ativo, data_criacao`,
      [newUsername, newRoleId, id]
    );

    await logActivity(req, {
      action:       'UPDATE',
      entity_type:  'user',
      entity_id:    parseInt(id),
      entity_label: newUsername,
      old_values:   { username: existing.username, role_id: existing.role_id },
      new_values:   { username: newUsername, role_id: newRoleId },
      description:  `Actualizou o utilizador ${newUsername}`,
    });

    res.status(200).json({ message: 'Utilizador actualizado com sucesso', user: result.rows[0] });

  } catch (error) {
    console.error('UPDATE USER ERROR:', error.message);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Username já está em uso' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ==================== DELETE (DEACTIVATE) USER ====================
export const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ message: 'Não pode desactivar a sua própria conta' });
    }

    const existing = await findUserById(id);
    if (!existing) return res.status(404).json({ message: 'Utilizador não encontrado' });
    if (!existing.ativo) return res.status(400).json({ message: 'Utilizador já está inactivo' });

    const result = await query(
      `UPDATE users SET ativo = false WHERE id = $1 RETURNING id, username, role_id, ativo`,
      [id]
    );

    await logActivity(req, {
      action:       'DELETE',
      entity_type:  'user',
      entity_id:    parseInt(id),
      entity_label: existing.username,
      description:  `Desactivou o utilizador ${existing.username}`,
    });

    res.status(200).json({ message: 'Utilizador desactivado com sucesso', user: result.rows[0] });

  } catch (error) {
    console.error('DEACTIVATE USER ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ==================== REACTIVATE USER ====================
export const reactivateUser = async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await findUserById(id);
    if (!existing) return res.status(404).json({ message: 'Utilizador não encontrado' });
    if (existing.ativo) return res.status(400).json({ message: 'Utilizador já está activo' });

    const result = await query(
      `UPDATE users SET ativo = true WHERE id = $1 RETURNING id, username, role_id, ativo`,
      [id]
    );

    await logActivity(req, {
      action:       'REACTIVATE',
      entity_type:  'user',
      entity_id:    parseInt(id),
      entity_label: existing.username,
      description:  `Reactivou o utilizador ${existing.username}`,
    });

    res.status(200).json({ message: 'Utilizador reactivado com sucesso', user: result.rows[0] });

  } catch (error) {
    console.error('REACTIVATE USER ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

//Login de membros comuns
