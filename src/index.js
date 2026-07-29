import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import https from "https";
import authRoutes from "./routes/authRoutes.js";
import membroRoutes from "./routes/membroRoutes.js";
import restauracoesRoutes from "./routes/restauracoesRoutes.js";
import cultosRoutes from "./routes/cultosRoutes.js";
import visitantesRoutes from "./routes/visitantesRoutes.js";
import departamentosRoutes from "./routes/departamentosRoutes.js";
import requisicoesRoutes from "./routes/requisicoesRoutes.js";
import branchesRoutes from "./routes/branchesRoutes.js";
import ofertasRouter from "./routes/ofertasRoutes.js";
import convertidosRoutes from "./routes/convertidosRoutes.js";
import relatoriosRoutes from "./routes/relatoriosRoutes.js";
import logsRoutes from "./routes/logsRoutes.js";
import criancaRoutes from './routes/criancaRoutes.js';
import { query } from "./config/db.js";
import { iniciarScheduler } from "./jobs/scheduler.js";
import { authenticate } from "./middleware/authMiddleware.js";
import { verificarPresencasMembros } from "./jobs/verificarPresencas.js";


// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;


// URL público do próprio backend (permite override por env em futuras migrações)
const SELF_URL = process.env.SELF_URL || "https://iicgp-backend-cms.onrender.com";

// Auto-ping para evitar que o Render (free tier) adormeça após 15 min de inactividade.
// Aponta para /health (leve, sem tocar na base de dados).
const keepAlive = () => {
  https.get(`${SELF_URL}/health`, (res) => {
    console.log(`Keep-alive ping: ${res.statusCode}`);
  }).on("error", (err) => {
    console.error("Keep-alive ping falhou:", err.message);
  });
};

setInterval(keepAlive, 10 * 60 * 1000); // a cada 10 minutos (Render dorme aos 15 min)

// ==================== MIDDLEWARES ====================

// Configuração CORS completa (para evitar erro 405)
app.use(
  cors({
    origin: [
      "https://iicgp-frontend.onrender.com", // domínio do frontend
      "https://casadagloria-cms.vercel.app", 
      "http://localhost:5173",               // para testes locais
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Responde automaticamente a preflight requests (OPTIONS)
app.options("/{*any}", cors());

// Permite JSON no corpo das requisições
app.use(express.json());

// ==================== ROTAS ====================

// Rota raiz
app.get("/", (req, res) => {
  res.json({
    message: "🚀 API Backend GDM",
    version: "1.0.0",
    endpoints: {
      register: "POST /auth/register",
      login: "POST /auth/login",
      getMe: "GET /auth/me (requires token)",
      testRoles: "GET /test/roles",
      testConnection: "GET /test/connection",
    },
  });
});

// Health check — leve, sem tocar na base de dados. Usado pelo auto-ping
// e por monitores externos de uptime (UptimeRobot, cron-job.org, etc.).
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

// Rotas de autenticação
app.use("/auth", authRoutes);

// Outras rotas
app.use("/api/membros", membroRoutes);
app.use("/api/restauracoes", restauracoesRoutes);
app.use("/api/cultos", cultosRoutes);
app.use("/api/visitantes", visitantesRoutes);
app.use("/api/departamentos", departamentosRoutes);
app.use("/api/requisicoes", requisicoesRoutes);
app.use("/api/branches", branchesRoutes);
app.use('/api', ofertasRouter);
app.use("/api/convertidos", convertidosRoutes);
app.use("/api/relatorios", relatoriosRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/criancas", criancaRoutes);
// ==================== ROTAS DE TESTE ====================

// Testar conexão do banco
app.get("/test/connection", async (req, res) => {
  try {
    const result = await query("SELECT NOW() as time, version()");
    res.json({
      success: true,
      message: "Database connected successfully",
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Listar roles disponíveis
app.get("/test/roles", async (req, res) => {
  try {
    const result = await query("SELECT * FROM roles ORDER BY id");
    res.json({
      success: true,
      count: result.rowCount,
      roles: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Listar usuários (apenas para teste)
app.get("/test/users", async (req, res) => {
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
      users: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

//Rota de Celulas
app.get("/api/celulas", authenticate, async (req, res) => {
  try {
    const result = await query(`SELECT id, nome FROM celulas ORDER BY nome ASC`);
    res.json({ success: true, celulas: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/debug/routes", (req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push(middleware.route.path);
    } else if (middleware.name === "router") {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push(handler.route.path);
        }
      });
    }
  });
  res.json(routes);
});

//Admin post de ativo ou inativo
app.post("/admin/verificar-presencas", async (req, res) => {
  try {
    await verificarPresencasMembros();
    res.json({ success: true, message: "Verificação concluída" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// Rota 404
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.path,
  });
});




// ==================== INICIAR SERVIDOR ====================

app.listen(PORT, async () => {
  console.log("=".repeat(60));
  console.log(`Server running on http://localhost:${PORT}`);
  iniciarScheduler();

  try {
  const res = await query("SELECT NOW()");
  console.log("Database connected:", res.rows[0].now);
} catch (err) {
  console.error("===== DATABASE ERROR =====");
  console.dir(err, { depth: null });
  console.error("message:", err?.message);
  console.error("code:", err?.code);
  console.error("stack:", err?.stack);
}
});