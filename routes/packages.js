import express from 'express';
import Package from '../models/Package.js';
import Product from '../models/Product.js';
import { protect, manager } from '../middleware/auth.js';
import { identifyTenant } from '../middleware/tenant.js';

const router = express.Router();

// @desc    Obtener todos los paquetes
// @route   GET /api/packages
// @access  Private
router.get('/', protect, identifyTenant, async (req, res) => {
  try {
    
    const PackageModel = req.tenantModels?.Package || Package;
    const { page = 1, limit = 10, search, category, isActive } = req.query;
    
    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      query.category = category;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const packages = await PackageModel.find(query)
      .populate({
        path: 'items.product',
        select: 'name sku price cost stock category',
        model: req.tenantModels?.Product || Product
      })
      .populate('createdBy', 'name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    
    const total = await PackageModel.countDocuments(query);
    
    res.json({
      packages,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener un paquete por ID
// @route   GET /api/packages/:id
// @access  Private
router.get('/:id', protect, identifyTenant, async (req, res) => {
  try {
    const PackageModel = req.tenantModels?.Package || Package;
    const packageItem = await PackageModel.findById(req.params.id)
      .populate({
        path: 'items.product',
        select: 'name sku price cost stock category',
        model: req.tenantModels?.Product || Product
      })
      .populate('createdBy', 'name email');
    
    if (packageItem) {
      res.json(packageItem);
    } else {
      res.status(404).json({ message: 'Paquete no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Crear nuevo paquete
// @route   POST /api/packages
// @access  Private (Manager/Admin)
router.post('/', protect, identifyTenant, manager, async (req, res) => {
  try {
    const { name, description, sku, category, items, sellingPrice, discount, notes, tags } = req.body;
    
    // Validar que se proporcionen items
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'El paquete debe contener al menos un producto' });
    }
    
    // Validar y calcular costos de los items
    let totalCost = 0;
    const processedItems = [];
    
    const ProductModel = req.tenantModels?.Product || Product;
    for (const item of items) {
      const product = await ProductModel.findById(item.product);
      if (!product) {
        return res.status(400).json({ message: `Producto ${item.product} no encontrado` });
      }
      
      const unitPrice = item.unitPrice || product.price;
      const quantity = item.quantity || 1;
      const totalPrice = unitPrice * quantity;
      
      totalCost += product.cost * quantity;
      
      processedItems.push({
        product: product._id,
        quantity,
        unitPrice,
        totalPrice
      });
    }
    
    const packageData = {
      name,
      description,
      sku,
      category,
      items: processedItems,
      totalCost,
      sellingPrice,
      discount: discount || 0,
      notes,
      tags: tags || [],
      createdBy: req.user._id
    };
    
    const PackageModel = req.tenantModels?.Package || Package;
    const newPackage = await PackageModel.create(packageData);
    await newPackage.populate({
      path: 'items.product',
      select: 'name sku price cost stock category',
      model: req.tenantModels?.Product || Product
    });
    
    res.status(201).json(newPackage);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'El SKU del paquete ya existe' });
    } else {
      res.status(500).json({ message: 'Error en el servidor' });
    }
  }
});

// @desc    Actualizar paquete
// @route   PUT /api/packages/:id
// @access  Private (Manager/Admin)
router.put('/:id', protect, identifyTenant, manager, async (req, res) => {
  try {
    const { name, description, sku, category, items, sellingPrice, discount, notes, tags, isActive } = req.body;
    
    const PackageModel = req.tenantModels?.Package || Package;
    const packageItem = await PackageModel.findById(req.params.id);
    if (!packageItem) {
      return res.status(404).json({ message: 'Paquete no encontrado' });
    }
    
    // Si se actualizan los items, recalcular costos
    if (items && items.length > 0) {
      let totalCost = 0;
      const processedItems = [];
      
      const ProductModel = req.tenantModels?.Product || Product;
      for (const item of items) {
        const product = await ProductModel.findById(item.product);
        if (!product) {
          return res.status(400).json({ message: `Producto ${item.product} no encontrado` });
        }
        
        const unitPrice = item.unitPrice || product.price;
        const quantity = item.quantity || 1;
        const totalPrice = unitPrice * quantity;
        
        totalCost += product.cost * quantity;
        
        processedItems.push({
          product: product._id,
          quantity,
          unitPrice,
          totalPrice
        });
      }
      
      packageItem.items = processedItems;
      packageItem.totalCost = totalCost;
    }
    
    // Actualizar otros campos
    if (name) packageItem.name = name;
    if (description !== undefined) packageItem.description = description;
    if (sku) packageItem.sku = sku;
    if (category) packageItem.category = category;
    if (sellingPrice !== undefined) packageItem.sellingPrice = sellingPrice;
    if (discount !== undefined) packageItem.discount = discount;
    if (notes !== undefined) packageItem.notes = notes;
    if (tags) packageItem.tags = tags;
    if (isActive !== undefined) packageItem.isActive = isActive;
    
    await packageItem.save();
    await packageItem.populate({
      path: 'items.product',
      select: 'name sku price cost stock category',
      model: req.tenantModels?.Product || Product
    });
    
    res.json(packageItem);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'El SKU del paquete ya existe' });
    } else {
      res.status(500).json({ message: 'Error en el servidor' });
    }
  }
});

// @desc    Eliminar paquete
// @route   DELETE /api/packages/:id
// @access  Private (Manager/Admin)
router.delete('/:id', protect, identifyTenant, manager, async (req, res) => {
  try {
    const PackageModel = req.tenantModels?.Package || Package;
    const packageItem = await PackageModel.findById(req.params.id);
    if (!packageItem) {
      return res.status(404).json({ message: 'Paquete no encontrado' });
    }
    
    // Marcar como inactivo en lugar de eliminar
    packageItem.isActive = false;
    await packageItem.save();
    
    res.json({ message: 'Paquete eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Verificar disponibilidad de stock de un paquete
// @route   GET /api/packages/:id/stock-check
// @access  Private
router.get('/:id/stock-check', protect, identifyTenant, async (req, res) => {
  try {
    const PackageModel = req.tenantModels?.Package || Package;
    const packageItem = await PackageModel.findById(req.params.id);
    if (!packageItem) {
      return res.status(404).json({ message: 'Paquete no encontrado' });
    }
    
    const availability = await packageItem.checkStockAvailability();
    res.json(availability);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener estadísticas de paquetes
// @route   GET /api/packages/stats/overview
// @access  Private
router.get('/stats/overview', protect, identifyTenant, async (req, res) => {
  try {
    const PackageModel = req.tenantModels?.Package || Package;
    const stats = await PackageModel.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          totalValue: { $sum: '$finalPrice' },
          avgPrice: { $avg: '$finalPrice' },
          avgProfitMargin: { $avg: '$profitMargin' }
        }
      }
    ]);
    
    const categoryStats = await PackageModel.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalValue: { $sum: '$finalPrice' }
        }
      }
    ]);
    
    res.json({
      overview: stats[0] || { total: 0, totalValue: 0, avgPrice: 0, avgProfitMargin: 0 },
      byCategory: categoryStats
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

export default router;
