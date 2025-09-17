import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.js';

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

const testCostUpdate = async () => {
  try {
    await connectDB();
    
    console.log('🧪 Probando actualización de costo...');
    
    // Crear un producto de prueba
    const testProduct = new Product({
      name: 'Producto Test Costo',
      sku: 'TEST-COST-002',
      category: 'materia_prima',
      unit: 'kg',
      price: 100,
      cost: 50, // Costo inicial
      stock: 10, // Stock inicial
      managesBatches: false
    });
    
    await testProduct.save();
    console.log('✅ Producto de prueba creado:', {
      id: testProduct._id,
      name: testProduct.name,
      initialCost: testProduct.cost,
      initialStock: testProduct.stock
    });
    
    // Simular la actualización como lo haría la función de compra
    const newCost = 60;
    const quantity = 5;
    
    console.log('📦 Simulando compra:', {
      newCost,
      quantity
    });
    
    // Obtener el producto actual
    const currentProduct = await Product.findById(testProduct._id);
    console.log('📊 Estado actual del producto:', {
      cost: currentProduct.cost,
      stock: currentProduct.stock
    });
    
    // Calcular costo promedio
    let finalCost = newCost;
    if (currentProduct.stock > 0 && currentProduct.cost && currentProduct.cost > 0) {
      const totalCurrentValue = currentProduct.cost * currentProduct.stock;
      const totalNewValue = newCost * quantity;
      const totalStock = currentProduct.stock + quantity;
      finalCost = (totalCurrentValue + totalNewValue) / totalStock;
      console.log('🧮 Cálculo de costo promedio:', {
        totalCurrentValue,
        totalNewValue,
        totalStock,
        finalCost
      });
    } else {
      console.log('📝 Asignando costo directo:', finalCost);
    }
    
    // Actualizar el producto
    console.log('🔄 Actualizando producto...');
    const updatedProduct = await Product.findByIdAndUpdate(
      testProduct._id,
      { 
        $inc: { stock: quantity },
        $set: { cost: finalCost }
      },
      { new: true }
    );
    
    console.log('✅ Producto actualizado:', {
      oldCost: currentProduct.cost,
      newCost: updatedProduct.cost,
      oldStock: currentProduct.stock,
      newStock: updatedProduct.stock,
      costChanged: updatedProduct.cost !== currentProduct.cost
    });
    
    // Verificar que el costo se actualizó
    if (updatedProduct.cost === finalCost) {
      console.log('🎉 ¡ÉXITO! El costo se actualizó correctamente');
    } else {
      console.log('❌ ERROR: El costo no se actualizó correctamente');
      console.log('Esperado:', finalCost, 'Actual:', updatedProduct.cost);
    }
    
    // Limpiar datos de prueba
    await Product.findByIdAndDelete(testProduct._id);
    console.log('🧹 Datos de prueba eliminados');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
    process.exit(1);
  }
};

testCostUpdate();
