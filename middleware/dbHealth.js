import mongoose from 'mongoose';

/**
 * Middleware para verificar el estado de la conexión a la base de datos
 */
export const checkDBHealth = (req, res, next) => {
  // Verificar estado de la conexión principal
  if (mongoose.connection.readyState !== 1) {
    
    // Si es una petición de salud o auth, permitir pasar
    if (req.path === '/' || req.path === '/health' || req.path.startsWith('/api/auth/login')) {
      return next();
    }
    
    return res.status(503).json({
      success: false,
      message: 'Servicio temporalmente no disponible',
      code: 'DB_NOT_READY',
      dbState: getConnectionState(mongoose.connection.readyState)
    });
  }
  
  next();
};

/**
 * Obtener descripción del estado de conexión
 */
const getConnectionState = (state) => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return states[state] || 'unknown';
};

/**
 * Endpoint de salud de la base de datos
 */
export const dbHealthCheck = (req, res) => {
  const mainDBState = mongoose.connection.readyState;
  const mainDBName = mongoose.connection.name;
  
  const health = {
    status: mainDBState === 1 ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    database: {
      main: {
        state: getConnectionState(mainDBState),
        name: mainDBName,
        host: mongoose.connection.host
      }
    },
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };
  
  const statusCode = mainDBState === 1 ? 200 : 503;
  res.status(statusCode).json(health);
};
