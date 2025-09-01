import mongoose from 'mongoose';

const passwordResetSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: function() {
      // El token expira en 1 hora
      return new Date(Date.now() + 60 * 60 * 1000);
    }
  },
  used: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índice para limpiar tokens expirados automáticamente
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Índice para búsquedas por email y token
passwordResetSchema.index({ email: 1, token: 1 });

// Método para verificar si el token es válido
passwordResetSchema.methods.isValid = function() {
  return !this.used && this.expiresAt > new Date();
};

// Método para marcar el token como usado
passwordResetSchema.methods.markAsUsed = function() {
  this.used = true;
  return this.save();
};

const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);

export default PasswordReset;
