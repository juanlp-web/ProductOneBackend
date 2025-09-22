import mongoose from 'mongoose';

const bankTransactionSchema = new mongoose.Schema({
  bank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bank',
    required: false // Permitir null para pagos en efectivo
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'payment', 'refund', 'adjustment', 'account_payment'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  previousBalance: {
    type: Number,
    required: true
  },
  newBalance: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  reference: {
    type: String, // ID de venta, compra, etc.
    default: null
  },
  referenceType: {
    type: String,
    enum: ['sale', 'purchase', 'manual', 'adjustment', 'account_payment'],
    default: 'manual'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: false
  },
  // Campos adicionales para pagos de renta
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
    enum: ['activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto'],
    required: false
  },
  paymentDate: {
    type: Date,
    required: false
  },
  category: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

// Índices para mejorar rendimiento
bankTransactionSchema.index({ bank: 1, createdAt: -1 });
bankTransactionSchema.index({ type: 1 });
bankTransactionSchema.index({ reference: 1, referenceType: 1 });

export default mongoose.model('BankTransaction', bankTransactionSchema);
