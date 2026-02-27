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
import bankRoutes from './routes/banks.js';
import bankTransactionRoutes from './routes/bankTransactions.js';
import accountRoutes from './routes/accounts.js';
import accountConfigRoutes from './routes/accountConfigs.js';
import adminRoutes from './routes/admin.js';
import importRoutes from './routes/import.js';

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

// Conectar a MongoDB (en segundo plano, no bloquea el inicio del servidor)
const setupDatabase = async () => {
  try {
    await connectDB();
    app.use(identifyTenant);
    app.use(logTenantActivity);
  } catch (error) {
    console.error('Error conectando a MongoDB:', error.message);
    // El servidor sigue corriendo; checkDBHealth responderá 503 en rutas que requieren DB
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
app.use('/api/banks', bankRoutes);
app.use('/api/bank-transactions', bankTransactionRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/account-configs', accountConfigRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/import', importRoutes);

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
      purchases: '/api/purchases',
      banks: '/api/banks'
    }
  });
});



// Middleware de manejo de errores
app.use((err, req, res, next) => {
  res.status(500).json({ 
    message: 'Algo salió mal en el servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

// IMPORTANTE para Render: iniciar app.listen() PRIMERO para que detecte el puerto
// La conexión a MongoDB se hace en segundo plano
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
  setupDatabase();
});
