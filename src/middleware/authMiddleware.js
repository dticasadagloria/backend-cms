import jwt from 'jsonwebtoken';

export const authenticate = (req, res, next) => {
  try {
    // Pegar token do header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ 
        message: 'No token provided' 
      });
    }

    // Format: "Bearer TOKEN"
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ 
        message: 'Token format invalid. Use: Bearer <token>' 
      });
    }

    const token = parts[1];

    // Verificar token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ 
          message: 'Invalid or expired token' 
        });
      }

      // Adicionar dados do usuário ao request
      req.user = decoded;
      next();
    });

  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      message: 'Internal server error' 
    });
  }
};

// Middleware para verificar roles específicas
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Unauthorized' 
      });
    }

    if (!allowedRoles.includes(req.user.role_id)) {
      return res.status(403).json({ 
        message: 'Forbidden: Insufficient permissions' 
      });
    }

    next();
  };
};

// ── Verifica se o utilizador tem o role necessário ────────────────────────────
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role_id)) {
      return res.status(403).json({ 
        message: 'Forbidden - You do not have permission',
        yourRole: req.user.role_id,
        requiredRoles: allowedRoles
      });
    }

    next();
  };
};