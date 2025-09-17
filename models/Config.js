import mongoose from 'mongoose';

const configSchema = new mongoose.Schema({
  key: {
    type: String,
    required: [true, 'La clave de configuración es requerida'],
    unique: true,
    trim: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'El valor de configuración es requerido']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'La descripción no puede tener más de 500 caracteres']
  },
  type: {
    type: String,
    required: [true, 'El tipo de configuración es requerido'],
    enum: ['string', 'number', 'boolean', 'object', 'array']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Índices
configSchema.index({ key: 1 });
configSchema.index({ isActive: 1 });

// Método estático para obtener configuración por clave
configSchema.statics.getByKey = async function(key) {
  const config = await this.findOne({ key, isActive: true });
  return config ? config.value : null;
};

// Método estático para establecer configuración
configSchema.statics.setByKey = async function(key, value, type = 'string', description = '', userId = null) {
  const existingConfig = await this.findOne({ key });
  
  if (existingConfig) {
    existingConfig.value = value;
    existingConfig.type = type;
    existingConfig.description = description;
    existingConfig.updatedBy = userId;
    return await existingConfig.save();
  } else {
    return await this.create({
      key,
      value,
      type,
      description,
      createdBy: userId,
      updatedBy: userId
    });
  }
};

// Método estático para obtener todas las configuraciones activas
configSchema.statics.getAllActive = async function() {
  const configs = await this.find({ isActive: true }).sort({ key: 1 });
  const configObject = {};
  configs.forEach(config => {
    configObject[config.key] = config.value;
  });
  return configObject;
};

export default mongoose.model('Config', configSchema);
