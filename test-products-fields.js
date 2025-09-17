const mongoose = require('mongoose');
const Product = require('./models/Product.js');

// Conectar a MongoDB
mongoose.connect('mongodb://localhost:27017/innovadomprod', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Conectado a MongoDB');
  testProductsFields();
})
.catch(err => {
  console.error('❌ Error conectando a MongoDB:', err);
  process.exit(1);
});

async function testProductsFields() {
  try {
    console.log('\n🔍 Verificando campos de productos...\n');
    
    // Obtener algunos productos
    const products = await Product.find().limit(5);
    
    if (products.length === 0) {
      console.log('❌ No hay productos en la base de datos');
      return;
    }
    
    console.log(`📦 Encontrados ${products.length} productos:\n`);
    
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} (${product.sku})`);
      console.log(`   - Unidad: "${product.unit || 'NO DEFINIDA'}"`);
      console.log(`   - Costo: ${product.cost || 'NO DEFINIDO'}`);
      console.log(`   - Precio: ${product.price || 'NO DEFINIDO'}`);
      console.log(`   - Stock: ${product.stock || 0}`);
      console.log(`   - Maneja lotes: ${product.managesBatches ? 'Sí' : 'No'}`);
      console.log('');
    });
    
    // Verificar si hay productos sin unidad o costo
    const productsWithoutUnit = products.filter(p => !p.unit);
    const productsWithoutCost = products.filter(p => !p.cost);
    
    if (productsWithoutUnit.length > 0) {
      console.log('⚠️  Productos sin unidad definida:');
      productsWithoutUnit.forEach(p => console.log(`   - ${p.name} (${p.sku})`));
    }
    
    if (productsWithoutCost.length > 0) {
      console.log('⚠️  Productos sin costo definido:');
      productsWithoutCost.forEach(p => console.log(`   - ${p.name} (${p.sku})`));
    }
    
    console.log('\n✅ Verificación completada');
    
  } catch (error) {
    console.error('❌ Error verificando productos:', error);
  } finally {
    mongoose.connection.close();
  }
}

