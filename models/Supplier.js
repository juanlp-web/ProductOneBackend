import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del proveedor es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede tener más de 100 caracteres']
  },
  category: {
    type: String,
    required: [true, 'La categoría es requerida'],
    enum: ['Ingredientes', 'Embalajes', 'Equipos', 'Servicios', 'Otros'],
    default: 'Otros'
  },
  contactName: {
    type: String,
    trim: true
  },
  contactPhone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Activo', 'Inactivo', 'Pendiente', 'Bloqueado'],
    default: 'Activo'
  },
  rating: {
    type: Number,
    min: [0, 'La calificación no puede ser menor a 0'],
    max: [5, 'La calificación no puede ser mayor a 5'],
    default: 0
  },
  paymentTerms: {
    type: String,
    default: '30 días'
  },
  creditLimit: {
    type: Number,
    min: 0,
    default: 0
  },
  taxId: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    maxlength: [500, 'Las notas no pueden tener más de 500 caracteres']
  },
  lastOrder: {
    type: Date,
    default: null
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  documents: [{
    name: String,
    url: String,
    type: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [String],
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
supplierSchema.index({ name: 'text', contactName: 'text' });
supplierSchema.index({ category: 1, status: 1 });
supplierSchema.index({ isActive: 1 });

// Virtual para el nombre completo del contacto
supplierSchema.virtual('contact.fullName').get(function() {
  return this.contactName;
});


// Método para actualizar estadísticas del proveedor
supplierSchema.methods.updateStats = function(orderAmount) {
  this.totalOrders += 1;
  this.totalSpent += orderAmount;
  this.lastOrder = new Date();
  return this.save();
};

// Método para calcular el rating promedio
supplierSchema.methods.calculateRating = function(newRating) {
  // Implementar lógica para calcular rating promedio
  return this.rating;
};

// Middleware pre-save para validaciones adicionales
supplierSchema.pre('save', function(next) {
  // Convertir el nombre a título
  if (this.name) {
    this.name = this.name.charAt(0).toUpperCase() + this.name.slice(1).toLowerCase();
  }
  
  // Validar que el teléfono tenga formato válido (si se proporciona)
  if (this.contactPhone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(this.contactPhone.replace(/\s/g, ''))) {
      return next(new Error('Formato de teléfono inválido'));
    }
  }
  
  next();
});

// Método estático para buscar proveedores por categoría
supplierSchema.statics.findByCategory = function(category) {
  return this.find({ category, isActive: true });
};

// Método estático para buscar proveedores por estado
supplierSchema.statics.findByStatus = function(status) {
  return this.find({ status, isActive: true });
};

// Método estático para obtener estadísticas generales
supplierSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'Activo'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'Pendiente'] }, 1, 0] } },
        inactive: { $sum: { $cond: [{ $eq: ['$status', 'Inactivo'] }, 1, 0] } },
        blocked: { $sum: { $cond: [{ $eq: ['$status', 'Bloqueado'] }, 1, 0] } }
      }
    }
  ]);
  
  return stats[0] || { total: 0, active: 0, pending: 0, inactive: 0, blocked: 0 };
};

const Supplier = mongoose.model('Supplier', supplierSchema);

export default Supplier;
