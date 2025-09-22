import mongoose from 'mongoose';

const purchaseItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false // Hacer opcional para pagos contables
  },
  productName: {
    type: String,
    required: [true, 'El nombre del producto es requerido']
  },
  itemType: {
    type: String,
    enum: ['product', 'account'],
    default: 'product'
  },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: false
  },
  accountCode: {
    type: String,
    required: false
  },
  accountName: {
    type: String,
    required: false
  },
  accountType: {
    type: String,
    required: false
  },
  quantity: {
    type: Number,
    required: [true, 'La cantidad es requerida'],
    min: [1, 'La cantidad debe ser mayor a 0']
  },
  unit: {
    type: String,
    required: false, // Hacer opcional para pagos contables
    enum: ['kg', 'g', 'l', 'ml', 'unidad', 'docena', 'caja', 'metro', 'cm']
  },
  unitPrice: {
    type: Number,
    required: false, // Hacer opcional para pagos contables
    min: [0, 'El precio no puede ser negativo']
  },
  price: {
    type: Number,
    required: false, // Hacer opcional para pagos contables
    min: [0, 'El precio no puede ser negativo']
  },
  total: {
    type: Number,
    required: [true, 'El total es requerido'],
    min: [0, 'El total no puede ser negativo']
  },
  description: {
    type: String,
    required: false
  },
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: false
  },
  batchType: {
    type: String,
    enum: ['existing', 'new'],
    required: false
  },
  batchData: {
    batchNumber: String,
    expirationDate: Date,
    notes: String
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
    required: false // Hacer opcional para pagos contables
  },
  supplierName: {
    type: String,
    required: false // Hacer opcional para pagos contables
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
    required: false,
    enum: ['Efectivo', 'Transferencia Bancaria', 'Tarjeta de Crédito', 'Tarjeta de Débito', 'Cheque']
  },
  bankAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bank',
    required: false
  },
  partialPayments: [{
    amount: {
      type: Number,
      required: true,
      min: [0, 'El monto debe ser mayor a 0']
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['Efectivo', 'Transferencia Bancaria', 'Tarjeta de Crédito', 'Tarjeta de Débito', 'Cheque']
    },
    bankAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bank',
      required: false
    },
    paymentDate: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      maxlength: [200, 'Las notas no pueden tener más de 200 caracteres']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],
  paidAmount: {
    type: Number,
    default: 0,
    min: [0, 'El monto pagado no puede ser negativo']
  },
  remainingAmount: {
    type: Number,
    required: false,
    min: [0, 'El monto restante no puede ser negativo']
  },
  paymentStatus: {
    type: String,
    enum: ['pendiente', 'parcial', 'pagado', 'cancelado'],
    default: 'pendiente'
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
    required: false,
    enum: [
      // Categorías de compras tradicionales
      'Materia Prima', 'Envases', 'Químicos', 'Equipos', 'Herramientas', 'Otros',
      // Categorías de gastos contables
      'renta', 'servicios', 'mantenimiento', 'seguros', 'impuestos', 'gastos_generales', 'marketing', 'administrativos', 'consultoria', 'otros'
    ],
    default: 'Materia Prima'
  },
  notes: {
    type: String,
    maxlength: [500, 'Las notas no pueden tener más de 500 caracteres']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Campos para pagos contables
  isAccountPayment: {
    type: Boolean,
    default: false
  },
  accountPaymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankTransaction',
    required: false
  },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: false
  },
  accountCode: {
    type: String,
    required: false
  },
  accountName: {
    type: String,
    required: false
  },
  accountType: {
    type: String,
    required: false
  },
  reference: {
    type: String,
    required: false
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
purchaseSchema.index({ 'items.batch': 1 });
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

// Middleware pre-validate para inicializar campos de pago
purchaseSchema.pre('validate', function(next) {
  // Inicializar campos de pago para nuevas compras
  if (this.isNew) {
    this.paidAmount = 0;
    // Calcular total si no se proporciona
    if (!this.total && this.items.length > 0) {
      this.total = this.items.reduce((sum, item) => sum + item.total, 0);
    }
    this.remainingAmount = this.total || 0;
    this.paymentStatus = 'pendiente';
  }
  next();
});

// Middleware pre-save para calcular total y montos de pago
purchaseSchema.pre('save', function(next) {
  // Calcular total si no se proporciona
  if (!this.total && this.items.length > 0) {
    this.total = this.items.reduce((sum, item) => sum + item.total, 0);
  }
  
  // Calcular montos de pago
  if (this.partialPayments && this.partialPayments.length > 0) {
    this.paidAmount = this.partialPayments.reduce((sum, payment) => sum + payment.amount, 0);
    this.remainingAmount = Math.max(0, this.total - this.paidAmount);
    
    // Actualizar estado de pago
    if (this.paidAmount >= this.total) {
      this.paymentStatus = 'pagado';
    } else if (this.paidAmount > 0) {
      this.paymentStatus = 'parcial';
    } else {
      this.paymentStatus = 'pendiente';
    }
  } else {
    this.paidAmount = 0;
    this.remainingAmount = this.total || 0;
    this.paymentStatus = 'pendiente';
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
