import express from 'express';
import Product from '../models/Product.js';
import { protect, manager } from '../middleware/auth.js';

const router = express.Router();

// @desc    Obtener todos los productos
// @route   GET /api/products
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, category, supplier } = req.query;
    
    const query = { isActive: true };
    
    // Filtros de búsqueda
    if (search) {
      // Búsqueda por texto en nombre y descripción
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      query.category = category;
    }
    
    if (supplier) {
      query.supplier = { $regex: supplier, $options: 'i' };
    }
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    };
    
    const products = await Product.find(query)
      .limit(options.limit * 1)
      .skip((options.page - 1) * options.limit)
      .sort(options.sort);
    
    const total = await Product.countDocuments(query);
    
    res.json({
      products,
      totalPages: Math.ceil(total / options.limit),
      currentPage: options.page,
      total
    });
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener producto por ID
// @route   GET /api/products/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('supplier', 'name email phone');
    
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Producto no encontrado' });
    }
  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Crear producto
// @route   POST /api/products
// @access  Private (Manager/Admin)
router.post('/', protect, manager, async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (error) {
    console.error('Error al crear producto:', error);
    if (error.code === 11000) {
      res.status(400).json({ message: 'El SKU ya existe' });
    } else {
      res.status(500).json({ message: 'Error en el servidor' });
    }
  }
});

// @desc    Actualizar producto
// @route   PUT /api/products/:id
// @access  Private (Manager/Admin)
router.put('/:id', protect, manager, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Producto no encontrado' });
    }
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Eliminar producto (soft delete)
// @route   DELETE /api/products/:id
// @access  Private (Manager/Admin)
router.delete('/:id', protect, manager, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (product) {
      res.json({ message: 'Producto eliminado correctamente' });
    } else {
      res.status(404).json({ message: 'Producto no encontrado' });
    }
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Actualizar stock
// @route   PUT /api/products/:id/stock
// @access  Private
router.put('/:id/stock', protect, async (req, res) => {
  try {
    const { quantity, operation } = req.body; // operation: 'add' o 'subtract'
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    
    if (operation === 'add') {
      product.stock += quantity;
    } else if (operation === 'subtract') {
      if (product.stock < quantity) {
        return res.status(400).json({ message: 'Stock insuficiente' });
      }
      product.stock -= quantity;
    }
    
    await product.save();
    res.json(product);
  } catch (error) {
    console.error('Error al actualizar stock:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener productos con stock bajo
// @route   GET /api/products/low-stock
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

export default router;
