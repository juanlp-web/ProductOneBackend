import http from 'http';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 5000;

// Función para parsear JSON del body
const parseJSON = (body) => {
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
};

// Función para crear respuesta JSON
const jsonResponse = (res, data, statusCode = 200) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
};

// Función para crear respuesta de texto
const textResponse = (res, text, statusCode = 200) => {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
  res.end(text);
};

// Función para manejar CORS
const handleCORS = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
};

// Crear servidor HTTP
const server = http.createServer(async (req, res) => {
  // Manejar CORS
  handleCORS(req, res);
  
  // Manejar preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const { method, url } = req;
  
  try {
    // Ruta principal
    if (url === '/' && method === 'GET') {
      return jsonResponse(res, {
        message: 'API de Innovadomprod funcionando correctamente',
        version: '1.0.0',
        status: 'running',
        server: 'Node.js HTTP nativo'
      });
    }

    // Ruta de prueba de API
    if (url === '/api/test' && method === 'GET') {
      return jsonResponse(res, {
        message: 'API funcionando con Node.js nativo',
        timestamp: new Date().toISOString(),
        method: method,
        url: url
      });
    }

    // Ruta de salud
    if (url === '/api/health' && method === 'GET') {
      return jsonResponse(res, {
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform
      });
    }

    // Ruta de autenticación simulada
    if (url === '/api/auth/login' && method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        const { email, password } = parseJSON(body);
        
        // Simular autenticación
        if (email === 'admin@innovadomprod.com' && password === 'admin123') {
          return jsonResponse(res, {
            success: true,
            message: 'Login exitoso',
            user: {
              id: 'admin-001',
              name: 'Administrador',
              email: email,
              role: 'admin'
            },
            token: 'simulated-jwt-token-' + Date.now()
          });
        } else {
          return jsonResponse(res, {
            success: false,
            message: 'Credenciales inválidas'
          }, 401);
        }
      });
      return;
    }

    // Ruta para productos simulados
    if (url === '/api/products' && method === 'GET') {
      return jsonResponse(res, {
        products: [
          {
            id: 'prod-001',
            name: 'Producto de Prueba',
            description: 'Este es un producto de prueba',
            price: 25.50,
            stock: 100
          }
        ],
        total: 1,
        message: 'Productos de prueba (API simulada)'
      });
    }

    // Ruta no encontrada
    return jsonResponse(res, {
      error: 'Ruta no encontrada',
      path: url,
      method: method,
      availableRoutes: [
        'GET /',
        'GET /api/test',
        'GET /api/health',
        'POST /api/auth/login',
        'GET /api/products'
      ]
    }, 404);

  } catch (error) {
    console.error('Error del servidor:', error);
    return jsonResponse(res, {
      error: 'Error interno del servidor',
      message: error.message
    }, 500);
  }
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`🚀 Servidor HTTP nativo corriendo en puerto ${PORT}`);
  console.log(`📱 Frontend: http://localhost:5173`);
  console.log(`🔗 API: http://localhost:${PORT}`);
  console.log(`✅ Servidor listo para recibir peticiones`);
  console.log(`📋 Rutas disponibles:`);
  console.log(`   - GET  /`);
  console.log(`   - GET  /api/test`);
  console.log(`   - GET  /api/health`);
  console.log(`   - POST /api/auth/login`);
  console.log(`   - GET  /api/products`);
});

export default server;
