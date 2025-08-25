import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Client from './models/Client.js';

// Cargar variables de entorno
dotenv.config();

const migrateClientsStatus = async () => {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Actualizar clientes existentes
    const result = await Client.updateMany(
      { status: { $exists: false } },
      [
        {
          $set: {
            status: {
              $cond: {
                if: { $eq: ['$isActive', true] },
                then: 'Activo',
                else: 'Inactivo'
              }
            }
          }
        }
      ]
    );

    console.log(`✅ Migración completada: ${result.modifiedCount} clientes actualizados`);

    // Verificar que todos los clientes tengan el campo status
    const clientsWithoutStatus = await Client.countDocuments({ status: { $exists: false } });
    console.log(`📊 Clientes sin campo status: ${clientsWithoutStatus}`);

    // Mostrar algunos ejemplos
    const sampleClients = await Client.find().limit(5).select('name isActive status');
    console.log('📋 Ejemplos de clientes:');
    sampleClients.forEach(client => {
      console.log(`  - ${client.name}: isActive=${client.isActive}, status=${client.status}`);
    });

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
};

// Ejecutar migración
migrateClientsStatus();
