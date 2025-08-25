import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Supplier from './models/Supplier.js';

dotenv.config();

const sampleSuppliers = [
  {
    name: 'Beauty Supplies Co.',
    category: 'Ingredientes',
    contactName: 'Juan Pérez',
    contactPhone: '+1 809-555-0100',
    address: 'Calle Principal 123, Santo Domingo, Distrito Nacional, 10101',
    status: 'Activo',
    rating: 4.8,
    paymentTerms: '30 días',
    creditLimit: 50000,
    taxId: '123-456-789',
    notes: 'Proveedor confiable de ingredientes naturales',
    tags: ['natural', 'orgánico', 'confiable'],
    totalOrders: 45,
    totalSpent: 125000
  },
  {
    name: 'Natural Ingredients Ltd.',
    category: 'Ingredientes',
    contactName: 'María García',
    contactPhone: '+1 809-555-0200',
    address: 'Avenida Independencia 456, Santiago, Santiago, 51000',
    status: 'Activo',
    rating: 4.6,
    paymentTerms: '45 días',
    creditLimit: 75000,
    taxId: '987-654-321',
    notes: 'Especialistas en ingredientes orgánicos certificados',
    tags: ['orgánico', 'certificado', 'premium'],
    totalOrders: 32,
    totalSpent: 89000
  },
  {
    name: 'Cosmetic World',
    category: 'Embalajes',
    contactName: 'Carlos López',
    contactPhone: '+1 809-555-0300',
    address: 'Calle Comercial 789, La Romana, La Romana, 22000',
    status: 'Activo',
    rating: 4.4,
    paymentTerms: '30 días',
    creditLimit: 30000,
    taxId: '456-789-123',
    notes: 'Empaques personalizados de alta calidad',
    tags: ['personalizado', 'alta calidad', 'diseño'],
    totalOrders: 28,
    totalSpent: 67000
  },
  {
    name: 'Organic Beauty',
    category: 'Ingredientes',
    contactName: 'Ana Martínez',
    contactPhone: '+1 809-555-0400',
    address: 'Boulevard Turístico 321, Punta Cana, La Altagracia, 23000',
    status: 'Pendiente',
    rating: 4.2,
    paymentTerms: '60 días',
    creditLimit: 25000,
    taxId: '789-123-456',
    notes: 'Nuevo proveedor con productos innovadores',
    tags: ['innovador', 'nuevo', 'sostenible'],
    totalOrders: 5,
    totalSpent: 12000
  },
  {
    name: 'Packaging Solutions',
    category: 'Embalajes',
    contactName: 'Luis Rodríguez',
    contactPhone: '+1 809-555-0500',
    address: 'Calle Industrial 654, San Pedro de Macorís, San Pedro de Macorís, 21000',
    status: 'Activo',
    rating: 4.7,
    paymentTerms: '30 días',
    creditLimit: 40000,
    taxId: '321-654-987',
    notes: 'Soluciones de empaque sostenibles y económicas',
    tags: ['sostenible', 'económico', 'soluciones'],
    totalOrders: 38,
    totalSpent: 95000
  },
  {
    name: 'Lab Equipment Pro',
    category: 'Equipos',
    contactName: 'Roberto Silva',
    contactPhone: '+1 809-555-0600',
    address: 'Avenida Tecnológica 987, San Cristóbal, San Cristóbal, 91000',
    status: 'Inactivo',
    rating: 3.9,
    paymentTerms: '15 días',
    creditLimit: 20000,
    taxId: '654-321-987',
    notes: 'Equipos de laboratorio de alta precisión',
    tags: ['laboratorio', 'precisión', 'equipos'],
    totalOrders: 15,
    totalSpent: 45000
  },
  {
    name: 'Chemical Solutions',
    category: 'Ingredientes',
    contactName: 'Carmen Vega',
    contactPhone: '+1 809-555-0700',
    address: 'Calle Científica 147, Moca, Espaillat, 61000',
    status: 'Activo',
    rating: 4.5,
    paymentTerms: '30 días',
    creditLimit: 60000,
    taxId: '147-258-369',
    notes: 'Productos químicos de grado farmacéutico',
    tags: ['químico', 'farmacéutico', 'grado alto'],
    totalOrders: 22,
    totalSpent: 78000
  },
  {
    name: 'Sustainable Materials',
    category: 'Embalajes',
    contactName: 'Diego Morales',
    contactPhone: '+1 809-555-0800',
    address: 'Avenida Ecológica 258, Puerto Plata, Puerto Plata, 57000',
    status: 'Activo',
    rating: 4.9,
    paymentTerms: '45 días',
    creditLimit: 35000,
    taxId: '258-369-147',
    notes: 'Materiales 100% reciclables y biodegradables',
    tags: ['reciclable', 'biodegradable', 'sostenible'],
    totalOrders: 18,
    totalSpent: 52000
  }
];

const initializeSuppliers = async () => {
  try {
    console.log('🚀 Inicializando proveedores...');
    
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

    // Limpiar proveedores existentes
    await Supplier.deleteMany({});
    console.log('🧹 Proveedores existentes eliminados');

    // Insertar proveedores de ejemplo
    const suppliers = await Supplier.insertMany(sampleSuppliers);
    console.log(`✅ ${suppliers.length} proveedores creados exitosamente`);

    // Mostrar resumen
    console.log('\n📋 Resumen de proveedores creados:');
    suppliers.forEach((supplier, index) => {
      console.log(`${index + 1}. ${supplier.name} - ${supplier.category} - ${supplier.status}`);
    });

    // Mostrar estadísticas
    const stats = await Supplier.getStats();
    console.log('\n📊 Estadísticas:');
    console.log(`Total: ${stats.total}`);
    console.log(`Activos: ${stats.active}`);
    console.log(`Pendientes: ${stats.pending}`);
    console.log(`Inactivos: ${stats.inactive}`);
    console.log(`Bloqueados: ${stats.blocked}`);

    console.log('\n🎉 Base de datos de proveedores inicializada correctamente');
    
  } catch (error) {
    console.error('❌ Error al inicializar proveedores:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
    process.exit(0);
  }
};

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeSuppliers();
}

export default initializeSuppliers;
