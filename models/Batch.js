import mongoose from 'mongoose';

const batchSchema = new mongoose.Schema({
  batchNumber: {
    type: String,
    required: [true, 'El número de lote es requerido'],
    unique: true,
    trim: true
  },
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
    min: [0, 'La cantidad no puede ser negativa']
  },
  unit: {
    type: String,
    required: [true, 'La unidad de medida es requerida']
  },
  productionDate: {
    type: Date,
    default: Date.now,
    required: [true, 'La fecha de producción es requerida']
  },
  expirationDate: {
    type: Date,
    required: [true, 'La fecha de vencimiento es requerida']
  },
  currentStock: {
    type: Number,
    default: 0,
    min: [0, 'El stock actual no puede ser negativo']
  },
  initialStock: {
    type: Number,
    required: [true, 'El stock inicial es requerido'],
    min: [0, 'El stock inicial no puede ser negativo']
  },
  cost: {
    type: Number,
    min: [0, 'El costo no puede ser negativo']
  },
  recipe: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipe',
    required: false // Cambiado a false para permitir lotes desde compras
  },
  recipeName: {
    type: String,
    required: false // Cambiado a false para permitir lotes desde compras
  },
  status: {
    type: String,
    enum: ['activo', 'vencido', 'agotado'],
    default: 'activo'
  },
  notes: {
    type: String,
    maxlength: [500, 'Las notas no pueden tener más de 500 caracteres']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Middleware pre-validate para generar número de lote
batchSchema.pre('validate', function(next) {
  // Generar número de lote solo si no existe y no viene del frontend
  if (!this.batchNumber || this.batchNumber.trim() === '') {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    this.batchNumber = `LOTE-${year}${month}${day}-${hours}${minutes}${seconds}`;
  }
  
  // Establecer stock inicial igual a la cantidad si no se especifica
  if (!this.initialStock) {
    this.initialStock = this.quantity;
    this.currentStock = this.quantity;
  }
  
  next();
});

// Middleware pre-save para actualizar estado basado en fecha de vencimiento y stock
batchSchema.pre('save', function(next) {
  const now = new Date();
  
  // Verificar si el lote está vencido
  if (this.expirationDate < now) {
    this.status = 'vencido';
  }
  // Verificar si el lote está agotado
  else if (this.currentStock <= 0) {
    this.status = 'agotado';
  }
  // Si no está vencido ni agotado, está activo
  else {
    this.status = 'activo';
  }
  
  next();
});

// Método para consumir stock del lote
batchSchema.methods.consumeStock = async function(quantityToConsume) {
  if (this.currentStock < quantityToConsume) {
    throw new Error(`Stock insuficiente en el lote. Disponible: ${this.currentStock}, Necesario: ${quantityToConsume}`);
  }
  
  this.currentStock -= quantityToConsume;
  
  // Si el stock llega a 0, marcar como agotado
  if (this.currentStock <= 0) {
    this.status = 'agotado';
  }
  
  await this.save();
  return this.currentStock;
};

// Método para restaurar stock del lote
batchSchema.methods.restoreStock = async function(quantityToRestore) {
  this.currentStock += quantityToRestore;
  
  // Si había stock 0 y se restaura, volver a activo
  if (this.status === 'agotado' && this.currentStock > 0) {
    this.status = 'activo';
  }
  
  await this.save();
  return this.currentStock;
};

// Método estático para obtener lotes activos de un producto
batchSchema.statics.getActiveBatches = function(productId) {
  return this.find({
    product: productId,
    status: 'activo',
    currentStock: { $gt: 0 },
    expirationDate: { $gt: new Date() },
    isActive: true
  }).sort({ expirationDate: 1 }); // Ordenar por fecha de vencimiento (más cercana primero)
};

// Método estático para obtener estadísticas
batchSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'activo'] }, 1, 0] } },
        expired: { $sum: { $cond: [{ $eq: ['$status', 'vencido'] }, 1, 0] } },
        depleted: { $sum: { $cond: [{ $eq: ['$status', 'agotado'] }, 1, 0] } },
        totalStock: { $sum: '$currentStock' },
        totalValue: { $sum: { $multiply: ['$currentStock', { $ifNull: ['$cost', 0] }] } }
      }
    }
  ]);
  
  return stats[0] || { 
    total: 0, 
    active: 0, 
    expired: 0, 
    depleted: 0,
    totalStock: 0,
    totalValue: 0
  };
};

// Índices para mejorar el rendimiento
batchSchema.index({ batchNumber: 1 });
batchSchema.index({ product: 1 });
batchSchema.index({ recipe: 1 });
batchSchema.index({ status: 1 });
batchSchema.index({ expirationDate: 1 });
batchSchema.index({ isActive: 1 });
batchSchema.index({ createdAt: -1 });

const Batch = mongoose.model('Batch', batchSchema);

export default Batch;
