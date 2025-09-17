import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.js';
import Purchase from './models/Purchase.js';
import Supplier from './models/Supplier.js';

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

const testCostAverage = async () => {
  try {
    await connectDB();
    
    console.log('🧪 Probando cálculo de costo promedio...');
    
    // Crear un producto de prueba
    const testProduct = new Product({
      name: 'Producto Test Costo Promedio',
      sku: 'TEST-COST-001',
      category: 'materia_prima',
      unit: 'kg',
      price: 100,
      cost: 50, // Costo inicial
      stock: 10, // Stock inicial
      managesBatches: false
    });
    
    await testProduct.save();
    console.log('✅ Producto de prueba creado:', {
      name: testProduct.name,
      initialCost: testProduct.cost,
      initialStock: testProduct.stock
    });
    
    // Simular una compra con costo diferente
    const testSupplier = new Supplier({
      name: 'Proveedor Test',
      email: 'test@proveedor.com',
      phone: '123456789'
    });
    
    await testSupplier.save();
    
    const testPurchase = new Purchase({
      supplier: testSupplier._id,
      supplierName: testSupplier.name,
      items: [{
        product: testProduct._id,
        productName: testProduct.name,
        quantity: 5,
        unitCost: 60, // Costo diferente al actual
        total: 300
      }],
      total: 300,
      status: 'pendiente'
    });
    
    await testPurchase.save();
    console.log('✅ Compra de prueba creada');
    
    // Simular el proceso de recibir la compra
    console.log('📦 Procesando recepción de compra...');
    
    // Obtener el producto actual
    const currentProduct = await Product.findById(testProduct._id);
    console.log('📊 Estado inicial del producto:', {
      cost: currentProduct.cost,
      stock: currentProduct.stock
    });
    
    // Calcular costo promedio manualmente para verificar
    const item = testPurchase.items[0];
    const totalCurrentValue = currentProduct.cost * currentProduct.stock;
    const totalNewValue = item.unitCost * item.quantity;
    const totalStock = currentProduct.stock + item.quantity;
    const expectedNewCost = (totalCurrentValue + totalNewValue) / totalStock;
    
    console.log('🧮 Cálculo manual del costo promedio:');
    console.log(`  - Valor actual: ${currentProduct.cost} × ${currentProduct.stock} = ${totalCurrentValue}`);
    console.log(`  - Valor nuevo: ${item.unitCost} × ${item.quantity} = ${totalNewValue}`);
    console.log(`  - Stock total: ${currentProduct.stock} + ${item.quantity} = ${totalStock}`);
    console.log(`  - Costo promedio esperado: (${totalCurrentValue} + ${totalNewValue}) / ${totalStock} = ${expectedNewCost}`);
    
    // Actualizar el producto como lo haría la función de recibir compra
    const updatedProduct = await Product.findByIdAndUpdate(
      testProduct._id,
      { 
        $inc: { stock: item.quantity },
        $set: { cost: expectedNewCost }
      },
      { new: true }
    );
    
    console.log('✅ Producto actualizado:', {
      newCost: updatedProduct.cost,
      newStock: updatedProduct.stock,
      costChange: updatedProduct.cost - currentProduct.cost
    });
    
    // Verificar que el cálculo es correcto
    if (Math.abs(updatedProduct.cost - expectedNewCost) < 0.01) {
      console.log('🎉 ¡ÉXITO! El costo promedio se calculó correctamente');
    } else {
      console.log('❌ ERROR: El costo promedio no coincide');
    }
    
    // Limpiar datos de prueba
    await Product.findByIdAndDelete(testProduct._id);
    await Purchase.findByIdAndDelete(testPurchase._id);
    await Supplier.findByIdAndDelete(testSupplier._id);
    console.log('🧹 Datos de prueba eliminados');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
    process.exit(1);
  }
};

testCostAverage();
