import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Config from './models/Config.js';

// Cargar variables de entorno
dotenv.config();

const connectDB = async () => {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
};

const testIvaZero = async () => {
  try {
    await connectDB();
    
    console.log('🧪 Probando IVA del 0%...');
    
    // Crear un usuario de prueba
    const testUserId = new mongoose.Types.ObjectId();
    
    // Probar guardar IVA del 0%
    console.log('📝 Guardando IVA del 0%...');
    const config = await Config.setByKey(
      'iva_percentage', 
      0, 
      'number', 
      'Porcentaje de IVA aplicado a las ventas',
      testUserId
    );
    
    console.log('✅ Configuración guardada:', config);
    
    // Probar recuperar la configuración
    console.log('📖 Recuperando configuración...');
    const retrievedValue = await Config.getByKey('iva_percentage');
    console.log('✅ Valor recuperado:', retrievedValue, 'Tipo:', typeof retrievedValue);
    
    // Verificar que es exactamente 0
    if (retrievedValue === 0) {
      console.log('🎉 ¡ÉXITO! El IVA del 0% se guardó y recuperó correctamente');
    } else {
      console.log('❌ ERROR: El valor no es 0, es:', retrievedValue);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
    process.exit(1);
  }
};

testIvaZero();
