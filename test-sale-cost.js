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

const testSaleCost = async () => {
  try {
    await connectDB();
    
    console.log('🧪 Iniciando prueba de costos en ventas...\n');
    
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
        price: 15.00,
        cost: 8.00,
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
    
    // Crear una venta de prueba
    const saleData = {
      invoiceNumber: 'TEST-' + Date.now(),
      client: client._id,
      items: [
        {
          product: product1._id,
          quantity: 2,
          unitPrice: product1.price,
          cost: product1.cost,
          discount: 0,
          total: product1.price * 2
        },
        {
          product: product2._id,
          quantity: 3,
          unitPrice: product2.price,
          cost: product2.cost,
          discount: 5.00,
          total: (product2.price - 5.00) * 3
        }
      ],
      subtotal: (product1.price * 2) + ((product2.price - 5.00) * 3),
      tax: 0, // Sin IVA para simplificar
      total: (product1.price * 2) + ((product2.price - 5.00) * 3),
      totalCost: (product1.cost * 2) + (product2.cost * 3),
      profit: ((product1.price * 2) + ((product2.price - 5.00) * 3)) - ((product1.cost * 2) + (product2.cost * 3)),
      profitMargin: 0,
      paymentMethod: 'efectivo',
      paymentStatus: 'pagado',
      notes: 'Venta de prueba para verificar costos',
      createdBy: user._id
    };
    
    // Calcular margen de ganancia
    saleData.profitMargin = saleData.totalCost > 0 ? (saleData.profit / saleData.totalCost) * 100 : 0;
    
    console.log(`\n💰 Datos de la venta:`);
    console.log(`   - Subtotal: $${saleData.subtotal}`);
    console.log(`   - Costo total: $${saleData.totalCost}`);
    console.log(`   - Ganancia: $${saleData.profit}`);
    console.log(`   - Margen de ganancia: ${saleData.profitMargin.toFixed(2)}%`);
    
    // Crear la venta
    const sale = await Sale.create(saleData);
    console.log(`\n✅ Venta creada exitosamente: ${sale.invoiceNumber}`);
    
    // Verificar que los costos se guardaron correctamente
    const savedSale = await Sale.findById(sale._id)
      .populate('items.product', 'name price cost')
      .populate('client', 'name')
      .populate('createdBy', 'name');
    
    console.log(`\n📊 Verificación de la venta guardada:`);
    console.log(`   - Número de factura: ${savedSale.invoiceNumber}`);
    console.log(`   - Cliente: ${savedSale.client.name}`);
    console.log(`   - Subtotal: $${savedSale.subtotal}`);
    console.log(`   - Costo total: $${savedSale.totalCost}`);
    console.log(`   - Ganancia: $${savedSale.profit}`);
    console.log(`   - Margen de ganancia: ${savedSale.profitMargin.toFixed(2)}%`);
    
    console.log(`\n📋 Items de la venta:`);
    savedSale.items.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.product.name}:`);
      console.log(`      - Cantidad: ${item.quantity}`);
      console.log(`      - Precio unitario: $${item.unitPrice}`);
      console.log(`      - Costo unitario: $${item.cost}`);
      console.log(`      - Descuento: $${item.discount}`);
      console.log(`      - Total: $${item.total}`);
      console.log(`      - Costo total del item: $${item.cost * item.quantity}`);
    });
    
    // Verificar cálculos
    const expectedTotalCost = savedSale.items.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
    const expectedProfit = savedSale.subtotal - expectedTotalCost;
    const expectedMargin = expectedTotalCost > 0 ? (expectedProfit / expectedTotalCost) * 100 : 0;
    
    console.log(`\n🧮 Verificación de cálculos:`);
    console.log(`   - Costo total esperado: $${expectedTotalCost}`);
    console.log(`   - Ganancia esperada: $${expectedProfit}`);
    console.log(`   - Margen esperado: ${expectedMargin.toFixed(2)}%`);
    
    const costMatch = Math.abs(savedSale.totalCost - expectedTotalCost) < 0.01;
    const profitMatch = Math.abs(savedSale.profit - expectedProfit) < 0.01;
    const marginMatch = Math.abs(savedSale.profitMargin - expectedMargin) < 0.01;
    
    if (costMatch && profitMatch && marginMatch) {
      console.log(`\n✅ ¡Todos los cálculos son correctos!`);
    } else {
      console.log(`\n❌ Error en los cálculos:`);
      if (!costMatch) console.log(`   - Costo total no coincide`);
      if (!profitMatch) console.log(`   - Ganancia no coincide`);
      if (!marginMatch) console.log(`   - Margen no coincide`);
    }
    
    console.log('\n🎉 Prueba completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
};

testSaleCost();
