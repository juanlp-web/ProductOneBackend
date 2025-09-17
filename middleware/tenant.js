import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import databaseManager from '../services/DatabaseManager.js';

/**
 * Middleware para identificar y cargar el tenant basado en headers, query params o token
 */
export const identifyTenant = async (req, res, next) => {
  try {
    // Verificar que la conexión principal esté lista
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ Conexión MongoDB no está lista, saltando identificación de tenant');
      req.tenant = null;
      req.tenantModels = null;
      return next();
    }
    let tenantIdentifier = null;
    
    // 1. Intentar obtener tenant del header X-Tenant-ID (método principal)
    if (req.headers['x-tenant-id']) {
      tenantIdentifier = req.headers['x-tenant-id'];
    }
    // 2. Intentar obtener tenant de query parameter
    else if (req.query.tenant) {
      tenantIdentifier = req.query.tenant;
    }
    // 3. Intentar obtener tenant del token JWT (si está presente)
    else if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        if (token) {
          const jwt = await import('jsonwebtoken');
          const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
          if (decoded.tenantId) {
            // Buscar tenant por ID en lugar de subdomain
            const tenant = await Tenant.findById(decoded.tenantId);
            if (tenant) {
              tenantIdentifier = tenant.subdomain;
            }
          }
        }
      } catch (jwtError) {
        // Si hay error con JWT, continuar sin tenant
        console.log('No se pudo extraer tenant del JWT:', jwtError.message);
      }
    }

    if (!tenantIdentifier) {
      // Si no hay identificador de tenant, usar la BD principal
      req.tenant = null;
      req.tenantModels = null;
      return next();
    }

    // Buscar el tenant
    const tenant = await Tenant.findActiveBySubdomain(tenantIdentifier);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant no encontrado o inactivo',
        code: 'TENANT_NOT_FOUND'
      });
    }

    // Verificar si el tenant está activo
    if (!tenant.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Tenant suspendido',
        code: 'TENANT_SUSPENDED'
      });
    }

    // Verificar si el trial ha expirado
    if (tenant.isTrialExpired) {
      return res.status(402).json({
        success: false,
        message: 'Trial expirado. Por favor, actualice su plan.',
        code: 'TRIAL_EXPIRED',
        daysExpired: Math.abs(tenant.daysUntilTrialExpires)
      });
    }

    // Obtener modelos del tenant
    const tenantModels = await databaseManager.getTenantModels(tenant);

    // Agregar información al request
    req.tenant = tenant;
    req.tenantModels = tenantModels;
    
    // Actualizar última actividad del tenant
    tenant.updateMetadata({ lastActivity: new Date() });

    next();
  } catch (error) {
    console.error('Error en identifyTenant middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'TENANT_ERROR'
    });
  }
};

/**
 * Middleware para requerir un tenant válido
 */
export const requireTenant = (req, res, next) => {
  if (!req.tenant) {
    return res.status(400).json({
      success: false,
      message: 'Se requiere un tenant válido',
      code: 'TENANT_REQUIRED'
    });
  }
  next();
};

/**
 * Middleware para verificar límites del tenant
 */
export const checkTenantLimits = (type) => {
  return async (req, res, next) => {
    if (!req.tenant) {
      return next(); // Si no hay tenant, usar BD principal sin límites
    }

    try {
      const models = req.tenantModels;
      let currentCount = 0;

      switch (type) {
        case 'users':
          currentCount = await models.User.countDocuments();
          break;
        case 'products':
          currentCount = await models.Product.countDocuments();
          break;
        case 'clients':
          currentCount = await models.Client.countDocuments();
          break;
        case 'suppliers':
          currentCount = await models.Supplier.countDocuments();
          break;
      }

      if (!req.tenant.checkLimits(type, currentCount)) {
        return res.status(403).json({
          success: false,
          message: `Límite de ${type} alcanzado para su plan`,
          code: 'LIMIT_EXCEEDED',
          current: currentCount,
          limit: req.tenant.limits[`max${type.charAt(0).toUpperCase() + type.slice(1)}`],
          plan: req.tenant.plan
        });
      }

      next();
    } catch (error) {
      console.error('Error verificando límites del tenant:', error);
      res.status(500).json({
        success: false,
        message: 'Error verificando límites',
        code: 'LIMIT_CHECK_ERROR'
      });
    }
  };
};

/**
 * Middleware para verificar features del tenant
 */
export const checkTenantFeature = (feature) => {
  return (req, res, next) => {
    if (!req.tenant) {
      return next(); // Si no hay tenant, usar BD principal con todas las features
    }

    if (!req.tenant.features[feature]) {
      return res.status(403).json({
        success: false,
        message: `Feature '${feature}' no disponible en su plan`,
        code: 'FEATURE_NOT_AVAILABLE',
        plan: req.tenant.plan,
        feature: feature
      });
    }

    next();
  };
};

/**
 * Middleware para obtener el modelo correcto (tenant o principal)
 */
export const getModel = (modelName) => {
  return (req, res, next) => {
    if (req.tenantModels && req.tenantModels[modelName]) {
      req.Model = req.tenantModels[modelName];
    } else {
      // Fallback al modelo principal
      import(`../models/${modelName}.js`).then(({ default: Model }) => {
        req.Model = Model;
        next();
      }).catch(error => {
        console.error(`Error cargando modelo ${modelName}:`, error);
        res.status(500).json({
          success: false,
          message: 'Error cargando modelo',
          code: 'MODEL_ERROR'
        });
      });
      return;
    }
    next();
  };
};

/**
 * Middleware para logging de tenant
 */
export const logTenantActivity = (req, res, next) => {
  if (req.tenant) {
    console.log(`[${req.tenant.subdomain}] ${req.method} ${req.originalUrl} - User: ${req.user?.email || 'anonymous'}`);
  }
  next();
};
