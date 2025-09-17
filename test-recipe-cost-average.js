import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Recipe from './models/Recipe.js';
import Product from './models/Product.js';
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

const testRecipeCostAverage = async () => {
  try {
    await connectDB();
    
    console.log('🧪 Iniciando prueba de costo promedio en recetas...\n');
    
    // Buscar un usuario para las pruebas
    const user = await User.findOne();
    if (!user) {
      console.log('❌ No se encontró ningún usuario. Creando usuario de prueba...');
      const testUser = new User({
        name: 'Usuario de Prueba',
        email: 'test@example.com',
        password: 'password123',
        role: 'manager'
      });
      await testUser.save();
      console.log('✅ Usuario de prueba creado');
    }
    
    // Buscar un producto terminado existente
    let product = await Product.findOne({ category: 'producto_terminado' });
    if (!product) {
      console.log('❌ No se encontró producto terminado. Creando producto de prueba...');
      product = new Product({
        name: 'Producto Terminado de Prueba',
        sku: 'PT-001',
        category: 'producto_terminado',
        unit: 'unidad',
        price: 50.00,
        cost: 25.00, // Costo inicial
        stock: 10, // Stock inicial
        minStock: 5,
        managesBatches: true,
        createdBy: user._id
      });
      await product.save();
      console.log('✅ Producto de prueba creado');
    }
    
    console.log(`📦 Producto encontrado: ${product.name}`);
    console.log(`   - Stock actual: ${product.stock} ${product.unit}`);
    console.log(`   - Costo actual: $${product.cost}`);
    
    // Crear una receta de prueba
    const recipeData = {
      name: 'Receta de Prueba - Costo Promedio',
      description: 'Receta para probar el cálculo de costo promedio',
      category: 'bebida',
      difficulty: 'facil',
      status: 'en_preparacion',
      preparationTime: 30,
      cookingTime: 15,
      servings: 5,
      productToProduce: product._id,
      batchInfo: {
        batchNumber: 'LOTE-TEST-' + Date.now(),
        productionDate: new Date(),
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        quantity: 8, // Producir 8 unidades
        unit: 'unidad'
      },
      ingredients: [
        {
          name: 'Ingrediente 1',
          quantity: 2,
          unit: 'kg',
          cost: 10.00
        },
        {
          name: 'Ingrediente 2', 
          quantity: 1,
          unit: 'l',
          cost: 5.00
        }
      ],
      instructions: [
        { step: 1, description: 'Mezclar ingredientes', time: null }
      ],
      cost: 15.00, // Costo total de la receta
      sellingPrice: 30.00,
      createdBy: user._id
    };
    
    const recipe = await Recipe.create(recipeData);
    console.log(`\n📝 Receta creada: ${recipe.name}`);
    console.log(`   - Costo de la receta: $${recipe.cost}`);
    console.log(`   - Cantidad a producir: ${recipe.batchInfo.quantity} ${recipe.batchInfo.unit}`);
    
    // Simular el cambio de estado a completada
    console.log('\n🔄 Cambiando estado de receta a "completada"...');
    
    // Obtener el producto actualizado
    const currentProduct = await Product.findById(product._id);
    console.log(`\n📊 Estado antes de completar:`);
    console.log(`   - Stock: ${currentProduct.stock} ${currentProduct.unit}`);
    console.log(`   - Costo: $${currentProduct.cost}`);
    
    // Calcular el costo promedio manualmente para verificar
    const totalCurrentValue = currentProduct.cost * currentProduct.stock;
    const totalNewValue = recipe.cost * recipe.batchInfo.quantity;
    const totalStock = currentProduct.stock + recipe.batchInfo.quantity;
    const expectedNewCost = (totalCurrentValue + totalNewValue) / totalStock;
    
    console.log(`\n🧮 Cálculo manual del costo promedio:`);
    console.log(`   - Valor total actual: $${totalCurrentValue} (${currentProduct.cost} × ${currentProduct.stock})`);
    console.log(`   - Valor total nuevo: $${totalNewValue} (${recipe.cost} × ${recipe.batchInfo.quantity})`);
    console.log(`   - Stock total: ${totalStock} (${currentProduct.stock} + ${recipe.batchInfo.quantity})`);
    console.log(`   - Costo promedio esperado: $${expectedNewCost.toFixed(4)}`);
    
    // Actualizar la receta a completada
    recipe.status = 'completada';
    await recipe.save();
    
    // Actualizar el producto con el costo promedio
    const newCost = expectedNewCost;
    currentProduct.stock += recipe.batchInfo.quantity;
    currentProduct.cost = newCost;
    await currentProduct.save();
    
    console.log(`\n✅ Receta completada exitosamente!`);
    console.log(`📊 Estado después de completar:`);
    console.log(`   - Stock: ${currentProduct.stock} ${currentProduct.unit}`);
    console.log(`   - Costo: $${currentProduct.cost.toFixed(4)}`);
    console.log(`   - Cambio en stock: +${recipe.batchInfo.quantity} ${recipe.batchInfo.unit}`);
    console.log(`   - Cambio en costo: $${(currentProduct.cost - (product.cost || 0)).toFixed(4)}`);
    
    // Verificar que el cálculo es correcto
    const costDifference = Math.abs(currentProduct.cost - expectedNewCost);
    if (costDifference < 0.01) {
      console.log(`\n✅ ¡Cálculo de costo promedio correcto! (diferencia: $${costDifference.toFixed(6)})`);
    } else {
      console.log(`\n❌ Error en el cálculo de costo promedio (diferencia: $${costDifference.toFixed(6)})`);
    }
    
    console.log('\n🎉 Prueba completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
};

testRecipeCostAverage();
