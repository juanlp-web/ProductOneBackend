import mongoose from 'mongoose';

const bankSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre de la cuenta es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede tener más de 100 caracteres']
  },
  type: {
    type: String,
    required: [true, 'El tipo de cuenta es requerido'],
    enum: {
      values: ['banco', 'efectivo', 'tarjeta'],
      message: 'Tipo de cuenta debe ser: banco, efectivo o tarjeta'
    }
  },
  accountNumber: {
    type: String,
    trim: true,
    maxlength: [50, 'El número de cuenta no puede tener más de 50 caracteres']
  },
  initialBalance: {
    type: Number,
    required: [true, 'El saldo inicial es requerido']
  },
  currentBalance: {
    type: Number,
    required: [true, 'El saldo actual es requerido']
  },
  currency: {
    type: String,
    required: [true, 'La moneda es requerida'],
    enum: {
      values: ['DOP', 'USD', 'EUR'],
      message: 'Moneda debe ser: DOP, USD o EUR'
    },
    default: 'DOP'
  },
  initialBalanceDate: {
    type: Date,
    required: [true, 'La fecha de saldo inicial es requerida']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'La descripción no puede tener más de 500 caracteres']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['Activo', 'Inactivo', 'Bloqueado'],
    default: 'Activo'
  },
  // Referencia al tenant (para multi-tenancy)
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: false // Hacer opcional para funcionar sin tenant
  },
  // Metadatos adicionales
  metadata: {
    bankName: String, // Nombre del banco (para cuentas bancarias)
    cardType: String, // Tipo de tarjeta (para tarjetas de crédito)
    expiryDate: Date, // Fecha de vencimiento (para tarjetas)
    creditLimit: Number, // Límite de crédito (para tarjetas)
    interestRate: Number // Tasa de interés (para tarjetas)
  }
}, {
  timestamps: true
});

// Índices para mejorar el rendimiento
bankSchema.index({ name: 'text', description: 'text' });
bankSchema.index({ type: 1 });
bankSchema.index({ isActive: 1 });
bankSchema.index({ status: 1 });
bankSchema.index({ tenant: 1 });
bankSchema.index({ currency: 1 });

// Middleware para actualizar el saldo actual solo cuando se crea un nuevo banco
bankSchema.pre('save', function(next) {
  if (this.isNew) {
    // Solo al crear un nuevo banco, el saldo actual inicia igual al inicial
    this.currentBalance = this.initialBalance;
  }
  next();
});

// Método virtual para obtener el tipo de cuenta formateado
bankSchema.virtual('typeLabel').get(function() {
  const types = {
    'banco': 'Banco',
    'efectivo': 'Efectivo',
    'tarjeta': 'Tarjeta de Crédito'
  };
  return types[this.type] || this.type;
});

// Método virtual para obtener el saldo formateado
bankSchema.virtual('formattedBalance').get(function() {
  const balance = this.currentBalance || 0;
  const currency = this.currency || 'DOP';
  return `${currency} ${balance.toFixed(2)}`;
});

// Método para actualizar el saldo
bankSchema.methods.updateBalance = function(newBalance) {
  this.currentBalance = newBalance;
  return this.save();
};

// Método para agregar transacción
bankSchema.methods.addTransaction = function(amount, type = 'deposit') {
  // Asegurar que currentBalance tenga un valor válido
  if (this.currentBalance === undefined || this.currentBalance === null) {
    this.currentBalance = 0;
  }
  
  if (type === 'deposit') {
    this.currentBalance += amount;
  } else if (type === 'withdrawal') {
    this.currentBalance -= amount;
  }
  return this.save();
};

const Bank = mongoose.model('Bank', bankSchema);

export default Bank;
