import express from 'express';
import { protect, manager } from '../middleware/auth.js';
import Purchase from '../models/Purchase.js';
import Supplier from '../models/Supplier.js';
import Product from '../models/Product.js';

const router = express.Router();

// @desc    Obtener todas las compras
// @route   GET /api/purchases
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      category, 
      supplier, 
      search,
      startDate,
      endDate 
    } = req.query;

    // Construir filtros
    const filters = { isActive: true };
    
    if (status && status !== 'todos') {
      filters.status = status;
    }
    
    if (category && category !== 'todos') {
      filters.category = category;
    }
    
    if (supplier && supplier !== 'todos') {
      filters.supplier = supplier;
    }
    
    if (search) {
      filters.$or = [
        { purchaseNumber: { $regex: search, $options: 'i' } },
        { supplierName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (startDate && endDate) {
      filters.orderDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Calcular paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Ejecutar consulta con populate
    const purchases = await Purchase.find(filters)
      .populate('supplier', 'name category status')
      .populate('items.product', 'name sku category')
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Contar total de documentos
    const total = await Purchase.countDocuments(filters);

    res.json({
      success: true,
      data: purchases,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error al obtener compras:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener las compras',
      error: error.message 
    });
  }
});

// @desc    Obtener compra por ID
// @route   GET /api/purchases/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate('supplier', 'name category status contactName contactPhone')
      .populate('items.product', 'name sku category unit stock');

    if (!purchase) {
      return res.status(404).json({ 
        success: false, 
        message: 'Compra no encontrada' 
      });
    }

    res.json({
      success: true,
      data: purchase
    });
  } catch (error) {
    console.error('Error al obtener compra:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener la compra',
      error: error.message 
    });
  }
});

