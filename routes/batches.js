import express from 'express';
import Batch from '../models/Batch.js';
import Product from '../models/Product.js';
import Recipe from '../models/Recipe.js';
import { protect, manager } from '../middleware/auth.js';

const router = express.Router();

// @desc    Obtener todos los lotes
// @route   GET /api/batches
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, product, status, recipe } = req.query;
    
    const query = { isActive: true };
    
    if (search) {
      query.$or = [
        { batchNumber: { $regex: search, $options: 'i' } },
        { productName: { $regex: search, $options: 'i' } },
        { recipeName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (product) {
      query.product = product;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (recipe) {
      query.recipe = recipe;
    }
    
    const batches = await Batch.find(query)
      .populate('product', 'name sku')
      .populate('recipe', 'name')
      .populate('createdBy', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    
    const total = await Batch.countDocuments(query);
    
    res.json({
      batches,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error al obtener lotes:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener lote por ID
// @route   GET /api/batches/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id)
      .populate('product', 'name sku price cost stock')
      .populate('recipe', 'name')
      .populate('createdBy', 'name');
    
    if (batch) {
      res.json(batch);
    } else {
      res.status(404).json({ message: 'Lote no encontrado' });
    }
  } catch (error) {
    console.error('Error al obtener lote:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Crear lote
// @route   POST /api/batches
// @access  Private (Manager/Admin)
router.post('/', protect, manager, async (req, res) => {
  try {
    const batchData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    // Verificar que el producto existe
    const product = await Product.findById(batchData.product);
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    
    // Verificar que la receta existe
    const recipe = await Recipe.findById(batchData.recipe);
    if (!recipe) {
      return res.status(404).json({ message: 'Receta no encontrada' });
    }
    
    // Agregar nombre del producto y receta
    batchData.productName = product.name;
    batchData.recipeName = recipe.name;
    
    const batch = await Batch.create(batchData);
    
    // Actualizar el stock del producto principal
    product.stock += batchData.quantity;
    await product.save();
    
    res.status(201).json(batch);
  } catch (error) {
    console.error('Error al crear lote:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Actualizar lote
// @route   PUT /api/batches/:id
// @access  Private (Manager/Admin)
router.put('/:id', protect, manager, async (req, res) => {
  try {
    const batch = await Batch.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (batch) {
      res.json(batch);
    } else {
      res.status(404).json({ message: 'Lote no encontrado' });
    }
  } catch (error) {
    console.error('Error al actualizar lote:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Eliminar lote
// @route   DELETE /api/batches/:id
// @access  Private (Manager/Admin)
router.delete('/:id', protect, manager, async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    
    if (!batch) {
      return res.status(404).json({ message: 'Lote no encontrado' });
    }
    
    // Restar el stock del producto principal
    const product = await Product.findById(batch.product);
    if (product) {
      product.stock -= batch.currentStock;
      await product.save();
    }
    
    // Marcar como inactivo
    batch.isActive = false;
    await batch.save();
    
    res.json({ message: 'Lote eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar lote:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Consumir stock del lote
// @route   PUT /api/batches/:id/consume
// @access  Private (Manager/Admin)
router.put('/:id/consume', protect, manager, async (req, res) => {
  try {
    const { quantity } = req.body;
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: 'La cantidad debe ser mayor a 0' });
    }
    
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: 'Lote no encontrado' });
    }
    
    const newStock = await batch.consumeStock(quantity);
    
    // Actualizar el stock del producto principal
    const product = await Product.findById(batch.product);
    if (product) {
      product.stock -= quantity;
      await product.save();
    }
    
    res.json({
      message: `Stock consumido exitosamente. Nuevo stock del lote: ${newStock}`,
      batch: batch,
      newStock: newStock
    });
  } catch (error) {
    console.error('Error al consumir stock del lote:', error);
    res.status(500).json({ message: error.message || 'Error en el servidor' });
  }
});

// @desc    Restaurar stock del lote
// @route   PUT /api/batches/:id/restore
// @access  Private (Manager/Admin)
router.put('/:id/restore', protect, manager, async (req, res) => {
  try {
    const { quantity } = req.body;
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: 'La cantidad debe ser mayor a 0' });
    }
    
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: 'Lote no encontrado' });
    }
    
    const newStock = await batch.restoreStock(quantity);
    
    // Actualizar el stock del producto principal
    const product = await Product.findById(batch.product);
    if (product) {
      product.stock += quantity;
      await product.save();
    }
    
    res.json({
      message: `Stock restaurado exitosamente. Nuevo stock del lote: ${newStock}`,
      batch: batch,
      newStock: newStock
    });
  } catch (error) {
    console.error('Error al restaurar stock del lote:', error);
    res.status(500).json({ message: error.message || 'Error en el servidor' });
  }
});

// @desc    Obtener lotes activos de un producto
// @route   GET /api/batches/product/:productId/active
// @access  Private
router.get('/product/:productId/active', protect, async (req, res) => {
  try {
    console.log('ProductId recibido:', req.params.productId, 'Tipo:', typeof req.params.productId);
    const batches = await Batch.getActiveBatches(req.params.productId);
    res.json(batches);
  } catch (error) {
    console.error('Error al obtener lotes activos:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener estadísticas de lotes
// @route   GET /api/batches/stats/overview
// @access  Private
router.get('/stats/overview', protect, async (req, res) => {
  try {
    const stats = await Batch.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener lotes próximos a vencer
// @route   GET /api/batches/expiring-soon
// @access  Private
router.get('/expiring-soon', protect, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));
    
    const expiringBatches = await Batch.find({
      isActive: true,
      status: 'activo',
      currentStock: { $gt: 0 },
      expirationDate: { 
        $gte: new Date(), 
        $lte: futureDate 
      }
    })
    .populate('product', 'name sku')
    .populate('recipe', 'name')
    .sort({ expirationDate: 1 });
    
    res.json(expiringBatches);
  } catch (error) {
    console.error('Error al obtener lotes próximos a vencer:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

export default router;

