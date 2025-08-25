import express from 'express';
import Product from '../models/Product.js';
import { protect, manager } from '../middleware/auth.js';

const router = express.Router();

// @desc    Obtener resumen del inventario
// @route   GET /api/inventory/summary
// @access  Private
router.get('/summary', protect, async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments({ isActive: true });
    const lowStockProducts = await Product.countDocuments({
      $expr: { $lte: ['$stock', '$minStock'] },
      isActive: true
    });
    const outOfStockProducts = await Product.countDocuments({
      stock: 0,
      isActive: true
    });
    
    const totalValue = await Product.aggregate([
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
    console.error('Error al obtener resumen del inventario:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener productos con stock bajo
// @route   GET /api/inventory/low-stock
// @access  Private
router.get('/low-stock', protect, async (req, res) => {
  try {
    const products = await Product.find({
      $expr: { $lte: ['$stock', '$minStock'] },
      isActive: true
    }).populate('supplier', 'name');
    
    res.json(products);
  } catch (error) {
    console.error('Error al obtener productos con stock bajo:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Ajustar stock
// @route   PUT /api/inventory/:id/adjust
// @access  Private (Manager/Admin)
router.put('/:id/adjust', protect, manager, async (req, res) => {
  try {
    const { quantity, reason, notes } = req.body;
    
    const product = await Product.findById(req.params.id);
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
    console.error('Error al ajustar stock:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener historial de movimientos de stock
// @route   GET /api/inventory/:id/movements
// @access  Private
router.get('/:id/movements', protect, async (req, res) => {
  try {
    // Esta funcionalidad requeriría un modelo de movimientos de inventario
    // Por ahora retornamos un mensaje informativo
    res.json({ 
      message: 'Funcionalidad de historial de movimientos en desarrollo',
      productId: req.params.id
    });
  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

export default router;
