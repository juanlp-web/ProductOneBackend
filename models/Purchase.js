import mongoose from 'mongoose';

const purchaseItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'El producto es requerido']
  },
  productName: {
    type: String,
    required: [true, 'El nombre del producto es requerido']
  },
  quantity: {
    type: Number,
    required: [true, 'La cantidad es requerida'],
    min: [1, 'La cantidad debe ser mayor a 0']
  },
  unit: {
    type: String,
    required: [true, 'La unidad de medida es requerida'],
    enum: ['kg', 'g', 'l', 'ml', 'unidad', 'docena', 'caja', 'metro', 'cm']
  },
  price: {
    type: Number,
    required: [true, 'El precio unitario es requerido'],
    min: [0, 'El precio no puede ser negativo']
  },
  total: {
    type: Number,
    required: [true, 'El total es requerido'],
    min: [0, 'El total no puede ser negativo']
  }
});

const purchaseSchema = new mongoose.Schema({
  purchaseNumber: {
    type: String,
    unique: true,
    trim: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: [true, 'El proveedor es requerido']
  },
  supplierName: {
    type: String,
    required: [true, 'El nombre del proveedor es requerido']
  },
  items: [purchaseItemSchema],
  total: {
    type: Number,
    min: [0, 'El total no puede ser negativo']
  },
  status: {
    type: String,
    enum: ['pendiente', 'en_transito', 'recibida', 'cancelada'],
    default: 'pendiente'
  },
  paymentMethod: {
    type: String,
    required: [true, 'El método de pago es requerido'],
    enum: ['Efectivo', 'Transferencia Bancaria', 'Tarjeta de Crédito', 'Tarjeta de Débito', 'Cheque']
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  expectedDelivery: {
    type: Date,
    required: [true, 'La fecha de entrega esperada es requerida']
  },
  actualDelivery: {
    type: Date
  },
  category: {
    type: String,
    required: [true, 'La categoría es requerida'],
    enum: ['Materia Prima', 'Envases', 'Químicos', 'Equipos', 'Herramientas', 'Otros']
  },
  notes: {
    type: String,
    maxlength: [500, 'Las notas no pueden tener más de 500 caracteres']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para mejorar el rendimiento de las consultas
purchaseSchema.index({ purchaseNumber: 1 });
purchaseSchema.index({ supplier: 1 });
purchaseSchema.index({ status: 1 });
purchaseSchema.index({ orderDate: -1 });
purchaseSchema.index({ category: 1 });
purchaseSchema.index({ isActive: 1 });

// Virtual para calcular el total automáticamente
purchaseSchema.virtual('calculatedTotal').get(function() {
  return this.items.reduce((sum, item) => sum + item.total, 0);
});

// Middleware pre-validate para generar número de compra
purchaseSchema.pre('validate', function(next) {
  // Generar número de compra si no existe
  if (!this.purchaseNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.purchaseNumber = `C-${year}${month}${day}-${random}`;
  }
  
  next();
});

// Middleware pre-save para calcular total
purchaseSchema.pre('save', function(next) {
  // Calcular total si no se proporciona
  if (!this.total && this.items.length > 0) {
    this.total = this.items.reduce((sum, item) => sum + item.total, 0);
  }
  
  next();
});

// Método estático para obtener estadísticas
purchaseSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        totalAmount: { $sum: '$total' },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pendiente'] }, 1, 0] } },
        inTransit: { $sum: { $cond: [{ $eq: ['$status', 'en_transito'] }, 1, 0] } },
        received: { $sum: { $cond: [{ $eq: ['$status', 'recibida'] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelada'] }, 1, 0] } }
      }
    }
  ]);
  
  return stats[0] || { 
    total: 0, 
    totalAmount: 0, 
    pending: 0, 
    inTransit: 0, 
    received: 0, 
    cancelled: 0 
  };
};

// Método estático para buscar por proveedor
purchaseSchema.statics.findBySupplier = function(supplierId) {
  return this.find({ supplier: supplierId, isActive: true }).sort({ orderDate: -1 });
};

const Purchase = mongoose.model('Purchase', purchaseSchema);

export default Purchase;
