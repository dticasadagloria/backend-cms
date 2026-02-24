import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createUser, findUserByUsername, findUserById, getAllUsers } from '../models/userModel.js';
import { query } from '../config/db.js';

const SALT_ROUNDS = 10;

// Validar JWT_SECRET
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL ERROR: JWT_SECRET is not defined in .env');
  process.exit(1);
}

// ==================== REGISTER ====================
export const register = async (req, res) => {
  console.log('\n📝 REGISTRATION ATTEMPT');
  console.log('Body received:', { username: req.body.username, role_id: req.body.role_id });

  const { username, password, role_id } = req.body;

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
    const newUser = await createUser(username, password_hash, role_id);

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role_id: newUser.role_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('🎉 Registration successful!\n');
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        role_id: newUser.role_id,
        ativo: newUser.ativo,
        data_criacao: newUser.data_criacao
      },
      token
    });

  } catch (error) {
    console.error('💥 REGISTRATION ERROR:', error.message);
    if (error.code === '23505') return res.status(409).json({ message: 'Username already in use' });
    if (error.code === '23503') return res.status(400).json({ message: 'Invalid role_id' });
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// ==================== LOGIN ====================
export const login = async (req, res) => {
  console.log('\n🔐 LOGIN ATTEMPT - Username:', req.body.username);

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
      { id: user.id, username: user.username, role_id: user.role_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('🎉 Login successful!\n');
    res.status(200).json({
      message: 'Login successful',
      user: { id: user.id, username: user.username, role_id: user.role_id, ativo: user.ativo },
      token
    });

  } catch (error) {
    console.error('💥 LOGIN ERROR:', error.message);
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
// PUT /auth/change-password
// Requer: autenticação (qualquer utilizador pode trocar a sua própria senha)
export const changePassword = async (req, res) => {
  console.log('\n🔑 CHANGE PASSWORD - User:', req.user?.username);

  const { senhaActual, novaSenha, confirmarSenha } = req.body;

  try {
    // 1️⃣ Validação básica
    if (!senhaActual || !novaSenha || !confirmarSenha) {
      return res.status(400).json({
        message: 'senhaActual, novaSenha e confirmarSenha são obrigatórios'
      });
    }

    // 2️⃣ Nova senha e confirmação devem coincidir
    if (novaSenha !== confirmarSenha) {
      return res.status(400).json({
        message: 'Nova senha e confirmação não coincidem'
      });
    }

    // 3️⃣ Nova senha deve ter pelo menos 6 caracteres
    if (novaSenha.length < 6) {
      return res.status(400).json({
        message: 'Nova senha deve ter pelo menos 6 caracteres'
      });
    }

    // 4️⃣ Nova senha não pode ser igual à actual
    if (senhaActual === novaSenha) {
      return res.status(400).json({
        message: 'Nova senha não pode ser igual à senha actual'
      });
    }

    // 5️⃣ Busca o user COM password_hash (precisa SELECT * )
    const userResult = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'Utilizador não encontrado' });
    }
    const user = userResult.rows[0];

    // 6️⃣ Verifica se a senha actual está correcta
    const isMatch = await bcrypt.compare(senhaActual, user.password_hash);
    if (!isMatch) {
      console.log('❌ Wrong current password');
      return res.status(400).json({ message: 'Senha actual incorrecta' });
    }

    // 7️⃣ Encripta nova senha e actualiza na base de dados
    const newHash = await bcrypt.hash(novaSenha, SALT_ROUNDS);
    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newHash, req.user.id]
    );

    console.log('✅ Password changed successfully for user:', req.user.username);
    res.status(200).json({ message: 'Senha alterada com sucesso' });

  } catch (error) {
    console.error('💥 CHANGE PASSWORD ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ==================== GET ALL USERS ====================
// GET /auth/users
// Requer: autenticação + role Admin (role_id = 1)
export const getAllUsersHandler = async (req, res) => {
  console.log('\n👥 GET ALL USERS - Requested by:', req.user?.username);

  try {
    const users = await getAllUsers();

    console.log(`✅ Returned ${users.length} users`);
    res.status(200).json({
      success: true,
      count: users.length,
      users
    });

  } catch (error) {
    console.error('💥 GET ALL USERS ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ==================== UPDATE USER ====================
// PUT /auth/users/:id
// Requer: autenticação + role Admin (role_id = 1)
export const updateUser = async (req, res) => {
  console.log('\n✏️  UPDATE USER - ID:', req.params.id);

  const { id } = req.params;
  const { username, role_id } = req.body;

  try {
    // 1️⃣ Verifica se o utilizador existe
    const existing = await findUserById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Utilizador não encontrado' });
    }

    // 2️⃣ Não pode editar a si mesmo por esta rota (protecção extra)
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        message: 'Use /auth/change-password para alterar os seus próprios dados'
      });
    }

    // 3️⃣ Validações
    if (username && username.length < 3) {
      return res.status(400).json({ message: 'Username deve ter pelo menos 3 caracteres' });
    }

    // 4️⃣ Verifica se novo username já existe (se foi alterado)
    if (username && username !== existing.username) {
      const taken = await findUserByUsername(username);
      if (taken) {
        return res.status(409).json({ message: 'Username já está em uso' });
      }
    }

    // 5️⃣ Verifica se role_id existe (se foi fornecido)
    if (role_id) {
      const roleCheck = await query('SELECT id FROM roles WHERE id = $1', [role_id]);
      if (roleCheck.rowCount === 0) {
        return res.status(400).json({ message: 'role_id inválido' });
      }
    }

    // 6️⃣ Actualiza apenas os campos fornecidos
    const newUsername = username ?? existing.username;
    const newRoleId   = role_id  ?? existing.role_id;

    const result = await query(
      `UPDATE users 
       SET username = $1, role_id = $2 
       WHERE id = $3 
       RETURNING id, username, role_id, ativo, data_criacao`,
      [newUsername, newRoleId, id]
    );

    console.log('✅ User updated:', result.rows[0]);
    res.status(200).json({
      message: 'Utilizador actualizado com sucesso',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('💥 UPDATE USER ERROR:', error.message);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Username já está em uso' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ==================== DELETE (DEACTIVATE) USER ====================
// DELETE /auth/users/:id
// Requer: autenticação + role Admin (role_id = 1)
// Não apaga fisicamente — apenas desactiva (ativo = false)
export const deleteUser = async (req, res) => {
  console.log('\n🚫 DEACTIVATE USER - ID:', req.params.id);

  const { id } = req.params;

  try {
    // 1️⃣ Não pode desactivar a si mesmo
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        message: 'Não pode desactivar a sua própria conta'
      });
    }

    // 2️⃣ Verifica se o utilizador existe
    const existing = await findUserById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Utilizador não encontrado' });
    }

    // 3️⃣ Já está inactivo?
    if (!existing.ativo) {
      return res.status(400).json({ message: 'Utilizador já está inactivo' });
    }

    // 4️⃣ Desactiva (soft delete)
    const result = await query(
      `UPDATE users 
       SET ativo = false 
       WHERE id = $1 
       RETURNING id, username, role_id, ativo`,
      [id]
    );

    console.log('✅ User deactivated:', result.rows[0]);
    res.status(200).json({
      message: 'Utilizador desactivado com sucesso',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('💥 DEACTIVATE USER ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ==================== REACTIVATE USER ====================
// PATCH /auth/users/:id/reactivate
// Requer: autenticação + role Admin (role_id = 1)
export const reactivateUser = async (req, res) => {
  console.log('\n✅ REACTIVATE USER - ID:', req.params.id);

  const { id } = req.params;

  try {
    const existing = await findUserById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Utilizador não encontrado' });
    }

    if (existing.ativo) {
      return res.status(400).json({ message: 'Utilizador já está activo' });
    }

    const result = await query(
      `UPDATE users 
       SET ativo = true 
       WHERE id = $1 
       RETURNING id, username, role_id, ativo`,
      [id]
    );

    console.log('✅ User reactivated:', result.rows[0]);
    res.status(200).json({
      message: 'Utilizador reactivado com sucesso',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('💥 REACTIVATE USER ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};