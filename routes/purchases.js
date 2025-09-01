import express from 'express';
import { protect, manager } from '../middleware/auth.js';
import Purchase from '../models/Purchase.js';
import Supplier from '../models/Supplier.js';
import Product from '../models/Product.js';
import Batch from '../models/Batch.js';

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
      .populate('items.batch', 'batchNumber expirationDate currentStock')
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
      .populate('items.product', 'name sku category unit stock')
      .populate('items.batch', 'batchNumber expirationDate currentStock notes');

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

    // Validar y procesar lotes
    const itemsToCreate = [];
    const batchesToCreate = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Producto ${item.product} no encontrado`
        });
      }

      if (product.managesBatches) {
        if (item.batchType === 'new') {
          // Crear nuevo lote
          if (!item.batchData || !item.batchData.batchNumber || !item.batchData.expirationDate) {
            return res.status(400).json({
              success: false,
              message: `Para el producto ${product.name} se requiere número de lote y fecha de vencimiento`
            });
          }

          const newBatch = new Batch({
            product: item.product,
            productName: product.name,
            batchNumber: item.batchData.batchNumber,
            expirationDate: item.batchData.expirationDate,
            units: item.batchData.units || item.quantity,
            stock: 0,
            isActive: true
          });

          batchesToCreate.push(newBatch);
          itemsToCreate.push({
            ...item,
            batch: newBatch._id,
            batchType: 'new'
          });
        } else if (item.batchType === 'existing' && item.batch) {
          // Usar lote existente
          const existingBatch = await Batch.findById(item.batch);
          if (!existingBatch) {
            return res.status(400).json({
              success: false,
              message: `Lote ${item.batch} no encontrado`
            });
          }
          itemsToCreate.push(item);
        } else {
          return res.status(400).json({
            success: false,
            message: `Para el producto ${product.name} se debe especificar un lote`
          });
        }
      } else {
        // Producto sin manejo de lotes
        itemsToCreate.push(item);
      }
    }

    // Crear lotes si es necesario
    if (batchesToCreate.length > 0) {
      const createdBatches = await Batch.insertMany(batchesToCreate);
      
      // Actualizar los IDs de los lotes en los items validados
      for (let i = 0; i < itemsToCreate.length; i++) {
        if (itemsToCreate[i].batchType === 'new') {
          const createdBatch = createdBatches.find(b => 
            b.batchNumber === items[i].batchData.batchNumber
          );
          if (createdBatch) {
            itemsToCreate[i].batch = createdBatch._id;
          }
        }
      }
    }

    // Crear la compra
    const purchase = new Purchase({
      supplier,
      supplierName: supplierDoc.name,
      items: itemsToCreate,
      total,
      paymentMethod,
      expectedDelivery,
      category,
      notes,
      status
    });

    await purchase.save();

    // Si la compra está recibida, actualizar stock
    if (purchase.status === 'recibida') {
      for (const item of itemsToCreate) {
        const product = await Product.findById(item.product);
        if (!product) continue;

        // Actualizar stock del producto
        const updatedProduct = await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } },
          { new: true }
        );

        // Si el item tiene un lote asociado, actualizar el stock del lote
        if (item.batch) {
          try {
            const updatedBatch = await Batch.findByIdAndUpdate(
              item.batch,
              { $inc: { stock: item.quantity } },
              { new: true }
            );
          } catch (error) {
            // Error al actualizar stock del lote
          }
        }

        // Si el item tiene datos de lote nuevo, actualizar el stock del lote creado
        if (item.batchType === 'new' && item.batchData) {
          try {
            // Buscar el lote recién creado por número de lote
            const batch = await Batch.findOne({ 
              batchNumber: item.batchData.batchNumber,
              product: item.product 
            });
            
            if (batch) {
              await Batch.findByIdAndUpdate(
                batch._id,
                { 
                  $inc: { stock: item.quantity },
                  $set: { initialStock: item.quantity }
                }
              );
            }
          } catch (error) {
            // Error al actualizar stock del lote nuevo
          }
        }
      }
    }

    res.status(201).json({
      success: true,
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

          // Si el item tiene un lote asociado, actualizar el stock del lote
          if (item.batch) {
            try {
              const updatedBatch = await Batch.findByIdAndUpdate(
                item.batch,
                { $inc: { currentStock: item.quantity } },
                { new: true }
              );
            } catch (error) {
              // No fallar si falla la actualización del lote
            }
          }

          // Si el item tiene datos de lote nuevo, crear el lote
          if (item.batchType === 'new' && item.batchData) {
            try {
              const newBatch = new Batch({
                product: item.product,
                productName: item.productName,
                quantity: item.quantity,
                unit: item.unit,
                batchNumber: item.batchData.batchNumber,
                expirationDate: item.batchData.expirationDate,
                notes: item.batchData.notes || '',
                cost: item.price,
                createdBy: req.user._id,
                currentStock: item.quantity,
                initialStock: item.quantity
              });
              
              await newBatch.save();
            } catch (error) {
              // No fallar si falla la creación del lote
            }
          }
        } catch (error) {
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
        } catch (error) {
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
        

        // Si el item tiene un lote asociado, actualizar el stock del lote
        if (item.batch) {
          try {
            const updatedBatch = await Batch.findByIdAndUpdate(
              item.batch,
              { $inc: { currentStock: item.quantity } },
              { new: true }
            );
          } catch (error) {
            // No fallar la recepción si falla la actualización del lote
          }
        }

        // NOTA: Los lotes nuevos ya se crearon cuando se cambió el estado a "recibida"
        // No es necesario crearlos aquí de nuevo
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
