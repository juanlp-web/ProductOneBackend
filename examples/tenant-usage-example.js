/**
 * EJEMPLO DE USO DEL SISTEMA MULTI-TENANT SAAS
 * 
 * Este archivo muestra cómo funciona el sistema multi-tenant y cómo
 * asignar usuarios a diferentes bases de datos.
 */

// ============================================
// 1. REGISTRO DE NUEVO TENANT (EMPRESA)
// ============================================

const registerTenantExample = {
  method: 'POST',
  url: '/api/tenants/register',
  headers: {
    'Content-Type': 'application/json'
  },
  body: {
    subdomain: 'empresa123',           // URL será: empresa123.tudominio.com
    companyName: 'Empresa ABC S.A.',
    companyEmail: 'admin@empresa123.com',
    companyPhone: '+57 300 123 4567',
    adminUser: {
      username: 'admin_empresa123',
      email: 'admin@empresa123.com',
      password: 'password123',
      firstName: 'Juan',
      lastName: 'Pérez'
    }
  }
  // Respuesta:
  // {
  //   "success": true,
  //   "data": {
  //     "tenant": {
  //       "id": "64f...",
  //       "subdomain": "empresa123",
  //       "companyName": "Empresa ABC S.A.",
  //       "status": "trial",
  //       "plan": "free",
  //       "trialEndsAt": "2024-02-15T..."
  //     },
  //     "adminUser": { ... },
  //     "accessInfo": {
  //       "url": "https://empresa123.tudominio.com",
  //       "databaseName": "tenant_empresa123_1705123456789"
  //     }
  //   }
  // }
};

// ============================================
// 2. ACCESO A LA APLICACIÓN POR TENANT
// ============================================

// Cuando un usuario accede a empresa123.tudominio.com:

const accessExample = {
  // El middleware identifyTenant automáticamente:
  
  // 1. Detecta el subdominio "empresa123"
  // 2. Busca el tenant en la BD principal
  // 3. Conecta a la BD específica del tenant
  // 4. Carga los modelos para esa BD
  // 5. Agrega req.tenant y req.tenantModels al request
  
  // Ejemplo de request resultante:
  request: {
    tenant: {
      _id: '64f...',
      subdomain: 'empresa123',
      companyName: 'Empresa ABC S.A.',
      status: 'trial',
      plan: 'free',
      // ... resto de datos
    },
    tenantModels: {
      User: 'Modelo User para BD del tenant',
      Product: 'Modelo Product para BD del tenant',
      Client: 'Modelo Client para BD del tenant',
      // ... resto de modelos
    }
  }
};

// ============================================
// 3. MANEJO DE DIFERENTES BASES DE DATOS
// ============================================

// ESTRUCTURA DE BDS:
// 
// 1. BD PRINCIPAL (innovadomprod_main):
//    - Colección: tenants (información de empresas)
//    - Colección: users (usuarios cross-tenant, super admins)
//
// 2. BD TENANT 1 (tenant_empresa123_1705123456789):
//    - Colección: users (usuarios de empresa123)
//    - Colección: products (productos de empresa123)
//    - Colección: clients (clientes de empresa123)
//    - ... resto de colecciones
//
// 3. BD TENANT 2 (tenant_empresa456_1705123789456):
//    - Colección: users (usuarios de empresa456)
//    - Colección: products (productos de empresa456)
//    - ... completamente separado de empresa123

// ============================================
// 4. EJEMPLO DE MIDDLEWARE EN RUTAS
// ============================================

// Archivo: routes/products.js (ejemplo)
const productRoutesExample = `
import { identifyTenant, requireTenant, checkTenantLimits, getModel } from '../middleware/tenant.js';

// Crear producto (con tenant)
router.post('/', 
  identifyTenant,           // Identifica el tenant
  requireTenant,            // Requiere tenant válido
  protect,                  // Autenticación
  checkTenantLimits('products'), // Verifica límites del plan
  getModel('Product'),      // Obtiene modelo correcto
  async (req, res) => {
    // req.Model ahora apunta al modelo Product del tenant correcto
    const product = await req.Model.create(req.body);
    res.json({ success: true, data: product });
  }
);
`;

