import express from 'express';
import Recipe from '../models/Recipe.js';
import Product from '../models/Product.js';
import Batch from '../models/Batch.js';
import { protect, manager } from '../middleware/auth.js';

const router = express.Router();

// Función auxiliar para consumir ingredientes de una receta
const consumeIngredients = async (recipe) => {
  const consumedIngredients = []
  const errors = []
  
  for (const ingredient of recipe.ingredients) {
    // Solo procesar ingredientes que tengan un producto asignado
    if (ingredient.product) {
      try {
        const product = await Product.findById(ingredient.product)
        if (!product) {
          errors.push(`Producto ${ingredient.name || ingredient.product} no encontrado`)
          continue
        }
        
                 const quantityToConsume = ingredient.quantity
        
        if (product.stock < quantityToConsume) {
          errors.push(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}, Necesario: ${quantityToConsume}`)
          continue
        }
        
        // Disminuir el stock
        product.stock -= quantityToConsume
        await product.save()
        
        consumedIngredients.push({
          productId: product._id,
          productName: product.name,
          quantityConsumed: quantityToConsume,
          oldStock: product.stock + quantityToConsume,
          newStock: product.stock
        })
        
      } catch (error) {
        errors.push(`Error al procesar ingrediente ${ingredient.name || ingredient.product}: ${error.message}`)
      }
    }
  }
  
  return { consumedIngredients, errors }
}

// Función auxiliar para restaurar ingredientes de una receta
const restoreIngredients = async (recipe) => {
  const restoredIngredients = []
  const errors = []
  
  for (const ingredient of recipe.ingredients) {
    // Solo procesar ingredientes que tengan un producto asignado
    if (ingredient.product) {
      try {
        const product = await Product.findById(ingredient.product)
        if (!product) {
          errors.push(`Producto ${ingredient.name || ingredient.product} no encontrado`)
          continue
        }
        
                 const quantityToRestore = ingredient.quantity
        
        // Aumentar el stock
        product.stock += quantityToRestore
        await product.save()
        
        restoredIngredients.push({
          productId: product._id,
          productName: product.name,
          quantityRestored: quantityToRestore,
          oldStock: product.stock - quantityToRestore,
          newStock: product.stock
        })
        
      } catch (error) {
        errors.push(`Error al restaurar ingrediente ${ingredient.name || ingredient.product}: ${error.message}`)
      }
    }
  }
  
  return { restoredIngredients, errors }
}

// @desc    Obtener todas las recetas
// @route   GET /api/recipes
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, category, difficulty, status } = req.query;
    
    const query = { isActive: true };
    
    if (search) {
      query.$text = { $search: search };
    }
    
    if (category) {
      query.category = category;
    }
    
    if (difficulty) {
      query.difficulty = difficulty;
    }
    
    if (status) {
      query.status = status;
    }
    
    const recipes = await Recipe.find(query)
      .populate('ingredients.product', 'name sku')
      .populate('productToProduce', 'name sku')
      .populate('createdBy', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    
    const total = await Recipe.countDocuments(query);
    
    res.json({
      recipes,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error al obtener recetas:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener receta por ID
// @route   GET /api/recipes/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id)
      .populate('ingredients.product', 'name sku price cost stock')
      .populate('productToProduce', 'name sku')
      .populate('createdBy', 'name');
    
    if (recipe) {
      res.json(recipe);
    } else {
      res.status(404).json({ message: 'Receta no encontrada' });
    }
  } catch (error) {
    console.error('Error al obtener receta:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Crear receta
// @route   POST /api/recipes
// @access  Private (Manager/Admin)
router.post('/', protect, manager, async (req, res) => {
  try {
    const recipeData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    const recipe = await Recipe.create(recipeData);
    res.status(201).json(recipe);
  } catch (error) {
    console.error('Error al crear receta:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Actualizar receta
// @route   PUT /api/recipes/:id
// @access  Private (Manager/Admin)
router.put('/:id', protect, manager, async (req, res) => {
  try {
    const recipe = await Recipe.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (recipe) {
      res.json(recipe);
    } else {
      res.status(404).json({ message: 'Receta no encontrada' });
    }
  } catch (error) {
    console.error('Error al actualizar receta:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Eliminar receta
// @route   DELETE /api/recipes/:id
// @access  Private (Manager/Admin)
router.delete('/:id', protect, manager, async (req, res) => {
  try {
    const recipe = await Recipe.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (recipe) {
      res.json({ message: 'Receta eliminada correctamente' });
    } else {
      res.status(404).json({ message: 'Receta no encontrada' });
    }
  } catch (error) {
    console.error('Error al eliminar receta:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Calcular costo de receta
// @route   GET /api/recipes/:id/cost
// @access  Private
router.get('/:id/cost', protect, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id)
      .populate('ingredients.product', 'cost');
    
    if (!recipe) {
      return res.status(404).json({ message: 'Receta no encontrada' });
    }
    
    let totalCost = 0;
    recipe.ingredients.forEach(ingredient => {
      if (ingredient.product && ingredient.product.cost) {
        totalCost += ingredient.product.cost * ingredient.quantity;
      }
    });
    
    res.json({
      recipeId: recipe._id,
      recipeName: recipe.name,
      totalCost: totalCost,
      costPerServing: totalCost / recipe.servings
    });
  } catch (error) {
    console.error('Error al calcular costo:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Cambiar estado de receta
// @route   PUT /api/recipes/:id/status
// @access  Private (Manager/Admin)
router.put('/:id/status', protect, manager, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['en_preparacion', 'completada', 'descartada'].includes(status)) {
      return res.status(400).json({ message: 'Estado no válido' });
    }
    
    const recipe = await Recipe.findById(req.params.id)
      .populate('productToProduce', 'name sku stock');
    
    if (!recipe) {
      return res.status(404).json({ message: 'Receta no encontrada' });
    }
    
    const oldStatus = recipe.status;
    const newStatus = status;
    
    // Si el estado anterior era "completada" y el nuevo no lo es, disminuir el stock y eliminar lotes
    if (oldStatus === 'completada' && newStatus !== 'completada') {
      if (!recipe.productToProduce) {
        return res.status(400).json({ message: 'La receta no tiene un producto asociado para actualizar el stock' });
      }

      const product = await Product.findById(recipe.productToProduce._id);
      if (!product) {
        return res.status(404).json({ message: 'Producto no encontrado' });
      }

      const quantityToDecrease = recipe.batchInfo?.quantity || recipe.servings || 1;

      // Verificar que hay suficiente stock para disminuir
      if (product.stock < quantityToDecrease) {
        return res.status(400).json({ 
          message: `Stock insuficiente. El producto ${product.name} tiene ${product.stock} unidades, pero se necesitan ${quantityToDecrease} para revertir la receta.` 
        });
      }

      // Restaurar ingredientes consumidos
      const { restoredIngredients, errors: restoreErrors } = await restoreIngredients(recipe);
      
      if (restoreErrors.length > 0) {
        return res.status(500).json({ 
          message: 'Error al restaurar ingredientes',
          errors: restoreErrors
        });
      }

      // Buscar y eliminar lotes asociados a esta receta
      const batchesToRemove = await Batch.find({
        recipe: recipe._id,
        isActive: true
      });

      let batchesRemoved = [];
      for (const batch of batchesToRemove) {
        batch.isActive = false;
        await batch.save();
        batchesRemoved.push({
          batchNumber: batch.batchNumber,
          quantity: batch.currentStock
        });
      }

      // Disminuir stock del producto producido
      product.stock -= quantityToDecrease;
      await product.save();

      // Actualizar estado de la receta
      recipe.status = newStatus;
      await recipe.save();

      return res.json({
        message: `Receta cambiada a ${newStatus}. Stock del producto ${product.name} disminuido en ${quantityToDecrease} unidad(es). Lotes eliminados e ingredientes restaurados exitosamente.`,
        recipe: recipe,
        stockChange: {
          productId: product._id,
          productName: product.name,
          oldStock: product.stock + quantityToDecrease,
          newStock: product.stock,
          change: -quantityToDecrease
        },
        ingredientsRestored: restoredIngredients,
        batchesRemoved: batchesRemoved
      });
    }
    
    // Si el nuevo estado es "completada", crear lote y aumentar el stock
    if (newStatus === 'completada') {
      if (!recipe.productToProduce) {
        return res.status(400).json({ message: 'La receta no tiene un producto asociado para actualizar el stock' });
      }

      // Verificar que la receta tenga información de lote
      if (!recipe.batchInfo || !recipe.batchInfo.expirationDate || !recipe.batchInfo.quantity) {
        return res.status(400).json({ 
          message: 'La receta debe tener información de lote (fecha de vencimiento y cantidad) para ser completada' 
        });
      }

      // Primero verificar que haya stock suficiente para todos los ingredientes
      const { consumedIngredients, errors: ingredientErrors } = await consumeIngredients(recipe);
      
      if (ingredientErrors.length > 0) {
        return res.status(400).json({ 
          message: 'No hay stock suficiente para completar la receta',
          errors: ingredientErrors
        });
      }

      // Obtener el producto a producir
      const product = await Product.findById(recipe.productToProduce._id);
      if (!product) {
        return res.status(404).json({ message: 'Producto no encontrado' });
      }

      // Crear el lote
      const batchData = {
        product: product._id,
        productName: product.name,
        quantity: recipe.batchInfo.quantity,
        unit: recipe.batchInfo.unit,
        productionDate: recipe.batchInfo.productionDate || new Date(),
        expirationDate: recipe.batchInfo.expirationDate,
        initialStock: recipe.batchInfo.quantity,
        currentStock: recipe.batchInfo.quantity,
        cost: recipe.cost || 0,
        recipe: recipe._id,
        recipeName: recipe.name,
        notes: `Lote creado automáticamente al completar receta: ${recipe.name}`,
        createdBy: req.user._id
      };

      const batch = await Batch.create(batchData);

      // Aumentar stock del producto producido
      product.stock += recipe.batchInfo.quantity;
      await product.save();

      // Actualizar estado de la receta
      recipe.status = newStatus;
      await recipe.save();

      return res.json({
        message: `Receta marcada como completada. Lote ${batch.batchNumber} creado exitosamente. Stock del producto ${product.name} aumentado en ${recipe.batchInfo.quantity} ${recipe.batchInfo.unit}. Ingredientes consumidos exitosamente.`,
        recipe: recipe,
        batch: batch,
        stockChange: {
          productId: product._id,
          productName: product.name,
          oldStock: product.stock - recipe.batchInfo.quantity,
          newStock: product.stock,
          change: recipe.batchInfo.quantity
        },
        ingredientsConsumed: consumedIngredients
      });
    }
    
    // Para otros cambios de estado (sin afectar stock)
    recipe.status = newStatus;
    await recipe.save();
    
    res.json({
      message: `Receta cambiada a ${newStatus}`,
      recipe: recipe
    });
    
  } catch (error) {
    console.error('Error al cambiar estado de receta:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

export default router;
