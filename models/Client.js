import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del cliente es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede tener más de 100 caracteres']
  },
  email: {
    type: String,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Por favor ingrese un email válido']
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  type: {
    type: String,
    enum: ['individual', 'empresa', 'distribuidor'],
    default: 'individual'
  },
  taxId: {
    type: String,
    trim: true
  },
  creditLimit: {
    type: Number,
    default: 0,
    min: [0, 'El límite de crédito no puede ser negativo']
  },
  paymentTerms: {
    type: Number,
    default: 30,
    min: [0, 'Los términos de pago no pueden ser negativos']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['Activo', 'Pendiente', 'Inactivo', 'Bloqueado'],
    default: 'Activo'
  },
  notes: String,
  contactPerson: {
    name: String,
    phone: String,
    email: String
  }
}, {
  timestamps: true
});

// Índices para mejorar el rendimiento
clientSchema.index({ name: 'text', email: 1 });
clientSchema.index({ type: 1 });
clientSchema.index({ isActive: 1 });
clientSchema.index({ status: 1 });

const Client = mongoose.model('Client', clientSchema);

export default Client;
