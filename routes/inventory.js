import express from 'express';
import Product from '../models/Product.js';
import { protect, manager } from '../middleware/auth.js';
import { identifyTenant } from '../middleware/tenant.js';

const router = express.Router();

// @desc    Obtener resumen del inventario
// @route   GET /api/inventory/summary
// @access  Private
router.get('/summary', protect, identifyTenant, async (req, res) => {
  try {
    const ProductModel = req.tenantModels?.Product || Product;
    const totalProducts = await ProductModel.countDocuments({ isActive: true });
    const lowStockProducts = await ProductModel.countDocuments({
      $expr: { $lte: ['$stock', '$minStock'] },
      isActive: true
    });
    const outOfStockProducts = await ProductModel.countDocuments({
      stock: 0,
      isActive: true
    });
    
    const totalValue = await ProductModel.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: { $multiply: ['$stock', '$cost'] } } } }
    ]);
    
    res.json({
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
      totalValue: totalValue[0]?.total || 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener productos con stock bajo
// @route   GET /api/inventory/low-stock
// @access  Private
router.get('/low-stock', protect, identifyTenant, async (req, res) => {
  try {
    const ProductModel = req.tenantModels?.Product || Product;
    const products = await ProductModel.find({
      $expr: { $lte: ['$stock', '$minStock'] },
      isActive: true
    }).populate('supplier', 'name');
    
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Ajustar stock
// @route   PUT /api/inventory/:id/adjust
// @access  Private (Manager/Admin)
router.put('/:id/adjust', protect, identifyTenant, manager, async (req, res) => {
  try {
    const ProductModel = req.tenantModels?.Product || Product;
    const { quantity, reason, notes } = req.body;
    
    const product = await ProductModel.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    
    const newStock = product.stock + quantity;
    if (newStock < 0) {
      return res.status(400).json({ message: 'El stock no puede ser negativo' });
    }
    
    product.stock = newStock;
    await product.save();
    
    res.json({
      message: 'Stock ajustado correctamente',
      product: {
        _id: product._id,
        name: product.name,
        sku: product.sku,
        stock: product.stock,
        previousStock: product.stock - quantity
      },
      adjustment: {
        quantity,
        reason,
        notes,
        date: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener historial de movimientos de stock
// @route   GET /api/inventory/:id/movements
// @access  Private
router.get('/:id/movements', protect, identifyTenant, async (req, res) => {
  try {
    // Esta funcionalidad requeriría un modelo de movimientos de inventario
    // Por ahora retornamos un mensaje informativo
    res.json({ 
      message: 'Funcionalidad de historial de movimientos en desarrollo',
      productId: req.params.id
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

export default router;
