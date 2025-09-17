import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Sale from './models/Sale.js';
import Product from './models/Product.js';
import Client from './models/Client.js';
import User from './models/User.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB conectado');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
};

const testDashboardProfit = async () => {
  try {
    await connectDB();
    
    console.log('🧪 Iniciando prueba de profit en dashboard...\n');
    
    // Buscar o crear un usuario
    let user = await User.findOne();
    if (!user) {
      console.log('❌ No se encontró ningún usuario. Creando usuario de prueba...');
      user = new User({
        name: 'Usuario de Prueba',
        email: 'test@example.com',
        password: 'password123',
        role: 'manager'
      });
      await user.save();
      console.log('✅ Usuario de prueba creado');
    }
    
    // Buscar o crear un cliente
    let client = await Client.findOne();
    if (!client) {
      console.log('❌ No se encontró ningún cliente. Creando cliente de prueba...');
      client = new Client({
        name: 'Cliente de Prueba',
        email: 'cliente@example.com',
        phone: '1234567890',
        createdBy: user._id
      });
      await client.save();
      console.log('✅ Cliente de prueba creado');
    }
    
    // Buscar o crear productos
    let product1 = await Product.findOne({ category: 'producto_terminado' });
    let product2 = await Product.findOne({ category: 'materia_prima' });
    
    if (!product1) {
      console.log('❌ No se encontró producto terminado. Creando producto de prueba...');
      product1 = new Product({
        name: 'Producto Terminado de Prueba',
        sku: 'PT-001',
        category: 'producto_terminado',
        unit: 'unidad',
        price: 50.00,
        cost: 25.00,
        stock: 100,
        minStock: 10,
        managesBatches: false,
        createdBy: user._id
      });
      await product1.save();
      console.log('✅ Producto terminado de prueba creado');
    }
    
    if (!product2) {
      console.log('❌ No se encontró materia prima. Creando materia prima de prueba...');
      product2 = new Product({
        name: 'Materia Prima de Prueba',
        sku: 'MP-001',
        category: 'materia_prima',
        unit: 'kg',
        price: 30.00,
        cost: 15.00,
        stock: 50,
        minStock: 5,
        managesBatches: false,
        createdBy: user._id
      });
      await product2.save();
      console.log('✅ Materia prima de prueba creada');
    }
    
    console.log(`\n📦 Productos encontrados:`);
    console.log(`   - ${product1.name}: Precio $${product1.price}, Costo $${product1.cost}`);
    console.log(`   - ${product2.name}: Precio $${product2.price}, Costo $${product2.cost}`);
    
    // Crear ventas de prueba para el mes actual
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    console.log(`\n📅 Creando ventas para el mes actual (${startOfMonth.toLocaleDateString()})...`);
    
    // Venta 1
    const sale1Data = {
      invoiceNumber: 'TEST-1-' + Date.now(),
      client: client._id,
      items: [
        {
          product: product1._id,
          quantity: 2,
          unitPrice: product1.price,
          cost: product1.cost,
          discount: 0,
          total: product1.price * 2
        }
      ],
      subtotal: product1.price * 2,
      tax: 0,
      total: product1.price * 2,
      totalCost: product1.cost * 2,
      profit: (product1.price * 2) - (product1.cost * 2),
      profitMargin: 100, // 100% de margen
      paymentMethod: 'efectivo',
      paymentStatus: 'pagado',
      notes: 'Venta de prueba 1',
      createdBy: user._id,
      createdAt: startOfMonth
    };
    
    const sale1 = await Sale.create(sale1Data);
    console.log(`✅ Venta 1 creada: ${sale1.invoiceNumber} - Ganancia: $${sale1.profit}`);
    
    // Venta 2
    const sale2Data = {
      invoiceNumber: 'TEST-2-' + Date.now(),
      client: client._id,
      items: [
        {
          product: product2._id,
          quantity: 3,
          unitPrice: product2.price,
          cost: product2.cost,
          discount: 5.00,
          total: (product2.price - 5.00) * 3
        }
      ],
      subtotal: (product2.price - 5.00) * 3,
      tax: 0,
      total: (product2.price - 5.00) * 3,
      totalCost: product2.cost * 3,
      profit: ((product2.price - 5.00) * 3) - (product2.cost * 3),
      profitMargin: 0,
      paymentMethod: 'efectivo',
      paymentStatus: 'pagado',
      notes: 'Venta de prueba 2',
      createdBy: user._id,
      createdAt: startOfMonth
    };
    
    const sale2 = await Sale.create(sale2Data);
    console.log(`✅ Venta 2 creada: ${sale2.invoiceNumber} - Ganancia: $${sale2.profit}`);
    
    // Calcular totales esperados
    const expectedTotal = sale1.total + sale2.total;
    const expectedTotalCost = sale1.totalCost + sale2.totalCost;
    const expectedProfit = sale1.profit + sale2.profit;
    const expectedProfitMargin = expectedTotalCost > 0 ? (expectedProfit / expectedTotalCost) * 100 : 0;
    
    console.log(`\n📊 Totales esperados:`);
    console.log(`   - Total ventas: $${expectedTotal}`);
    console.log(`   - Costo total: $${expectedTotalCost}`);
    console.log(`   - Ganancia: $${expectedProfit}`);
    console.log(`   - Margen de ganancia: ${expectedProfitMargin.toFixed(2)}%`);
    
    // Simular la consulta del dashboard
    console.log(`\n🔍 Simulando consulta del dashboard...`);
    
    const monthlySales = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth, $lte: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0) }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          totalCost: { $sum: '$totalCost' },
          profit: { $sum: '$profit' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const monthlySalesData = monthlySales[0] || { total: 0, totalCost: 0, profit: 0, count: 0 };
    const profit = monthlySalesData.profit;
    const profitMargin = monthlySalesData.totalCost > 0 ? (profit / monthlySalesData.totalCost) * 100 : 0;
    
    console.log(`\n📈 Resultados del dashboard:`);
    console.log(`   - Total ventas: $${monthlySalesData.total}`);
    console.log(`   - Costo total: $${monthlySalesData.totalCost}`);
    console.log(`   - Ganancia: $${profit}`);
    console.log(`   - Margen de ganancia: ${profitMargin.toFixed(2)}%`);
    console.log(`   - Número de ventas: ${monthlySalesData.count}`);
    
    // Verificar que los cálculos sean correctos
    const totalMatch = Math.abs(monthlySalesData.total - expectedTotal) < 0.01;
    const costMatch = Math.abs(monthlySalesData.totalCost - expectedTotalCost) < 0.01;
    const profitMatch = Math.abs(monthlySalesData.profit - expectedProfit) < 0.01;
    const marginMatch = Math.abs(profitMargin - expectedProfitMargin) < 0.01;
    
    if (totalMatch && costMatch && profitMatch && marginMatch) {
      console.log(`\n✅ ¡Todos los cálculos del dashboard son correctos!`);
    } else {
      console.log(`\n❌ Error en los cálculos del dashboard:`);
      if (!totalMatch) console.log(`   - Total de ventas no coincide`);
      if (!costMatch) console.log(`   - Costo total no coincide`);
      if (!profitMatch) console.log(`   - Ganancia no coincide`);
      if (!marginMatch) console.log(`   - Margen de ganancia no coincide`);
    }
    
    console.log('\n🎉 Prueba del dashboard completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
};

testDashboardProfit();
