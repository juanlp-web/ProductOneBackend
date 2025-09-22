import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto']
  },
  level: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    default: ''
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
accountSchema.index({ tenant: 1, code: 1 }, { unique: true });
accountSchema.index({ tenant: 1, type: 1 });
accountSchema.index({ tenant: 1, parentId: 1 });
accountSchema.index({ tenant: 1, isActive: 1 });

// Virtual para obtener el path completo de la cuenta
accountSchema.virtual('fullPath').get(function() {
  return `${this.code} - ${this.name}`;
});

// Middleware para actualizar updatedBy antes de guardar
accountSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedBy = this.updatedBy || this.createdBy;
  }
  next();
});

// Método para obtener todas las cuentas hijas
accountSchema.methods.getChildren = async function() {
  return await this.constructor.find({ parentId: this._id, isActive: true });
};

// Método para obtener el path jerárquico
accountSchema.methods.getHierarchyPath = async function() {
  const path = [];
  let current = this;
  
  while (current) {
    path.unshift({ id: current._id, code: current.code, name: current.name });
    if (current.parentId) {
      current = await this.constructor.findById(current.parentId);
    } else {
      break;
    }
  }
  
  return path;
};

export default mongoose.model('Account', accountSchema);
