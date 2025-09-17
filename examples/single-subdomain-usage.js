/**
 * EJEMPLO DE USO DEL SISTEMA MULTI-TENANT CON UN SOLO SUBDOMINIO
 * 
 * Este archivo muestra cómo funciona el sistema cuando se usa
 * un solo subdominio (ej: app.tudominio.com) para todas las empresas.
 */

// ============================================
// 1. CONFIGURACIÓN DE UN SOLO SUBDOMINIO
// ============================================

const singleSubdomainConfig = {
  // URL principal de la aplicación
  mainUrl: 'https://app.tudominio.com',
  
  // Métodos de identificación de tenant:
  methods: [
    'Header X-Tenant-ID (principal)',
    'Token JWT con tenantId',
    'Query parameter ?tenant=empresa123'
  ],
  
  // Ventajas:
  advantages: [
    'Solo un dominio/subdominio que mantener',
    'Certificados SSL más simples',
    'Un solo despliegue de frontend',
    'Más fácil de mantener'
  ]
};

// ============================================
// 2. FLUJO DE REGISTRO DE EMPRESA
// ============================================

const registrationFlow = {
  step1: {
    description: 'Super admin registra nueva empresa',
    endpoint: 'POST /api/tenants/register',
    body: {
      subdomain: 'empresa123',        // Solo para identificación interna
      companyName: 'Empresa ABC S.A.',
      companyEmail: 'admin@empresa123.com',
      adminUser: {
        username: 'admin_empresa123',
        email: 'admin@empresa123.com',
        password: 'password123',
        firstName: 'Juan',
        lastName: 'Pérez'
      }
    },
    result: {
      // Se crea tenant pero NO se asigna subdominio real
      tenant: 'empresa123 (solo identificador)',
      database: 'tenant_empresa123_1705123456789',
      accessUrl: 'https://app.tudominio.com', // Mismo para todos
      adminCredentials: 'admin@empresa123.com / password123'
    }
  }
};

// ============================================
// 3. FLUJO DE ACCESO DE USUARIOS
// ============================================

const userAccessFlow = {
  // OPCIÓN 1: Login normal + selección de empresa
  option1: {
    step1: 'Usuario va a https://app.tudominio.com/login',
    step2: 'Hace login con email/password',
    step3: 'Si pertenece a múltiples empresas, aparece selector',
    step4: 'Selecciona empresa → se guarda en localStorage',
    step5: 'Todas las peticiones incluyen X-Tenant-ID header'
  },
  
  // OPCIÓN 2: Login directo con tenant
  option2: {
    step1: 'Usuario usa link: https://app.tudominio.com/login?tenant=empresa123',
    step2: 'Sistema auto-detecta tenant del query param',
    step3: 'Login se hace directamente en BD del tenant',
    step4: 'Token JWT incluye tenantId automáticamente'
  },
  
  // OPCIÓN 3: Token con tenant embebido
  option3: {
    step1: 'Usuario ya tiene token con tenantId',
    step2: 'Middleware extrae tenantId del JWT',
    step3: 'Conecta automáticamente a BD correcta',
    step4: 'No necesita selección manual'
  }
};

// ============================================
// 4. IMPLEMENTACIÓN EN EL FRONTEND
// ============================================

const frontendImplementation = `
// ==========================================
// src/config/api.js - Configuración de API
// ==========================================

// Interceptor para agregar tenant automáticamente
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = \`Bearer \${token}\`;
  }
  
  // Agregar tenant seleccionado
  const tenantId = localStorage.getItem('selectedTenant');
  if (tenantId) {
    config.headers['X-Tenant-ID'] = tenantId;
  }
  
  return config;
});

// ==========================================
// Componente TenantSelector
// ==========================================

const TenantSelector = () => {
  const [tenants, setTenants] = useState([]);
  const [selected, setSelected] = useState(null);
  
  // Cargar empresas disponibles para el usuario
  useEffect(() => {
    if (user.tenantId) {
      // Usuario normal: solo su empresa
      loadSingleTenant();
    } else {
      // Super admin: todas las empresas
      loadAllTenants();
    }
  }, [user]);
  
  const selectTenant = (tenant) => {
    localStorage.setItem('selectedTenant', tenant.subdomain);
    setSelected(tenant);
    window.location.reload(); // Recargar para aplicar contexto
  };
  
  return (
    <select onChange={(e) => selectTenant(e.target.value)}>
      <option>Seleccionar Empresa</option>
      {tenants.map(t => (
        <option key={t.id} value={t.subdomain}>
          {t.name} ({t.plan})
        </option>
      ))}
    </select>
  );
};

// ==========================================
// Integración en App.jsx
// ==========================================

const App = () => {
  return (
    <div>
      <Sidebar>
        <TenantSelector /> {/* Selector en sidebar */}
        <MenuItems />
      </Sidebar>
      <MainContent />
    </div>
  );
};
`;

// ============================================
// 5. CONFIGURACIÓN DEL BACKEND
// ============================================

