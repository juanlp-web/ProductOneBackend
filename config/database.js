import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // Configuración más robusta para evitar errores de conexión
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Opciones recomendadas para MongoDB Atlas
      maxPoolSize: 10, // Mantener hasta 10 conexiones en el pool
      serverSelectionTimeoutMS: 5000, // Timeout para selección de servidor
      socketTimeoutMS: 45000, // Timeout para operaciones de socket
      bufferCommands: false, // Deshabilitar buffering de comandos

    });

    console.log(`✅ MongoDB Atlas conectado: ${conn.connection.host}`);
    console.log(`📊 Base de datos: ${conn.connection.name}`);

    // Manejar eventos de conexión
    mongoose.connection.on('error', (err) => {
      console.error('❌ Error de conexión MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB desconectado');
    });

    // Manejar cierre graceful
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔄 Conexión MongoDB cerrada por terminación de la aplicación');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error al conectar a MongoDB Atlas:', error.message);
    console.log('💡 Verifica tu cadena de conexión en el archivo .env');
    console.log('🔗 Formato esperado: mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>');
    process.exit(1);
  }
};

// Manejar desconexión
mongoose.connection.on('disconnected', () => {
  // Base de datos desconectada
});

// Manejar cierre de la aplicación
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});

// Manejar errores de conexión
mongoose.connection.on('error', (err) => {
  // Error en la conexión
  process.exit(1);
});

export default connectDB;
