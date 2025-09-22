import mongoose from 'mongoose';

class DatabaseManager {
  constructor() {
    this.connections = new Map(); // Cache de conexiones por tenant
    this.models = new Map(); // Cache de modelos por tenant
  }

  /**
   * Obtiene o crea una conexión para un tenant específico
   * @param {Object} tenant - Objeto tenant con información de BD
   * @returns {Promise<mongoose.Connection>}
   */
  async getTenantConnection(tenant) {
    const tenantId = tenant._id.toString();
    
    // Si ya existe la conexión, devolverla
    if (this.connections.has(tenantId)) {
      const connection = this.connections.get(tenantId);
      if (connection.readyState === 1) { // 1 = connected
        return connection;
      } else {
        // Limpiar conexión inválida
        this.connections.delete(tenantId);
        this.models.delete(tenantId);
      }
    }

    try {
      // Crear nueva conexión
      const connectionString = tenant.database.isShared 
        ? process.env.MONGODB_URI 
        : tenant.database.connectionString;
      
      const databaseName = tenant.database.databaseName;
      
      const connection = await mongoose.createConnection(connectionString, {
        dbName: databaseName,
        maxPoolSize: 5, // Menor pool para tenants individuales
        serverSelectionTimeoutMS: 10000, // Aumentar timeout
        socketTimeoutMS: 45000,
        bufferCommands: true, // Habilitar buffering para evitar errores
        connectTimeoutMS: 10000,
      });

      // Manejar eventos de la conexión
      connection.on('error', (err) => {
        this.connections.delete(tenantId);
        this.models.delete(tenantId);
      });

      connection.on('disconnected', () => {
        this.connections.delete(tenantId);
        this.models.delete(tenantId);
      });

      // Guardar conexión en cache
      this.connections.set(tenantId, connection);
      
      return connection;

    } catch (error) {
      throw new Error(`No se pudo conectar a la base de datos del tenant: ${error.message}`);
    }
  }

  /**
   * Obtiene los modelos para un tenant específico
   * @param {Object} tenant - Objeto tenant
   * @returns {Promise<Object>} - Objeto con todos los modelos
   */
  async getTenantModels(tenant) {
    const tenantId = tenant._id.toString();
    
    // Si ya existen los modelos, devolverlos
    if (this.models.has(tenantId)) {
      return this.models.get(tenantId);
    }

    try {
      const connection = await this.getTenantConnection(tenant);
      
      // Importar modelos existentes para obtener sus esquemas
      const { default: User } = await import('../models/User.js');
      const { default: Product } = await import('../models/Product.js');
      const { default: Client } = await import('../models/Client.js');
      const { default: Supplier } = await import('../models/Supplier.js');
      const { default: Recipe } = await import('../models/Recipe.js');
      const { default: Batch } = await import('../models/Batch.js');
      const { default: Sale } = await import('../models/Sale.js');
      const { default: Purchase } = await import('../models/Purchase.js');
      const { default: Package } = await import('../models/Package.js');
      const { default: Bank } = await import('../models/Bank.js');
      const { default: BankTransaction } = await import('../models/BankTransaction.js');

      // Crear modelos específicos para este tenant usando los esquemas existentes
      const models = {
        User: connection.model('User', User.schema),
        Product: connection.model('Product', Product.schema),
        Client: connection.model('Client', Client.schema),
        Supplier: connection.model('Supplier', Supplier.schema),
        Recipe: connection.model('Recipe', Recipe.schema),
        Batch: connection.model('Batch', Batch.schema),
        Sale: connection.model('Sale', Sale.schema),
        Purchase: connection.model('Purchase', Purchase.schema),
        Package: connection.model('Package', Package.schema),
        Bank: connection.model('Bank', Bank.schema),
        BankTransaction: connection.model('BankTransaction', BankTransaction.schema),
      };

      // Guardar modelos en cache
      this.models.set(tenantId, models);
      
      return models;

    } catch (error) {
      throw new Error(`No se pudieron cargar los modelos del tenant: ${error.message}`);
    }
  }

  /**
   * Cierra la conexión de un tenant específico
   * @param {string} tenantId - ID del tenant
   */
  async closeTenantConnection(tenantId) {
    if (this.connections.has(tenantId)) {
      const connection = this.connections.get(tenantId);
      await connection.close();
      this.connections.delete(tenantId);
      this.models.delete(tenantId);
    }
  }

  /**
   * Cierra todas las conexiones
   */
  async closeAllConnections() {
    const closePromises = [];
    
    for (const [tenantId, connection] of this.connections) {
      closePromises.push(
        connection.close().then(() => {
        })
      );
    }
    
    await Promise.all(closePromises);
    this.connections.clear();
    this.models.clear();
  }

  /**
   * Obtiene estadísticas de las conexiones
   */
  getConnectionStats() {
    const stats = {
      totalConnections: this.connections.size,
      tenants: []
    };

    for (const [tenantId, connection] of this.connections) {
      stats.tenants.push({
        tenantId,
        status: connection.readyState,
        database: connection.name
      });
    }

    return stats;
  }

  /**
   * Limpia conexiones inactivas
   */
  cleanupInactiveConnections() {
    for (const [tenantId, connection] of this.connections) {
      if (connection.readyState !== 1) { // No conectada
        this.connections.delete(tenantId);
        this.models.delete(tenantId);
      }
    }
  }

  /**
   * Inicializa la base de datos de un nuevo tenant
   * @param {Object} tenant - Objeto tenant
   */
  async initializeTenantDatabase(tenant) {
    try {
      const models = await this.getTenantModels(tenant);
      
      // Crear índices y datos iniciales si es necesario
      
      // Crear usuario administrador inicial si no existe
      const adminExists = await models.User.findOne({ role: 'admin' });
      if (!adminExists && tenant.adminUser) {
        // El usuario admin ya debe existir, solo asociarlo al tenant
      }

      return true;
    } catch (error) {
      throw error;
    }
  }
}

// Crear instancia singleton
const databaseManager = new DatabaseManager();

// Manejar cierre graceful
process.on('SIGINT', async () => {
  await databaseManager.closeAllConnections();
});

process.on('SIGTERM', async () => {
  await databaseManager.closeAllConnections();
});

export default databaseManager;
