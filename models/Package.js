import mongoose from 'mongoose';

const packageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del paquete es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede tener más de 100 caracteres']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'La descripción no puede tener más de 500 caracteres']
  },
  sku: {
    type: String,
    required: [true, 'El SKU del paquete es requerido'],
    unique: true,
    trim: true,
    uppercase: true
  },
  category: {
    type: String,
    required: [true, 'La categoría es requerida'],
    enum: ['combo', 'promocion', 'paquete', 'kit', 'otro']
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'La cantidad debe ser mayor a 0']
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'El precio unitario no puede ser negativo']
    },
    totalPrice: {
      type: Number,
      required: true,
      min: [0, 'El precio total no puede ser negativo']
    }
  }],
  totalCost: {
    type: Number,
    required: true,
    min: [0, 'El costo total no puede ser negativo']
  },
  sellingPrice: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'El precio de venta no puede ser negativo']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'El descuento no puede ser negativo']
  },
  finalPrice: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'El precio final no puede ser negativo']
  },
  profitMargin: {
    type: Number,
    min: [0, 'El margen de ganancia no puede ser negativo']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Las notas no pueden tener más de 500 caracteres']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Middleware pre-save para calcular precios automáticamente
packageSchema.pre('save', function(next) {
  // Calcular precio total de los items
  let itemsTotal = 0;
  this.items.forEach(item => {
    item.totalPrice = item.quantity * item.unitPrice;
    itemsTotal += item.totalPrice;
  });
  
  // Asegurar que sellingPrice y discount tengan valores por defecto
  if (this.sellingPrice === undefined || this.sellingPrice === null) {
    this.sellingPrice = 0;
  }
  if (this.discount === undefined || this.discount === null) {
    this.discount = 0;
  }
  
  // Calcular precio final con descuento
  this.finalPrice = this.sellingPrice - this.discount;
  
  // Asegurar que finalPrice no sea negativo
  if (this.finalPrice < 0) {
    this.finalPrice = 0;
  }
  
  // Calcular margen de ganancia
  if (this.totalCost > 0) {
    this.profitMargin = ((this.finalPrice - this.totalCost) / this.totalCost) * 100;
  } else {
    this.profitMargin = 0;
  }
  
  next();
});

// Método para verificar disponibilidad de stock
packageSchema.methods.checkStockAvailability = async function() {
  const Product = mongoose.model('Product');
  const availability = {
    available: true,
    unavailableItems: []
  };
  
  for (const item of this.items) {
    const product = await Product.findById(item.product);
    if (!product || product.stock < item.quantity) {
      availability.available = false;
      availability.unavailableItems.push({
        product: product?.name || 'Producto no encontrado',
        required: item.quantity,
        available: product?.stock || 0
      });
    }
  }
  
  return availability;
};

// Método para consumir stock de los productos del paquete
packageSchema.methods.consumeStock = async function() {
  const Product = mongoose.model('Product');
  const consumedItems = [];
  
  for (const item of this.items) {
    const product = await Product.findById(item.product);
    if (product) {
      product.stock -= item.quantity;
      await product.save();
      consumedItems.push({
        product: product.name,
        quantity: item.quantity,
        remainingStock: product.stock
      });
    }
  }
  
  return consumedItems;
};

// Método para restaurar stock de los productos del paquete
packageSchema.methods.restoreStock = async function() {
  const Product = mongoose.model('Product');
  const restoredItems = [];
  
  for (const item of this.items) {
    const product = await Product.findById(item.product);
    if (product) {
      product.stock += item.quantity;
      await product.save();
      restoredItems.push({
        product: product.name,
        quantity: item.quantity,
        newStock: product.stock
      });
    }
  }
  
  return restoredItems;
};

// Índices para mejorar el rendimiento
packageSchema.index({ sku: 1 });
packageSchema.index({ name: 1 });
packageSchema.index({ category: 1 });
packageSchema.index({ isActive: 1 });
packageSchema.index({ createdBy: 1 });
packageSchema.index({ createdAt: -1 });

const Package = mongoose.model('Package', packageSchema);

export default Package;
