import mongoose from 'mongoose';

const saleSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: [true, 'El número de factura es requerido'],
    unique: true,
    trim: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'El cliente es requerido']
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
    cost: {
      type: Number,
      required: true,
      min: [0, 'El costo no puede ser negativo']
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'El descuento no puede ser negativo']
    },
    total: {
      type: Number,
      required: true
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: false
    },
    // Campos para paquetes
    isPackage: {
      type: Boolean,
      default: false
    },
    package: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Package',
      required: false
    },
    // Campos para productos que vienen de paquetes
    isFromPackage: {
      type: Boolean,
      default: false
    },
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Package',
      required: false
    },
    packageName: {
      type: String,
      required: false
    }
  }],
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'El subtotal no puede ser negativo']
  },
  tax: {
    type: Number,
    default: 0,
    min: [0, 'El impuesto no puede ser negativo']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'El descuento no puede ser negativo']
  },
  total: {
    type: Number,
    required: true,
    min: [0, 'El total no puede ser negativo']
  },
  totalCost: {
    type: Number,
    required: true,
    min: [0, 'El costo total no puede ser negativo']
  },
  profit: {
    type: Number,
    required: true,
    min: [0, 'La ganancia no puede ser negativa']
  },
  profitMargin: {
    type: Number,
    required: true,
    min: [0, 'El margen de ganancia no puede ser negativo']
  },
  paymentMethod: {
    type: String,
    enum: ['efectivo', 'tarjeta', 'transferencia', 'cheque'],
    required: [true, 'El método de pago es requerido']
  },
  paymentStatus: {
    type: String,
    enum: ['pendiente', 'pagado', 'parcial', 'cancelado'],
    default: 'pendiente'
  },
  saleDate: {
    type: Date,
    default: Date.now
  },
  dueDate: Date,
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Índices para mejorar el rendimiento
saleSchema.index({ invoiceNumber: 1 });
saleSchema.index({ client: 1 });
saleSchema.index({ saleDate: -1 });
saleSchema.index({ paymentStatus: 1 });
saleSchema.index({ createdBy: 1 });

const Sale = mongoose.model('Sale', saleSchema);

export default Sale;
