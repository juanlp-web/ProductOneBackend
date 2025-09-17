import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Obtener token del header
      token = req.headers.authorization.split(' ')[1];

      // Verificar token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Obtener usuario del token - usar el modelo correcto según tenant
      let UserModel = User;
      if (req.tenantModels && req.tenantModels.User) {
        UserModel = req.tenantModels.User;
      }

      req.user = await UserModel.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ 
          message: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND'
        });
      }

      next();
    } catch (error) {
      console.error('Error de autenticación:', error);
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          message: 'Token no válido',
          code: 'INVALID_TOKEN'
        });
      } else if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          message: 'Token expirado',
          code: 'TOKEN_EXPIRED'
        });
      } else {
        return res.status(500).json({ 
          message: 'Error interno de autenticación',
          code: 'AUTH_ERROR'
        });
      }
    }
  } else {
    return res.status(401).json({ 
      message: 'No hay token, acceso denegado',
      code: 'NO_TOKEN'
    });
  }
};

export const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Acceso denegado. Se requieren permisos de administrador' });
  }
};

export const manager = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'manager')) {
    next();
  } else {
    res.status(403).json({ message: 'Acceso denegado. Se requieren permisos de gerente o administrador' });
  }
};

// Función authorize que permite verificar múltiples roles
export const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'No hay usuario autenticado' });
    }

    // Si roles es un string, convertirlo a array
    if (typeof roles === 'string') {
      roles = [roles];
    }

    // Verificar si el usuario tiene uno de los roles permitidos
    if (roles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ 
        message: `Acceso denegado. Se requieren permisos de: ${roles.join(', ')}` 
      });
    }
  };
};