const backendConfiguration = `
// ==========================================
// server.js - Configuración principal
// ==========================================

// Middleware global para identificar tenant
app.use(identifyTenant);  // Identifica por header, query o JWT
app.use(logTenantActivity);

// Todas las rutas automáticamente tienen contexto de tenant
app.use('/api/products', productRoutes);   // Productos del tenant
app.use('/api/clients', clientRoutes);     // Clientes del tenant
app.use('/api/sales', salesRoutes);        // Ventas del tenant

// ==========================================
// middleware/tenant.js - Identificación
// ==========================================

export const identifyTenant = async (req, res, next) => {
  let tenantId = null;
  
  // 1. Header X-Tenant-ID (principal)
  if (req.headers['x-tenant-id']) {
    tenantId = req.headers['x-tenant-id'];
  }
  // 2. Query parameter
  else if (req.query.tenant) {
    tenantId = req.query.tenant;
  }
  // 3. JWT token
  else if (req.headers.authorization) {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.tenantId) {
      const tenant = await Tenant.findById(decoded.tenantId);
      tenantId = tenant.subdomain;
    }
  }
  
  if (tenantId) {
    const tenant = await Tenant.findBySubdomain(tenantId);
    req.tenant = tenant;
    req.tenantModels = await databaseManager.getTenantModels(tenant);
  }
  
  next();
};
`;

// ============================================
// 6. EJEMPLOS DE PETICIONES HTTP
// ============================================

const httpExamples = {
  // Crear producto para empresa123
  createProduct: {
    method: 'POST',
    url: 'https://app.tudominio.com/api/products',
    headers: {
      'Authorization': 'Bearer jwt_token_here',
      'X-Tenant-ID': 'empresa123',
      'Content-Type': 'application/json'
    },
    body: {
      name: 'Producto A',
      price: 100,
      stock: 50
    },
    result: 'Producto guardado en BD de empresa123'
  },
  
  // Obtener ventas para empresa456
  getSales: {
    method: 'GET',
    url: 'https://app.tudominio.com/api/sales',
    headers: {
      'Authorization': 'Bearer jwt_token_here',
      'X-Tenant-ID': 'empresa456'
    },
    result: 'Ventas solo de empresa456'
  },
  
  // Login con tenant específico
  loginWithTenant: {
    method: 'POST',
    url: 'https://app.tudominio.com/api/auth/login?tenant=empresa123',
    body: {
      email: 'user@empresa123.com',
      password: 'password123'
    },
    result: {
      token: 'jwt_con_tenantId_empresa123',
      user: 'datos_usuario_de_empresa123'
    }
  }
};

// ============================================
// 7. ESTRUCTURA DE BASES DE DATOS
// ============================================

const databaseStructure = {
  principal: {
    name: 'innovadomprod_main',
    collections: [
      'tenants',      // Info de todas las empresas
      'users'         // Solo super admins cross-tenant
    ],
    access: 'Sistema principal y registro de tenants'
  },
  
  tenant1: {
    name: 'tenant_empresa123_1705123456789',
    collections: [
      'users',        // Usuarios de empresa123
      'products',     // Productos de empresa123
      'clients',      // Clientes de empresa123
      'sales',        // Ventas de empresa123
      // ... resto de colecciones
    ],
    access: 'Solo empresa123 via X-Tenant-ID: empresa123'
  },
  
  tenant2: {
    name: 'tenant_empresa456_1705123789456',
    collections: [
      'users',        // Usuarios de empresa456 (aislados)
      'products',     // Productos de empresa456 (aislados)
      // ... completamente separado
    ],
    access: 'Solo empresa456 via X-Tenant-ID: empresa456'
  }
};

// ============================================
// 8. FLUJO COMPLETO DE EJEMPLO
// ============================================

const completeExample = {
  scenario: 'Usuario de empresa123 creando una venta',
  
  step1: {
    action: 'Usuario accede a https://app.tudominio.com',
    frontend: 'TenantSelector carga empresas del usuario',
    result: 'Aparece selector con "Empresa ABC S.A."'
  },
  
  step2: {
    action: 'Usuario selecciona "Empresa ABC S.A."',
    frontend: 'localStorage.setItem("selectedTenant", "empresa123")',
    result: 'Página se recarga con contexto de empresa123'
  },
  
  step3: {
    action: 'Usuario va a /ventas y crea nueva venta',
    request: {
      url: 'POST /api/sales',
      headers: {
        'Authorization': 'Bearer jwt_token',
        'X-Tenant-ID': 'empresa123'
      }
    },
    backend: [
      'identifyTenant middleware detecta empresa123',
      'Busca tenant en BD principal',
      'Conecta a BD tenant_empresa123_xxx',
      'Crea venta en BD de empresa123'
    ],
    result: 'Venta guardada solo en BD de empresa123'
  }
};

// ============================================
// 9. VENTAJAS DEL ENFOQUE DE UN SOLO SUBDOMINIO
// ============================================

const advantages = {
  infrastructure: [
    'Un solo certificado SSL',
    'Un solo deployment de frontend',
    'Configuración de DNS más simple',
    'Un solo punto de entrada'
  ],
  
  maintenance: [
    'Actualizaciones centralizadas',
    'Monitoreo más simple',
    'Logs centralizados',
    'Backup strategy unificada'
  ],
  
  development: [
    'Testing más fácil',
    'Un solo environment por stage',
    'CI/CD más simple',
    'Debugging centralizado'
  ],
  
  userExperience: [
    'URL consistente para usuarios',
    'Bookmarks funcionan siempre',
    'Sharing de links más fácil',
    'Mejor SEO'
  ]
};

export {
  singleSubdomainConfig,
  registrationFlow,
  userAccessFlow,
  frontendImplementation,
  backendConfiguration,
  httpExamples,
  databaseStructure,
  completeExample,
  advantages
};
