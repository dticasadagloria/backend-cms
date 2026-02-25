import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import membroRoutes from './routes/membroRoutes.js';
import restauracoesRoutes from './routes/restauracoesRoutes.js';
import { query } from './config/db.js';


// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// ==================== ROTAS ====================

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    message: '🚀 API Backend GDM',
    version: '1.0.0',
    endpoints: {
      register: 'POST /auth/register',
      login: 'POST /auth/login',
      getMe: 'GET /auth/me (requires token)',
      testRoles: 'GET /test/roles',
      testConnection: 'GET /test/connection'
    }
  });
});

// Rotas de autenticação
app.use('/auth', authRoutes);

// ... depois das outras rotas
app.use('/api/membros', membroRoutes);
app.use("/api/restauracoes", restauracoesRoutes);

// ==================== ROTAS DE TESTE ====================

// Testar conexão do banco
app.get('/test/connection', async (req, res) => {
  try {
    const result = await query('SELECT NOW() as time, version()');
    res.json({
      success: true,
      message: 'Database connected successfully',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Listar roles disponíveis
app.get('/test/roles', async (req, res) => {
  try {
    const result = await query('SELECT * FROM roles ORDER BY id');
    res.json({
      success: true,
      count: result.rowCount,
      roles: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Listar usuários (apenas para teste - remover em produção)
app.get('/test/users', async (req, res) => {
  try {
    const result = await query(`
      SELECT u.id, u.username, u.role_id, r.nome as role_name, u.ativo, u.data_criacao
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY u.data_criacao DESC
    `);
    res.json({
      success: true,
      count: result.rowCount,
      users: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Rota 404
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.path
  });
});



// Iniciar servidor
app.listen(PORT, async () => {
  console.log('='.repeat(60));
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('='.repeat(60));
  console.log('Available routes:');
  console.log(`GET  http://localhost:${PORT}/`);
  console.log(`POST http://localhost:${PORT}/auth/register`);
  console.log(`POST http://localhost:${PORT}/auth/login`);
  console.log(`GET  http://localhost:${PORT}/auth/me (requires token)`);
  console.log(`GET  http://localhost:${PORT}/test/connection`);
  console.log(`GET  http://localhost:${PORT}/test/roles`);
  console.log(`GET  http://localhost:${PORT}/test/users`);
  console.log('='.repeat(60));

  // Testar conexão DB ao iniciar
  try {
    const res = await query("SELECT NOW()");
    console.log("🟢 Database connected:", res.rows[0].now);
  } catch (err) {
    console.error("🔴 Database connection error:", err.message);
  }
});