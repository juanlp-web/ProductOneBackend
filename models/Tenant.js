import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema({
  // Información básica del tenant
  name: {
    type: String,
    required: [true, 'El nombre del tenant es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede tener más de 100 caracteres']
  },
  subdomain: {
    type: String,
    required: [true, 'El subdominio es requerido'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9-]+$/, 'El subdominio solo puede contener letras, números y guiones'],
    minlength: [3, 'El subdominio debe tener al menos 3 caracteres'],
    maxlength: [30, 'El subdominio no puede tener más de 30 caracteres']
  },
  // Información de la empresa/organización
  companyName: {
    type: String,
    required: [true, 'El nombre de la empresa es requerido'],
    trim: true,
    maxlength: [150, 'El nombre de la empresa no puede tener más de 150 caracteres']
  },
  companyEmail: {
    type: String,
    required: [true, 'El email de la empresa es requerido'],
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Por favor ingrese un email válido']
  },
  companyPhone: {
    type: String,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Por favor ingrese un número de teléfono válido']
  },
  companyAddress: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  // Configuración de base de datos
  database: {
    connectionString: {
      type: String,
      required: [true, 'La cadena de conexión de base de datos es requerida']
    },
    databaseName: {
      type: String,
      required: [true, 'El nombre de la base de datos es requerido'],
      match: [/^[a-zA-Z0-9_-]+$/, 'El nombre de la base de datos solo puede contener letras, números, guiones y guiones bajos']
    },
    isShared: {
      type: Boolean,
      default: false,
      required: true
    }
  },
  // Plan y límites
  plan: {
    type: String,
    enum: ['free', 'basic', 'premium', 'enterprise'],
    default: 'free'
  },
  limits: {
    maxUsers: {
      type: Number,
      default: 5
    },
    maxProducts: {
      type: Number,
      default: 100
    },
    maxClients: {
      type: Number,
      default: 50
    },
    maxSuppliers: {
      type: Number,
      default: 20
    },
    maxStorageGB: {
      type: Number,
      default: 1
    },
    maxApiCallsPerMonth: {
      type: Number,
      default: 1000
    }
  },
  // Configuración y features
  features: {
    inventory: {
      type: Boolean,
      default: true
    },
    recipes: {
      type: Boolean,
      default: true
    },
    sales: {
      type: Boolean,
      default: true
    },
    purchases: {
      type: Boolean,
      default: true
    },
    reports: {
      type: Boolean,
      default: false
    },
    api: {
      type: Boolean,
      default: false
    },
    customBranding: {
      type: Boolean,
      default: false
    }
  },
  // Estado y administración
  status: {
    type: String,
    enum: ['active', 'suspended', 'cancelled', 'trial'],
    default: 'trial'
  },
  trialEndsAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 días
    }
  },
  subscriptionEndsAt: {
    type: Date
  },
  // Usuario administrador del tenant
  adminUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Configuración personalizada
  customization: {
    primaryColor: {
      type: String,
      default: '#3B82F6'
    },
    logo: String,
    favicon: String,
    customDomain: String
  },
  // Metadatos
  metadata: {
    totalUsers: {
      type: Number,
      default: 0
    },
    totalProducts: {
      type: Number,
      default: 0
    },
    totalSales: {
      type: Number,
      default: 0
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices
tenantSchema.index({ subdomain: 1 });
tenantSchema.index({ companyEmail: 1 });
tenantSchema.index({ status: 1 });
tenantSchema.index({ plan: 1 });

// Virtuals
tenantSchema.virtual('isActive').get(function() {
  return this.status === 'active' || this.status === 'trial';
});

tenantSchema.virtual('isTrialExpired').get(function() {
  return this.status === 'trial' && this.trialEndsAt < new Date();
});

tenantSchema.virtual('daysUntilTrialExpires').get(function() {
  if (this.status !== 'trial') return null;
  const daysLeft = Math.ceil((this.trialEndsAt - new Date()) / (1000 * 60 * 60 * 24));
  return Math.max(0, daysLeft);
});

// Métodos de instancia
tenantSchema.methods.updateMetadata = async function(updates) {
  Object.assign(this.metadata, updates);
  this.metadata.lastActivity = new Date();
  return this.save();
};

tenantSchema.methods.checkLimits = function(type, current) {
  const limit = this.limits[`max${type.charAt(0).toUpperCase() + type.slice(1)}`];
  return current < limit;
};

tenantSchema.methods.upgradeToBasic = function() {
  this.plan = 'basic';
  this.status = 'active';
  this.limits = {
    maxUsers: 20,
    maxProducts: 1000,
    maxClients: 500,
    maxSuppliers: 100,
    maxStorageGB: 10,
    maxApiCallsPerMonth: 10000
  };
  this.features.reports = true;
  return this.save();
};

tenantSchema.methods.upgradeToEnterprise = function() {
  this.plan = 'enterprise';
  this.status = 'active';
  this.limits = {
    maxUsers: -1, // Ilimitado
    maxProducts: -1,
    maxClients: -1,
    maxSuppliers: -1,
    maxStorageGB: 100,
    maxApiCallsPerMonth: 100000
  };
  Object.keys(this.features).forEach(feature => {
    this.features[feature] = true;
  });
  return this.save();
};

// Métodos estáticos
tenantSchema.statics.findBySubdomain = function(subdomain) {
  return this.findOne({ subdomain: subdomain.toLowerCase() });
};

tenantSchema.statics.findActiveBySubdomain = function(subdomain) {
  return this.findOne({ 
    subdomain: subdomain.toLowerCase(),
    status: { $in: ['active', 'trial'] }
  });
};

// Middleware
tenantSchema.pre('save', function(next) {
  if (this.isModified('subdomain')) {
    this.subdomain = this.subdomain.toLowerCase();
  }
  
  if (this.isModified('companyEmail')) {
    this.companyEmail = this.companyEmail.toLowerCase();
  }
  
  this.updatedAt = new Date();
  next();
});

// Generar nombre de base de datos único
tenantSchema.pre('save', function(next) {
  if (this.isNew && !this.database.databaseName) {
    this.database.databaseName = `tenant_${this.subdomain}_${Date.now()}`;
  }
  next();
});

const Tenant = mongoose.model('Tenant', tenantSchema);

export default Tenant;
