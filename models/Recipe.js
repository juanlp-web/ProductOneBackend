import mongoose from 'mongoose';

const recipeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre de la receta es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede tener más de 100 caracteres']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'La descripción no puede tener más de 500 caracteres']
  },
  category: {
    type: String,
    required: [true, 'La categoría es requerida'],
    enum: ['bebida', 'alimento', 'postre', 'otro']
  },
  difficulty: {
    type: String,
    enum: ['facil', 'medio', 'dificil'],
    default: 'medio'
  },
  status: {
    type: String,
    enum: ['en_preparacion', 'completada', 'descartada'],
    default: 'en_preparacion'
  },
  preparationTime: {
    type: Number,
    min: [1, 'El tiempo de preparación debe ser mayor a 0'],
    required: [true, 'El tiempo de preparación es requerido']
  },
  cookingTime: {
    type: Number,
    min: [0, 'El tiempo de cocción no puede ser negativo']
  },
  servings: {
    type: Number,
    min: [1, 'Las porciones deben ser mayor a 0'],
    required: [true, 'El número de porciones es requerido']
  },
  productToProduce: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'El producto a producir es requerido']
  },
  ingredients: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
      // No es requerido para ingredientes genéricos
    },
    name: {
      type: String,
      // Nombre para ingredientes genéricos
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, 'La cantidad no puede ser negativa']
    },
    unit: {
      type: String,
      required: true
    },
    notes: String
  }],
  instructions: [{
    step: {
      type: Number,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    time: Number
  }],
  cost: {
    type: Number,
    min: [0, 'El costo no puede ser negativo']
  },
  sellingPrice: {
    type: Number,
    min: [0, 'El precio de venta no puede ser negativo']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  tags: [String],
  images: [String],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Validación personalizada para ingredientes
recipeSchema.path('ingredients').validate(function(ingredients) {
  if (!ingredients || ingredients.length === 0) {
    return false;
  }
  
  for (let ingredient of ingredients) {
    // Cada ingrediente debe tener o un producto o un nombre
    if (!ingredient.product && !ingredient.name) {
      return false;
    }
    // Si tiene producto, no debe tener nombre (y viceversa)
    if (ingredient.product && ingredient.name) {
      return false;
    }
  }
  
  return true;
}, 'Cada ingrediente debe tener o un producto del inventario o un nombre genérico, pero no ambos');

// Índices para mejorar el rendimiento
recipeSchema.index({ name: 'text', description: 'text' });
recipeSchema.index({ category: 1 });
recipeSchema.index({ difficulty: 1 });
recipeSchema.index({ isActive: 1 });

const Recipe = mongoose.model('Recipe', recipeSchema);

export default Recipe;
