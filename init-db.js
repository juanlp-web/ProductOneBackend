import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';


// Cargar variables de entorno
dotenv.config();

const initializeDatabase = async () => {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://productonex:XjAF5GpGROZK3aPm@cluster0.imw9vyz.mongodb.net/productonex');
    console.log('✅ Conectado a MongoDB');

    // Verificar si ya existe un usuario admin
    const adminExists = await User.findOne({ role: 'admin' });
    
    if (!adminExists) {
      // Crear usuario administrador por defecto
      const adminUser = new User({
        name: 'Administrador',
        email: 'admin@innovadomprod.com',
        password: 'admin123',
        role: 'admin',
        isActive: true
      });

      await adminUser.save();
      console.log('✅ Usuario administrador creado');
      console.log('📧 Email: admin@innovadomprod.com');
      console.log('🔑 Contraseña: admin123');
      console.log('⚠️  IMPORTANTE: Cambia la contraseña después del primer login');
    } else {
      console.log('ℹ️  Usuario administrador ya existe');
    }

    // Crear índices de texto para búsquedas
    await User.createIndexes();
    console.log('✅ Índices creados');

    console.log('🎉 Base de datos inicializada correctamente');
    
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Conexión a MongoDB cerrada');
  }
};

  initializeDatabase();


export default initializeDatabase;
