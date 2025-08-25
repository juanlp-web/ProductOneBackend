import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del producto es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede tener más de 100 caracteres']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'La descripción no puede tener más de 500 caracteres']
  },
  sku: {
    type: String,
    unique: true,
    required: [true, 'El SKU es requerido'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'La categoría es requerida'],
    enum: ['materia_prima', 'producto_terminado', 'empaque', 'servicio']
  },
  unit: {
    type: String,
    required: [true, 'La unidad de medida es requerida'],
    enum: ['kg', 'g', 'l', 'ml', 'unidad', 'docena', 'caja', 'metro', 'cm']
  },
  price: {
    type: Number,
    required: [true, 'El precio es requerido'],
    min: [0, 'El precio no puede ser negativo']
  },
  cost: {
    type: Number,
    min: [0, 'El costo no puede ser negativo']
  },
  stock: {
    type: Number,
    default: 0,
    min: [0, 'El stock no puede ser negativo']
  },
  minStock: {
    type: Number,
    default: 0,
    min: [0, 'El stock mínimo no puede ser negativo']
  },
  supplier: {
    type: mongoose.Schema.Types.Mixed, // Puede ser string o ObjectId
    ref: 'Supplier'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  images: [String],
  tags: [String]
}, {
  timestamps: true
});

// Índices para mejorar el rendimiento de las consultas
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ supplier: 1 });
productSchema.index({ isActive: 1 });

const Product = mongoose.model('Product', productSchema);

export default Product;
