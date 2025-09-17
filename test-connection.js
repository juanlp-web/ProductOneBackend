import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const testConnection = async () => {
  try {
    console.log('🔄 Iniciando prueba de conexión...');
    console.log('📝 Cadena de conexión:', process.env.MONGODB_URI?.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
    
    // Intentar conectar con configuración robusta
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      bufferCommands: true,
      bufferMaxEntries: 0,
      connectTimeoutMS: 10000,
    });

    console.log('✅ Conexión exitosa!');
    console.log('🏠 Host:', conn.connection.host);
    console.log('📊 Base de datos:', conn.connection.name);
    console.log('🔢 Estado:', conn.connection.readyState);

    // Probar operación básica
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📁 Colecciones encontradas:', collections.length);
    
    if (collections.length > 0) {
      console.log('📋 Primeras colecciones:');
      collections.slice(0, 5).forEach(col => {
        console.log(`   - ${col.name}`);
      });
    }

    // Cerrar conexión
    await mongoose.connection.close();
    console.log('🔄 Conexión cerrada correctamente');
    
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    
    if (error.name === 'MongooseServerSelectionError') {
      console.error('💡 Posibles causas:');
      console.error('   - Credenciales incorrectas');
      console.error('   - IP no está en whitelist');
      console.error('   - Cluster no disponible');
      console.error('   - Problemas de red');
    }
    
    process.exit(1);
  }
};

// Ejecutar prueba
testConnection();
