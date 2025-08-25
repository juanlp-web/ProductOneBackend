import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware básico
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta de prueba principal
app.get('/', (req, res) => {
  res.json({ 
    message: 'API de Innovadomprod funcionando correctamente',
    version: '1.0.0',
    status: 'running'
  });
});

// Ruta de prueba de API
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API funcionando',
    timestamp: new Date().toISOString()
  });
});

// Ruta de salud del servidor
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error('Error del servidor:', err);
  res.status(500).json({ 
    message: 'Algo salió mal en el servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno'
  });
});

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({ 
    message: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📱 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`🔗 API: http://localhost:${PORT}`);
  console.log(`✅ Servidor listo para recibir peticiones`);
});

export default app;
