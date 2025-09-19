import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import productRoutes from './routes/products.js';
import clientRoutes from './routes/clients.js';
import supplierRoutes from './routes/suppliers.js';
import recipeRoutes from './routes/recipes.js';
import batchRoutes from './routes/batches.js';
import inventoryRoutes from './routes/inventory.js';
import salesRoutes from './routes/sales.js';
import purchaseRoutes from './routes/purchases.js';
import packageRoutes from './routes/packages.js';
import dashboardRoutes from './routes/dashboard.js';
import profileRoutes from './routes/profile.js';
import tenantRoutes from './routes/tenants.js';
import configRoutes from './routes/config.js';

// Middleware de tenant y salud
import { identifyTenant, logTenantActivity } from './middleware/tenant.js';
import { checkDBHealth, dbHealthCheck } from './middleware/dbHealth.js';

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

// Aplicar middleware de salud antes que todo
app.use('/health', dbHealthCheck);
app.use(checkDBHealth);

// Conectar a MongoDB y esperar a que esté listo
const startServer = async () => {
  try {
    await connectDB();
    
    // Solo aplicar middleware de tenant después de conectar a MongoDB
    app.use(identifyTenant);
    app.use(logTenantActivity);
    
    console.log('✅ Middleware de tenant aplicado después de conexión DB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB, no se aplicará middleware de tenant');
    throw error; // Re-lanzar error para que el servidor no inicie si no hay DB
  }
};

// Rutas
app.use('/api/tenants', tenantRoutes); // Rutas de gestión de tenants
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/config', configRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ 
    message: 'API de Innovadomprod funcionando correctamente',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      products: '/api/products',
      clients: '/api/clients',
      suppliers: '/api/suppliers',
      recipes: '/api/recipes',
      batches: '/api/batches',
      inventory: '/api/inventory',
      sales: '/api/sales',
      purchases: '/api/purchases'
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

// Iniciar servidor después de configurar todo
const initializeServer = async () => {
  await startServer();
  
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📱 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    console.log(`🔗 API: http://localhost:${PORT}`);
  });
};

initializeServer().catch(error => {
  console.error('❌ Error inicializando servidor:', error);
  process.exit(1);
});