// ============================================
// 5. FLUJO COMPLETO DE USUARIO
// ============================================

const userFlowExample = {
  // 1. EMPRESA SE REGISTRA
  step1: {
    action: 'POST /api/tenants/register',
    result: 'Se crea tenant + BD + usuario admin'
  },
  
  // 2. USUARIOS ACCEDEN POR SUBDOMINIO
  step2: {
    url: 'https://empresa123.tudominio.com/login',
    action: 'Middleware detecta tenant automáticamente',
    result: 'Usuario se autentica en BD específica'
  },
  
  // 3. USUARIOS OPERAN EN SU BD
  step3: {
    actions: [
      'Crear productos → BD del tenant',
      'Gestionar clientes → BD del tenant', 
      'Hacer ventas → BD del tenant'
    ],
    isolation: 'Datos completamente aislados por tenant'
  },
  
  // 4. UPGRADE DE PLAN
  step4: {
    action: 'POST /api/tenants/upgrade',
    body: { plan: 'premium' },
    result: 'Aumentan límites y features disponibles'
  }
};

// ============================================
// 6. CONFIGURACIÓN DE VARIABLES DE ENTORNO
// ============================================

const envConfigExample = `
# .env file

# BD Principal (para tenants y super admins)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/innovadomprod_main

# Dominio base para subdominos
BASE_DOMAIN=tudominio.com

# JWT Secret
JWT_SECRET=tu_jwt_secret_aqui

# Email service (para notificaciones)
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@tudominio.com
SMTP_PASS=tu_password_email
`;

// ============================================
// 7. EJEMPLO DE FRONTEND MULTI-TENANT
// ============================================

const frontendExample = `
// Frontend debe detectar tenant y enviar header

// En src/config/api.js
const getTenantFromUrl = () => {
  const hostname = window.location.hostname;
  const subdomain = hostname.split('.')[0];
  return subdomain !== 'www' && subdomain !== 'localhost' ? subdomain : null;
};

// Interceptor para agregar tenant header
api.interceptors.request.use(config => {
  const tenant = getTenantFromUrl();
  if (tenant) {
    config.headers['X-Tenant-ID'] = tenant;
  }
  
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = \`Bearer \${token}\`;
  }
  
  return config;
});
`;

// ============================================
// 8. PLANES Y LÍMITES DEL SISTEMA
// ============================================

const plansExample = {
  free: {
    maxUsers: 5,
    maxProducts: 100,
    maxClients: 50,
    maxSuppliers: 20,
    features: {
      inventory: true,
      sales: true,
      reports: false,
      api: false
    },
    price: 0
  },
  
  basic: {
    maxUsers: 20,
    maxProducts: 1000,
    maxClients: 500,
    maxSuppliers: 100,
    features: {
      inventory: true,
      sales: true,
      reports: true,
      api: false
    },
    price: 29.99
  },
  
  enterprise: {
    maxUsers: -1, // Ilimitado
    maxProducts: -1,
    maxClients: -1,
    maxSuppliers: -1,
    features: {
      inventory: true,
      sales: true,
      reports: true,
      api: true,
      customBranding: true
    },
    price: 99.99
  }
};

// ============================================
// 9. ENDPOINTS PRINCIPALES
// ============================================

const endpointsExample = {
  // Gestión de tenants
  'POST /api/tenants/register': 'Registrar nueva empresa',
  'GET /api/tenants/current': 'Info del tenant actual',
  'PUT /api/tenants/current': 'Actualizar tenant',
  'POST /api/tenants/upgrade': 'Upgrade de plan',
  
  // Endpoints existentes (ahora multi-tenant)
  'POST /api/products': 'Crear producto (en BD del tenant)',
  'GET /api/products': 'Listar productos (del tenant)',
  'POST /api/sales': 'Crear venta (en BD del tenant)',
  // ... todos los endpoints funcionan igual pero con aislamiento
};

export {
  registerTenantExample,
  accessExample,
  userFlowExample,
  envConfigExample,
  frontendExample,
  plansExample,
  endpointsExample
};
