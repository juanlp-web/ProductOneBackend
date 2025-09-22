import express from 'express';
import Batch from '../models/Batch.js';
import Product from '../models/Product.js';
import Recipe from '../models/Recipe.js';
import { protect, manager } from '../middleware/auth.js';
import { identifyTenant } from '../middleware/tenant.js';

const router = express.Router();

// @desc    Obtener todos los lotes
// @route   GET /api/batches
// @access  Private
router.get('/', protect, identifyTenant, async (req, res) => {
  try {
    const BatchModel = req.tenantModels?.Batch || Batch;
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
    
    const ProductModel = req.tenantModels?.Product || Product;
    const RecipeModel = req.tenantModels?.Recipe || Recipe;
    
    const batches = await BatchModel.find(query)
      .populate('product', 'name sku', ProductModel)
      .populate('recipe', 'name', RecipeModel)
      .populate('createdBy', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    
    const total = await BatchModel.countDocuments(query);
    
    res.json({
      batches,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener lote por ID
// @route   GET /api/batches/:id
// @access  Private
router.get('/:id', protect, identifyTenant, async (req, res) => {
  try {
    const BatchModel = req.tenantModels?.Batch || Batch;
    const ProductModel = req.tenantModels?.Product || Product;
    const RecipeModel = req.tenantModels?.Recipe || Recipe;
    
    const batch = await BatchModel.findById(req.params.id)
      .populate('product', 'name sku price cost stock', ProductModel)
      .populate('recipe', 'name', RecipeModel)
      .populate('createdBy', 'name');
    
    if (batch) {
      res.json(batch);
    } else {
      res.status(404).json({ message: 'Lote no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Crear lote
// @route   POST /api/batches
// @access  Private (Manager/Admin)
router.post('/', protect, identifyTenant, manager, async (req, res) => {
  try {
    const batchData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    // Verificar que el producto existe
    const ProductModel = req.tenantModels?.Product || Product;
    const product = await ProductModel.findById(batchData.product);
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    
    // Verificar que la receta existe
    const RecipeModel = req.tenantModels?.Recipe || Recipe;
    const recipe = await RecipeModel.findById(batchData.recipe);
    if (!recipe) {
      return res.status(404).json({ message: 'Receta no encontrada' });
    }
    
    // Agregar nombre del producto y receta
    batchData.productName = product.name;
    batchData.recipeName = recipe.name;
    
    const BatchModel = req.tenantModels?.Batch || Batch;
    const batch = await BatchModel.create(batchData);
    
    // Actualizar el stock del producto principal
    product.stock += batchData.quantity;
    await product.save();
    
    res.status(201).json(batch);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Actualizar lote
// @route   PUT /api/batches/:id
// @access  Private (Manager/Admin)
router.put('/:id', protect, identifyTenant, manager, async (req, res) => {
  try {
    const BatchModel = req.tenantModels?.Batch || Batch;
    const batch = await BatchModel.findByIdAndUpdate(
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
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Eliminar lote
// @route   DELETE /api/batches/:id
// @access  Private (Manager/Admin)
router.delete('/:id', protect, identifyTenant, manager, async (req, res) => {
  try {
    const BatchModel = req.tenantModels?.Batch || Batch;
    const ProductModel = req.tenantModels?.Product || Product;
    
    const batch = await BatchModel.findById(req.params.id);
    
    if (!batch) {
      return res.status(404).json({ message: 'Lote no encontrado' });
    }
    
    // Restar el stock del producto principal
    const product = await ProductModel.findById(batch.product);
    if (product) {
      product.stock -= batch.currentStock;
      await product.save();
    }
    
    // Marcar como inactivo
    batch.isActive = false;
    await batch.save();
    
    res.json({ message: 'Lote eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Consumir stock del lote
// @route   PUT /api/batches/:id/consume
// @access  Private (Manager/Admin)
router.put('/:id/consume', protect, identifyTenant, manager, async (req, res) => {
  try {
    const { quantity } = req.body;
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: 'La cantidad debe ser mayor a 0' });
    }
    
    const BatchModel = req.tenantModels?.Batch || Batch;
    const ProductModel = req.tenantModels?.Product || Product;
    
    const batch = await BatchModel.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: 'Lote no encontrado' });
    }
    
    const newStock = await batch.consumeStock(quantity);
    
    // Actualizar el stock del producto principal
    const product = await ProductModel.findById(batch.product);
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
    res.status(500).json({ message: error.message || 'Error en el servidor' });
  }
});

// @desc    Restaurar stock del lote
// @route   PUT /api/batches/:id/restore
// @access  Private (Manager/Admin)
router.put('/:id/restore', protect, identifyTenant, manager, async (req, res) => {
  try {
    const { quantity } = req.body;
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: 'La cantidad debe ser mayor a 0' });
    }
    
    const BatchModel = req.tenantModels?.Batch || Batch;
    const ProductModel = req.tenantModels?.Product || Product;
    
    const batch = await BatchModel.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: 'Lote no encontrado' });
    }
    
    const newStock = await batch.restoreStock(quantity);
    
    // Actualizar el stock del producto principal
    const product = await ProductModel.findById(batch.product);
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
    res.status(500).json({ message: error.message || 'Error en el servidor' });
  }
});

// @desc    Obtener lotes activos de un producto
// @route   GET /api/batches/product/:productId/active
// @access  Private
router.get('/product/:productId/active', protect, identifyTenant, async (req, res) => {
  try {
    const BatchModel = req.tenantModels?.Batch || Batch;
    
    // Implementar la lógica de getActiveBatches manualmente para usar el modelo del tenant
    const ProductModel = req.tenantModels?.Product || Product;
    const batches = await BatchModel.find({
      product: req.params.productId,
      isActive: true,
      status: 'activo',
      currentStock: { $gt: 0 }
    })
    .populate('product', 'name sku', ProductModel)
    .sort({ expirationDate: 1 });
    
    res.json(batches);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener estadísticas de lotes
// @route   GET /api/batches/stats/overview
// @access  Private
router.get('/stats/overview', protect, identifyTenant, async (req, res) => {
  try {
    const BatchModel = req.tenantModels?.Batch || Batch;
    
    // Implementar la lógica de getStats manualmente para usar el modelo del tenant
    const totalBatches = await BatchModel.countDocuments({ isActive: true });
    const activeBatches = await BatchModel.countDocuments({ 
      isActive: true, 
      status: 'activo',
      currentStock: { $gt: 0 }
    });
    const expiredBatches = await BatchModel.countDocuments({
      isActive: true,
      expirationDate: { $lt: new Date() }
    });
    
    const stats = {
      totalBatches,
      activeBatches,
      expiredBatches,
      lowStockBatches: await BatchModel.countDocuments({
        isActive: true,
        status: 'activo',
        currentStock: { $gt: 0, $lt: 10 }
      })
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener lotes próximos a vencer
// @route   GET /api/batches/expiring-soon
// @access  Private
router.get('/expiring-soon', protect, identifyTenant, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));
    
    const BatchModel = req.tenantModels?.Batch || Batch;
    const ProductModel = req.tenantModels?.Product || Product;
    const RecipeModel = req.tenantModels?.Recipe || Recipe;
    
    const expiringBatches = await BatchModel.find({
      isActive: true,
      status: 'activo',
      currentStock: { $gt: 0 },
      expirationDate: { 
        $gte: new Date(), 
        $lte: futureDate 
      }
    })
    .populate('product', 'name sku', ProductModel)
    .populate('recipe', 'name', RecipeModel)
    .sort({ expirationDate: 1 });
    
    res.json(expiringBatches);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

export default router;

