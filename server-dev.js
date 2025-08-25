import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta de login simulada para desarrollo
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Simular autenticación
    if (email === 'admin@innovadomprod.com' && password === 'admin123') {
      res.json({
        success: true,
        message: 'Login exitoso',
        user: {
          id: 'admin-001',
          name: 'Administrador',
          email: email,
          role: 'admin'
        },
        token: 'dev-jwt-token-' + Date.now()
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Ruta para obtener perfil del usuario
app.get('/api/auth/profile', (req, res) => {
  try {
    // Simular verificación de token
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ message: 'Token no proporcionado' });
    }

    res.json({
      success: true,
      user: {
        id: 'admin-001',
        name: 'Administrador',
        email: 'admin@innovadomprod.com',
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Rutas simuladas para desarrollo
app.get('/api/products', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: '1',
        name: 'Crema Hidratante',
        sku: 'PROD-001',
        price: 25.50,
        stock: 100,
        category: 'Cuidado Facial'
      },
      {
        id: '2',
        name: 'Mascarilla Facial',
        sku: 'PROD-002',
        price: 18.75,
        stock: 75,
        category: 'Cuidado Facial'
      }
    ]
  });
});

app.get('/api/clients', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: '1',
        name: 'Cliente Ejemplo',
        email: 'cliente@ejemplo.com',
        phone: '+1234567890',
        type: 'Retail'
      }
    ]
  });
});

app.get('/api/suppliers', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: '1',
        name: 'Proveedor Ejemplo',
        email: 'proveedor@ejemplo.com',
        phone: '+1234567890',
        type: 'Materia Prima'
      }
    ]
  });
});

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ 
    message: 'API de Innovadomprod funcionando en modo desarrollo',
    version: '1.0.0-dev',
    mode: 'development (sin MongoDB)',
    endpoints: {
      auth: '/api/auth/login',
      products: '/api/products',
      clients: '/api/clients',
      suppliers: '/api/suppliers'
    }
  });
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Algo salió mal en el servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor de desarrollo corriendo en puerto ${PORT}`);
  console.log(`📱 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`🔗 API: http://localhost:${PORT}`);
  console.log(`⚠️  MODO: Desarrollo (sin MongoDB)`);
  console.log(`🔑 Credenciales: admin@innovadomprod.com / admin123`);
});
