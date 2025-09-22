import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';


// Cargar variables de entorno
dotenv.config();

const initializeDatabase = async () => {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://productonex:XjAF5GpGROZK3aPm@cluster0.imw9vyz.mongodb.net/productonex');

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
    } else {
    }

    // Crear índices de texto para búsquedas
    await User.createIndexes();

    
  } catch (error) {
  } finally {
    await mongoose.disconnect();
  }
};

  initializeDatabase();


export default initializeDatabase;
