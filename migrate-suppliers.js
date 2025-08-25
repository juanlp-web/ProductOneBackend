import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Supplier from './models/Supplier.js';

dotenv.config();

const migrateSuppliers = async () => {
  try {
    console.log('🚀 Iniciando migración de proveedores...');
    
    // Conectar a MongoDB
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      bufferMaxEntries: 0,
    });
    
    console.log(`✅ Conectado a MongoDB Atlas: ${conn.connection.host}`);
    console.log(`📊 Base de datos: ${conn.connection.name}`);

    // Obtener todos los proveedores existentes
    const suppliers = await Supplier.find({});
    console.log(`📋 Encontrados ${suppliers.length} proveedores para migrar`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const supplier of suppliers) {
      try {
        // Verificar si ya está migrado
        if (supplier.contactName !== undefined) {
          console.log(`⏭️  Proveedor "${supplier.name}" ya migrado, saltando...`);
          skippedCount++;
          continue;
        }

        // Preparar datos migrados
        const migratedData = {
          name: supplier.name,
          category: supplier.category,
          status: supplier.status,
          rating: supplier.rating,
          paymentTerms: supplier.paymentTerms,
          creditLimit: supplier.creditLimit,
          taxId: supplier.taxId,
          notes: supplier.notes,
          lastOrder: supplier.lastOrder,
          totalOrders: supplier.totalOrders,
          totalSpent: supplier.totalSpent,
          documents: supplier.documents,
          tags: supplier.tags,
          isActive: supplier.isActive,
          createdAt: supplier.createdAt,
          updatedAt: supplier.updatedAt
        };

        // Migrar información de contacto
        if (supplier.contact) {
          migratedData.contactName = supplier.contact.name || '';
          migratedData.contactPhone = supplier.contact.phone || '';
        } else {
          migratedData.contactName = '';
          migratedData.contactPhone = '';
        }

        // Migrar dirección
        if (supplier.address) {
          const addressParts = [];
          if (supplier.address.street) addressParts.push(supplier.address.street);
          if (supplier.address.city) addressParts.push(supplier.address.city);
          if (supplier.address.state) addressParts.push(supplier.address.state);
          if (supplier.address.zipCode) addressParts.push(supplier.address.zipCode);
          
          migratedData.address = addressParts.join(', ');
        } else {
          migratedData.address = '';
        }

        // Actualizar el proveedor
        await Supplier.findByIdAndUpdate(supplier._id, migratedData, { new: true });
        
        console.log(`✅ Proveedor "${supplier.name}" migrado exitosamente`);
        migratedCount++;

      } catch (error) {
        console.error(`❌ Error migrando proveedor "${supplier.name}":`, error.message);
      }
    }

    console.log('\n🎉 Migración completada!');
    console.log(`📊 Resumen:`);
    console.log(`   - Proveedores migrados: ${migratedCount}`);
    console.log(`   - Proveedores saltados: ${skippedCount}`);
    console.log(`   - Total procesados: ${migratedCount + skippedCount}`);

    // Mostrar ejemplo de proveedor migrado
    if (migratedCount > 0) {
      const sampleSupplier = await Supplier.findOne({ contactName: { $exists: true } });
      if (sampleSupplier) {
        console.log('\n📋 Ejemplo de proveedor migrado:');
        console.log(`   Nombre: ${sampleSupplier.name}`);
        console.log(`   Contacto: ${sampleSupplier.contactName}`);
        console.log(`   Teléfono: ${sampleSupplier.contactPhone}`);
        console.log(`   Dirección: ${sampleSupplier.address}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
    process.exit(0);
  }
};

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateSuppliers();
}

export default migrateSuppliers;