// @desc    Crear nueva compra
// @route   POST /api/purchases
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const {
      supplier,
      items,
      paymentMethod,
      expectedDelivery,
      category,
      notes,
      status = 'pendiente' // Permitir establecer estado al crear
    } = req.body;

    // Validar que el proveedor existe
    const supplierDoc = await Supplier.findById(supplier);
    if (!supplierDoc) {
      return res.status(400).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    // Validar items
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'La compra debe tener al menos un item'
      });
    }

    // Validar y calcular totales de items
    let total = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Producto ${item.productName || item.product} no encontrado`
        });
      }

      const itemTotal = item.quantity * item.price;
      total += itemTotal;

      validatedItems.push({
        product: item.product,
        productName: product.name,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
        total: itemTotal
      });
    }

    // Crear la compra
    const purchase = new Purchase({
      supplier,
      supplierName: supplierDoc.name,
      items: validatedItems,
      total,
      paymentMethod,
      expectedDelivery,
      category,
      notes,
      status
    });

    await purchase.save();

    // Si se marca como recibida al crear, actualizar stock inmediatamente
    if (status === 'recibida') {
      purchase.actualDelivery = new Date();
      
      // Actualizar stock de todos los productos
      for (const item of validatedItems) {
        try {
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { stock: item.quantity } },
            { new: true }
          );
          console.log(`Stock actualizado para producto ${item.product}: +${item.quantity}`);
        } catch (error) {
          console.error(`Error al actualizar stock del producto ${item.product}:`, error);
        }
      }
      
      await purchase.save();
    }

    // Actualizar estadísticas del proveedor
    await supplierDoc.updateStats(total);

    res.status(201).json({
      success: true,
      message: 'Compra creada exitosamente',
      data: purchase
    });
  } catch (error) {
    console.error('Error al crear compra:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al crear la compra',
      error: error.message 
    });
  }
});

// @desc    Actualizar compra
// @route   PUT /api/purchases/:id
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const {
      supplier,
      items,
      status,
      paymentMethod,
      expectedDelivery,
      actualDelivery,
      category,
      notes
    } = req.body;

    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
    }

    // Validar que no se pueda editar una compra cancelada
    if (purchase.status === 'cancelada') {
      return res.status(400).json({
        success: false,
        message: 'No se puede editar una compra cancelada'
      });
    }

    // Si se cambia el proveedor, validar que existe
    if (supplier && supplier !== purchase.supplier.toString()) {
      const supplierDoc = await Supplier.findById(supplier);
      if (!supplierDoc) {
        return res.status(400).json({
          success: false,
          message: 'Proveedor no encontrado'
        });
      }
      purchase.supplierName = supplierDoc.name;
    }

    // Actualizar items si se proporcionan
    if (items && items.length > 0) {
      let total = 0;
      const validatedItems = [];

      for (const item of items) {
        const product = await Product.findById(item.product);
        if (!product) {
          return res.status(400).json({
            success: false,
            message: `Producto ${item.productName || item.product} no encontrado`
          });
        }

        const itemTotal = item.quantity * item.price;
        total += itemTotal;

        validatedItems.push({
          product: item.product,
          productName: product.name,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
          total: itemTotal
        });
      }

      purchase.items = validatedItems;
      purchase.total = total;
    }

    // Actualizar otros campos
    if (supplier) purchase.supplier = supplier;
    if (status) purchase.status = status;
    if (paymentMethod) purchase.paymentMethod = paymentMethod;
    if (expectedDelivery) purchase.expectedDelivery = expectedDelivery;
    if (actualDelivery) purchase.actualDelivery = actualDelivery;
    if (category) purchase.category = category;
    if (notes !== undefined) purchase.notes = notes;

    await purchase.save();

    res.json({
      success: true,
      message: 'Compra actualizada exitosamente',
      data: purchase
    });
  } catch (error) {
    console.error('Error al actualizar compra:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al actualizar la compra',
      error: error.message 
    });
  }
});

// @desc    Cambiar estado de compra
// @route   PATCH /api/purchases/:id/status
// @access  Private
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['pendiente', 'en_transito', 'recibida', 'cancelada'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Estado inválido'
      });
    }

    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
    }

    // Si se está cambiando a "recibida" y antes no lo estaba, actualizar stock
    if (status === 'recibida' && purchase.status !== 'recibida') {
      // Actualizar stock de todos los productos en la compra
      for (const item of purchase.items) {
        try {
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { stock: item.quantity } },
            { new: true }
          );
          console.log(`Stock actualizado para producto ${item.product}: +${item.quantity}`);
        } catch (error) {
          console.error(`Error al actualizar stock del producto ${item.product}:`, error);
          // Continuar con otros productos aunque falle uno
        }
      }
    }

    // Si se está cambiando de "recibida" a otro estado, revertir el stock
    if (purchase.status === 'recibida' && status !== 'recibida') {
      // Revertir stock de todos los productos en la compra
      for (const item of purchase.items) {
        try {
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { stock: -item.quantity } },
            { new: true }
          );
          console.log(`Stock revertido para producto ${item.product}: -${item.quantity}`);
        } catch (error) {
          console.error(`Error al revertir stock del producto ${item.product}:`, error);
          // Continuar con otros productos aunque falle uno
        }
      }
    }

    purchase.status = status;
    
    // Si se marca como recibida, establecer fecha de entrega actual
    if (status === 'recibida') {
      purchase.actualDelivery = new Date();
    }

    await purchase.save();

    res.json({
      success: true,
      message: 'Estado de compra actualizado exitosamente',
      data: purchase
    });
  } catch (error) {
    console.error('Error al cambiar estado de compra:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al cambiar el estado de la compra',
      error: error.message 
    });
  }
});

// @desc    Eliminar compra (soft delete)
// @route   DELETE /api/purchases/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
    }

    // Solo permitir eliminar compras pendientes
    if (purchase.status !== 'pendiente') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden eliminar compras pendientes'
      });
    }

    purchase.isActive = false;
    await purchase.save();

    res.json({
      success: true,
      message: 'Compra eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar compra:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar la compra',
      error: error.message 
    });
  }
});

// @desc    Resumen de compras
// @route   GET /api/purchases/stats/overview
// @access  Private
router.get('/stats/overview', protect, async (req, res) => {
  try {
    const stats = await Purchase.getStats();
    
    // Obtener compras recientes
    const recentPurchases = await Purchase.find({ isActive: true })
      .populate('supplier', 'name')
      .sort({ orderDate: -1 })
      .limit(5);

    // Obtener compras por categoría
    const categoryStats = await Purchase.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          total: { $sum: '$total' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats,
        recentPurchases,
        categoryStats
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de compras:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener estadísticas',
      error: error.message 
    });
  }
});

// @desc    Obtener compras por proveedor
// @route   GET /api/purchases/supplier/:supplierId
// @access  Private
router.get('/supplier/:supplierId', protect, async (req, res) => {
  try {
    const purchases = await Purchase.findBySupplier(req.params.supplierId)
      .populate('items.product', 'name sku category');

    res.json({
      success: true,
      data: purchases
    });
  } catch (error) {
    console.error('Error al obtener compras por proveedor:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener compras del proveedor',
      error: error.message 
    });
  }
});

// @desc    Recibir compra y actualizar stock
// @route   POST /api/purchases/:id/receive
// @access  Private
router.post('/:id/receive', protect, async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
    }

    // Verificar que la compra no esté ya recibida
    if (purchase.status === 'recibida') {
      return res.status(400).json({
        success: false,
        message: 'La compra ya está marcada como recibida'
      });
    }

    // Verificar que la compra no esté cancelada
    if (purchase.status === 'cancelada') {
      return res.status(400).json({
        success: false,
        message: 'No se puede recibir una compra cancelada'
      });
    }

    // Actualizar stock de todos los productos
    const stockUpdates = [];
    for (const item of purchase.items) {
      try {
        const updatedProduct = await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } },
          { new: true }
        );
        
        stockUpdates.push({
          productId: item.product,
          productName: item.productName,
          quantity: item.quantity,
          oldStock: updatedProduct.stock - item.quantity,
          newStock: updatedProduct.stock
        });
        
        console.log(`Stock actualizado para ${item.productName}: ${updatedProduct.stock - item.quantity} → ${updatedProduct.stock}`);
      } catch (error) {
        console.error(`Error al actualizar stock del producto ${item.product}:`, error);
        return res.status(500).json({
          success: false,
          message: `Error al actualizar stock del producto ${item.productName}`,
          error: error.message
        });
      }
    }

    // Marcar compra como recibida
    purchase.status = 'recibida';
    purchase.actualDelivery = new Date();
    await purchase.save();

    res.json({
      success: true,
      message: 'Compra recibida exitosamente y stock actualizado',
      data: {
        purchase,
        stockUpdates
      }
    });
  } catch (error) {
    console.error('Error al recibir compra:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al recibir la compra',
      error: error.message 
    });
  }
});

export default router;
