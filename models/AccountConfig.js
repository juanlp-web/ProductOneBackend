import mongoose from 'mongoose';

const accountConfigSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  module: {
    type: String,
    required: true,
    enum: ['ventas', 'compras', 'bancos', 'clientes', 'proveedores']
  },
  configurations: {
    type: Map,
    of: {
      accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        required: true
      },
      accountCode: {
        type: String,
        required: true
      },
      accountName: {
        type: String,
        required: true
      },
      accountType: {
        type: String,
        required: true,
        enum: ['activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto']
      }
    }
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
accountConfigSchema.index({ tenant: 1, module: 1 }, { unique: true });
accountConfigSchema.index({ tenant: 1 });

// Middleware para actualizar updatedBy antes de guardar
accountConfigSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedBy = this.updatedBy || this.createdBy;
  }
  next();
});

export default mongoose.model('AccountConfig', accountConfigSchema);
