import express from 'express';
import mongoose from 'mongoose';
import { protect, manager } from '../middleware/auth.js';
import { identifyTenant } from '../middleware/tenant.js';
import Purchase from '../models/Purchase.js';
import Supplier from '../models/Supplier.js';
import Product from '../models/Product.js';
import Batch from '../models/Batch.js';
import Account from '../models/Account.js';

const router = express.Router();

// Middleware combinado para autenticación y tenant
const authenticateWithTenant = async (req, res, next) => {
  try {
    // Primero identificar el tenant
    await identifyTenant(req, res, () => {
      // Luego autenticar al usuario
      protect(req, res, next);
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error interno de autenticación' 
    });
  }
};

// Aplicar middleware combinado a todas las rutas
router.use(authenticateWithTenant);

// @desc    Obtener todas las compras
// @route   GET /api/purchases
// @access  Private
router.get('/', async (req, res) => {
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
    const PurchaseModel = req.tenantModels?.Purchase || Purchase;
    
    
    const purchases = await PurchaseModel.find(filters)
      .populate('supplier', 'name category status')
      .populate('items.product', 'name sku category')
      .populate('items.batch', 'batchNumber expirationDate currentStock')
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Contar total de documentos
    const total = await PurchaseModel.countDocuments(filters);

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
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener las compras',
      error: error.message 
    });
  }
});

// @desc    Obtener pagos contables (egresos)
// @route   GET /api/purchases/account-payments
// @access  Private
router.get('/account-payments', protect, identifyTenant, async (req, res) => {
  try {
    
    const { page = 1, limit = 20, startDate, endDate, category } = req.query;
    
    // Usar el modelo de compras en lugar de transacciones bancarias
    const PurchaseModel = req.tenantModels?.Purchase || (await import('../models/Purchase.js')).default;
    
    // Construir filtros para pagos contables
    const filters = {
      isActive: true,
      isAccountPayment: true
    };
    
    if (startDate || endDate) {
      filters.orderDate = {};
      if (startDate) filters.orderDate.$gte = new Date(startDate);
      if (endDate) filters.orderDate.$lte = new Date(endDate);
    }
    
    if (category) {
      filters.category = category;
    }
    
    
    // Obtener pagos contables con paginación
    const accountPayments = await PurchaseModel.find(filters)
      .populate('bankAccount', 'name accountNumber')
      .populate('createdBy', 'name email')
      .sort({ orderDate: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();
    
    
    // Contar total
    const total = await PurchaseModel.countDocuments(filters);
    
    // Calcular estadísticas
    const stats = await PurchaseModel.aggregate([
      { $match: filters },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$total' },
          totalCount: { $sum: 1 },
          avgAmount: { $avg: '$total' }
        }
      }
    ]);
    
    
    res.json({
      success: true,
      data: accountPayments,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      },
      stats: stats[0] || { totalAmount: 0, totalCount: 0, avgAmount: 0 }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener pagos contables',
      error: error.message
    });
  }
});

// @desc    Obtener compra por ID
// @route   GET /api/purchases/:id
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const PurchaseModel = req.tenantModels?.Purchase || Purchase;
    const purchase = await PurchaseModel.findById(req.params.id)
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
      total,
      paymentMethod,
      expectedDelivery,
      category,
      notes,
      status = 'pendiente' // Permitir establecer estado al crear
    } = req.body;

    // Validar que el proveedor existe
    const SupplierModel = req.tenantModels?.Supplier || Supplier;
    const supplierDoc = await SupplierModel.findById(supplier);
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

    // Validar y procesar items (productos y cuentas contables)
    const itemsToCreate = [];
    const batchesToCreate = [];

    const ProductModel = req.tenantModels?.Product || Product;
    const AccountModel = req.tenantModels?.Account || Account;
    
    for (const item of items) {
      // Determinar el tipo de item
      const itemType = item.itemType || 'product';
      
      if (itemType === 'product') {
        // Validar producto
        const product = await ProductModel.findById(item.product);
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

          const BatchModel = req.tenantModels?.Batch || Batch;
          const newBatch = new BatchModel({
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
          const BatchModel = req.tenantModels?.Batch || Batch;
          const existingBatch = await BatchModel.findById(item.batch);
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
        itemsToCreate.push({
          ...item,
          itemType: 'product'
        });
      }
    } else if (itemType === 'account') {
        // Validar cuenta contable
        const account = await AccountModel.findById(item.product); // El ID viene en el campo product
        if (!account) {
          return res.status(400).json({
            success: false,
            message: `Cuenta contable ${item.product} no encontrada`
          });
        }
        
        // Crear item de cuenta contable
        itemsToCreate.push({
          ...item,
          itemType: 'account',
          accountId: item.product,
          accountCode: account.code,
          accountName: account.name,
          accountType: account.type,
          product: null, // No es un producto
          productName: account.name
        });
      } else {
        return res.status(400).json({
          success: false,
          message: `Tipo de item inválido: ${itemType}. Debe ser 'product' o 'account'`
        });
      }
    }

    // Crear lotes si es necesario
    if (batchesToCreate.length > 0) {
      const BatchModel = req.tenantModels?.Batch || Batch;
      const createdBatches = await BatchModel.insertMany(batchesToCreate);
      
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

    // Calcular total y agregar información a cada item
    for (let i = 0; i < itemsToCreate.length; i++) {
      const item = itemsToCreate[i];
      
      if (item.itemType === 'product') {
        const product = await ProductModel.findById(item.product);
        if (product) {
          item.productName = product.name;
          item.total = item.quantity * item.price;
          
          // Asegurar que el campo unit esté presente
          if (!item.unit) {
            item.unit = 'unidad'; // valor por defecto
          }
        } else {
        }
      } else if (item.itemType === 'account') {
        // Para cuentas contables, el total ya está calculado
        item.total = item.quantity * item.price;
                
        // Asegurar que el campo unit esté presente
        if (!item.unit) {
          item.unit = 'unidad'; // valor por defecto
        }
      }
    }


    // Validar que todos los items tengan los campos requeridos
    for (let i = 0; i < itemsToCreate.length; i++) {
      const item = itemsToCreate[i];
      if (!item.productName) {
        return res.status(400).json({
          success: false,
          message: `El nombre del producto es requerido para el item ${i + 1}`
        });
      }
      if (!item.total || item.total <= 0) {
        return res.status(400).json({
          success: false,
          message: `El total es requerido y debe ser mayor a 0 para el item ${i + 1}`
        });
      }
      if (!item.unit) {
        return res.status(400).json({
          success: false,
          message: `La unidad de medida es requerida para el item ${i + 1}`
        });
      }
    }

    // Crear la compra
    const PurchaseModel = req.tenantModels?.Purchase || Purchase;
    const purchase = new PurchaseModel({
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

    // Si la compra está recibida, actualizar stock y costo (solo para productos)
    if (purchase.status === 'recibida') {
      const stockUpdates = [];
      
      for (const item of itemsToCreate) {
        // Solo procesar productos, no cuentas contables
        if (item.itemType !== 'product' || !item.product) continue;
        
        const product = await ProductModel.findById(item.product);
        if (!product) continue;

        // Calcular costo promedio si hay stock existente
        let newCost = item.price || 0; // Usar el campo 'price' del item de compra
        
        if (product.stock > 0 && product.cost && product.cost > 0) {
          // Fórmula: (costo_actual * stock_actual + costo_nuevo * cantidad_nueva) / (stock_actual + cantidad_nueva)
          const totalCurrentValue = product.cost * product.stock;
          const totalNewValue = newCost * item.quantity;
          const totalStock = product.stock + item.quantity;
          newCost = (totalCurrentValue + totalNewValue) / totalStock;
        } 
        else {
        }
        
        const updatedProduct = await ProductModel.findByIdAndUpdate(
          item.product,
          { 
            $inc: { stock: item.quantity },
            $set: { cost: newCost }
          },
          { new: true }
        );

        stockUpdates.push({
          productId: item.product,
          productName: item.productName,
          quantity: item.quantity,
          oldStock: updatedProduct.stock - item.quantity,
          newStock: updatedProduct.stock,
          oldCost: product.cost,
          newCost: newCost,
          costChange: newCost - (product.cost || 0)
        });

        // Si el item tiene un lote asociado, actualizar el stock del lote
        if (item.batch) {
          try {
            const BatchModel = req.tenantModels?.Batch || Batch;
            const updatedBatch = await BatchModel.findByIdAndUpdate(
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
            const BatchModel = req.tenantModels?.Batch || Batch;
            const batch = await BatchModel.findOne({ 
              batchNumber: item.batchData.batchNumber,
              product: item.product 
            });
            
            if (batch) {
              await BatchModel.findByIdAndUpdate(
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
      message: purchase.status === 'recibida' ? 'Compra creada y stock/costos actualizados' : 'Compra creada exitosamente',
      data: purchase,
      ...(purchase.status === 'recibida' && { stockUpdates })
    });
  } catch (error) {
    
    // Si es un error de autenticación, devolver 401 específico
    if (error.message && error.message.includes('Usuario no encontrado')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Si es un error de tenant, devolver 400 específico
    if (error.message && error.message.includes('tenant')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Error de configuración de tenant',
        code: 'TENANT_ERROR'
      });
    }
    
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

    const PurchaseModel = req.tenantModels?.Purchase || Purchase;
    const purchase = await PurchaseModel.findById(req.params.id);
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
      const SupplierModel = req.tenantModels?.Supplier || Supplier;
      const supplierDoc = await SupplierModel.findById(supplier);
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

      const ProductModel = req.tenantModels?.Product || Product;
      for (const item of items) {
        const product = await ProductModel.findById(item.product);
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

    const PurchaseModel = req.tenantModels?.Purchase || Purchase;
    const purchase = await PurchaseModel.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
    }

    // Si se está cambiando a "recibida" y antes no lo estaba, actualizar stock y costo
    if (status === 'recibida' && purchase.status !== 'recibida') {
      const stockUpdates = [];
      
      // Actualizar stock y costo de todos los productos en la compra
      for (const item of purchase.items) {
        try {
          // Obtener el producto actual para calcular costo promedio
          const ProductModel = req.tenantModels?.Product || Product;
          const currentProduct = await ProductModel.findById(item.product);
          if (!currentProduct) {
            continue;
          }

          // Calcular costo promedio si hay stock existente
          let newCost = item.price || 0; // Usar el campo 'price' del item de compra
          
          if (currentProduct.stock > 0 && currentProduct.cost && currentProduct.cost > 0) {
            // Fórmula: (costo_actual * stock_actual + costo_nuevo * cantidad_nueva) / (stock_actual + cantidad_nueva)
            const totalCurrentValue = currentProduct.cost * currentProduct.stock;
            const totalNewValue = newCost * item.quantity;
            const totalStock = currentProduct.stock + item.quantity;
            newCost = (totalCurrentValue + totalNewValue) / totalStock;
          } else {
          }
          
          const updatedProduct = await ProductModel.findByIdAndUpdate(
            item.product,
            { 
              $inc: { stock: item.quantity },
              $set: { cost: newCost }
            },
            { new: true }
          );
          
          stockUpdates.push({
            productId: item.product,
            productName: item.productName,
            quantity: item.quantity,
            oldStock: updatedProduct.stock - item.quantity,
            newStock: updatedProduct.stock,
            oldCost: currentProduct.cost,
            newCost: newCost,
            costChange: newCost - (currentProduct.cost || 0)
          });

          // Si el item tiene un lote asociado, actualizar el stock del lote
          if (item.batch) {
            try {
              const BatchModel = req.tenantModels?.Batch || Batch;
              const updatedBatch = await BatchModel.findByIdAndUpdate(
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
              const BatchModel = req.tenantModels?.Batch || Batch;
              const newBatch = new BatchModel({
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
      const ProductModel = req.tenantModels?.Product || Product;
      for (const item of purchase.items) {
        try {
          await ProductModel.findByIdAndUpdate(
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
      message: status === 'recibida' && purchase.status !== 'recibida' 
        ? 'Estado de compra actualizado y stock/costos actualizados' 
        : 'Estado de compra actualizado exitosamente',
      data: purchase,
      ...(status === 'recibida' && purchase.status !== 'recibida' && { stockUpdates })
    });
  } catch (error) {
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
    const PurchaseModel = req.tenantModels?.Purchase || Purchase;
    const purchase = await PurchaseModel.findById(req.params.id);
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
    const PurchaseModel = req.tenantModels?.Purchase || Purchase;
    const stats = await PurchaseModel.getStats();
    
    // Obtener compras recientes
    const recentPurchases = await PurchaseModel.find({ isActive: true })
      .populate('supplier', 'name')
      .sort({ orderDate: -1 })
      .limit(5);

    // Obtener compras por categoría
    const categoryStats = await PurchaseModel.aggregate([
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
    const PurchaseModel = req.tenantModels?.Purchase || Purchase;
    const purchases = await PurchaseModel.findBySupplier(req.params.supplierId)
      .populate('items.product', 'name sku category');

    res.json({
      success: true,
      data: purchases
    });
  } catch (error) {
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
    const PurchaseModel = req.tenantModels?.Purchase || Purchase;
    const purchase = await PurchaseModel.findById(req.params.id);
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

    // Actualizar stock y costo de todos los productos
    const stockUpdates = [];
    const ProductModel = req.tenantModels?.Product || Product;
    for (const item of purchase.items) {
      try {
        // Obtener el producto actual para calcular costo promedio
        const currentProduct = await ProductModel.findById(item.product);
        if (!currentProduct) {
          throw new Error(`Producto ${item.product} no encontrado`);
        }

        // Calcular costo promedio si hay stock existente
        let newCost = item.price || 0; // Usar el campo 'price' del item de compra
        
        if (currentProduct.stock > 0 && currentProduct.cost > 0) {
          // Fórmula: (costo_actual * stock_actual + costo_nuevo * cantidad_nueva) / (stock_actual + cantidad_nueva)
          const totalCurrentValue = currentProduct.cost * currentProduct.stock;
          const totalNewValue = newCost * item.quantity;
          const totalStock = currentProduct.stock + item.quantity;
          newCost = (totalCurrentValue + totalNewValue) / totalStock;
        } else {
        }

        // Actualizar stock y costo del producto
        const updatedProduct = await ProductModel.findByIdAndUpdate(
          item.product,
          { 
            $inc: { stock: item.quantity },
            $set: { cost: newCost }
          },
          { new: true }
        );
        
        stockUpdates.push({
          productId: item.product,
          productName: item.productName,
          quantity: item.quantity,
          oldStock: updatedProduct.stock - item.quantity,
          newStock: updatedProduct.stock,
          oldCost: currentProduct.cost,
          newCost: newCost,
          costChange: newCost - (currentProduct.cost || 0)
        });
        

        // Si el item tiene un lote asociado, actualizar el stock del lote
        if (item.batch) {
          try {
            const BatchModel = req.tenantModels?.Batch || Batch;
            const updatedBatch = await BatchModel.findByIdAndUpdate(
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
      message: 'Compra recibida exitosamente, stock y costos actualizados',
      data: {
        purchase,
        stockUpdates
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error al recibir la compra',
      error: error.message 
    });
  }
});

// @desc    Agregar pago parcial a una compra
// @route   POST /api/purchases/:id/payments
// @access  Private
router.post('/:id/payments', protect, async (req, res) => {
  try {
    
    // Validar que el ID sea un ObjectId válido
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de compra inválido'
      });
    }
    
    const { amount, paymentMethod, bankAccount, notes } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El monto del pago debe ser mayor a 0'
      });
    }
    
    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'El método de pago es requerido'
      });
    }
    
    const PurchaseModel = req.tenantModels?.Purchase || Purchase;
    const purchase = await PurchaseModel.findById(req.params.id);

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
    }
    
    // Verificar que el pago no exceda el monto restante
    const currentPaidAmount = purchase.paidAmount || 0;
    const remainingAmount = purchase.total - currentPaidAmount;
    
    if (amount > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: `El monto del pago (${amount}) excede el monto restante (${remainingAmount})`
      });
    }
    
    // Crear el pago parcial
    const payment = {
      amount,
      paymentMethod,
      bankAccount: bankAccount || null,
      notes: notes || '',
      createdBy: req.user.id
    };
    
    purchase.partialPayments.push(payment);
    
    // Si es el primer pago, establecer el método de pago principal
    if (purchase.partialPayments.length === 1) {
      purchase.paymentMethod = paymentMethod;
      purchase.bankAccount = bankAccount || null;
    }
    
    await purchase.save();
    
    // Crear transacción bancaria si se especificó una cuenta bancaria
    
    if (bankAccount && paymentMethod !== 'Efectivo') {
      try {
        const BankTransactionModel = req.tenantModels?.BankTransaction || (await import('../models/BankTransaction.js')).default;
        const BankModel = req.tenantModels?.Bank || (await import('../models/Bank.js')).default;
        
        const bank = await BankModel.findById(bankAccount);
        if (bank) {
          
          const previousBalance = bank.currentBalance;
          const newBalance = previousBalance - amount; // Para compras, restamos del saldo
          
          const bankTransaction = await BankTransactionModel.create({
            bank: bankAccount,
            type: 'withdrawal',
            amount,
            previousBalance,
            newBalance,
            description: `Pago parcial compra ${purchase.purchaseNumber}`,
            reference: purchase._id.toString(),
            referenceType: 'purchase',
            createdBy: req.user.id,
            tenant: req.tenant?._id
          });
          
          
          // Actualizar saldo de la cuenta bancaria
          bank.currentBalance = newBalance;
          await bank.save();
        } else {
        }
      } catch (bankError) {
        // No fallar la operación por error en transacción bancaria
      }
    } else {
    }
    
    // Poblar la compra actualizada
    const updatedPurchase = await PurchaseModel.findById(req.params.id)
      .populate('supplier', 'name email phone')
      .populate('items.product', 'name sku')
      .populate('items.batch', 'batchNumber expirationDate')
      .populate('partialPayments.bankAccount', 'name accountNumber')
      .populate('partialPayments.createdBy', 'name email')
      .populate('bankAccount', 'name accountNumber');
    
    res.json({
      success: true,
      message: 'Pago parcial agregado exitosamente',
      data: updatedPurchase
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      message: 'Error al agregar pago parcial',
      error: error.message
    });
  }
});

// @desc    Obtener pagos parciales de una compra
// @route   GET /api/purchases/:id/payments
// @access  Private
router.get('/:id/payments', protect, async (req, res) => {
  try {
    const PurchaseModel = req.tenantModels?.Purchase || Purchase;
    const purchase = await PurchaseModel.findById(req.params.id)
      .populate('partialPayments.bankAccount', 'name accountNumber')
      .populate('partialPayments.createdBy', 'name email')
      .select('partialPayments paidAmount remainingAmount paymentStatus total');
    
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
    }
    
    res.json({
      success: true,
      data: {
        payments: purchase.partialPayments,
        paidAmount: purchase.paidAmount,
        remainingAmount: purchase.remainingAmount,
        paymentStatus: purchase.paymentStatus,
        total: purchase.total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener pagos parciales',
      error: error.message
    });
  }
});

// @desc    Registrar pago con imputación contable
// @route   POST /api/purchases/account-payment
// @access  Private
router.post('/account-payment', protect, identifyTenant, async (req, res) => {
  try {
    const { 
      amount, 
      paymentMethod, 
      bankAccount, 
      accountId, 
      category,
      description, 
      paymentDate, 
      reference,
      supplierId,
      supplierName
    } = req.body;


    // Validaciones
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El monto es requerido y debe ser mayor a 0'
      });
    }

    if (!accountId) {
      return res.status(400).json({
        success: false,
        message: 'La cuenta contable es requerida'
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'La categoría de gasto es requerida'
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: 'La descripción es requerida'
      });
    }

    if (!bankAccount) {
      return res.status(400).json({
        success: false,
        message: 'La cuenta bancaria es requerida'
      });
    }

    // Verificar que la cuenta contable existe
    const AccountModel = req.tenantModels?.Account || (await import('../models/Account.js')).default;
    const account = await AccountModel.findOne({
      _id: accountId,
      tenant: req.tenant?._id,
      isActive: true
    });

    if (!account) {
      return res.status(400).json({
        success: false,
        message: 'La cuenta contable seleccionada no existe o no está activa'
      });
    }

    // Verificar cuenta bancaria (siempre requerida)
    const BankModel = req.tenantModels?.Bank || (await import('../models/Bank.js')).default;
    const bank = await BankModel.findOne({
      _id: bankAccount
    });

    if (!bank) {
      return res.status(400).json({
        success: false,
        message: 'La cuenta bancaria seleccionada no existe'
      });
    }


    // Crear transacción bancaria (siempre requerida)
    {
      try {
        const BankTransactionModel = req.tenantModels?.BankTransaction || (await import('../models/BankTransaction.js')).default;
        const BankModel = req.tenantModels?.Bank || (await import('../models/Bank.js')).default;
        
        const bank = await BankModel.findById(bankAccount);
        if (bank) {
          const previousBalance = bank.currentBalance;
          const newBalance = previousBalance - amount; // Para gastos, restamos del saldo
          
          // Verificar que hay saldo suficiente
          if (amount > previousBalance) {
            return res.status(400).json({
              success: false,
              message: 'El monto excede el saldo disponible en la cuenta bancaria'
            });
          }
          
          const bankTransaction = await BankTransactionModel.create({
            bank: bankAccount,
            type: 'withdrawal',
            amount,
            previousBalance,
            newBalance,
            description: `Pago ${category} (${paymentMethod}): ${description}`,
            reference: reference || null,
            referenceType: 'account_payment',
            createdBy: req.user.id,
            tenant: req.tenant?._id
          });
          
          
          // Actualizar saldo de la cuenta bancaria
          bank.currentBalance = newBalance;
          await bank.save();
        }
      } catch (bankError) {
        return res.status(500).json({
          success: false,
          message: 'Error al procesar la transacción bancaria',
          error: bankError.message
        });
      }
    }

    // Crear registro de pago con cuenta contable
    const accountPayment = {
      amount,
      paymentMethod,
      bankAccount: bankAccount || null,
      accountId,
      accountCode: account.code,
      accountName: account.name,
      accountType: account.type,
      category,
      description: description.trim(),
      paymentDate: new Date(paymentDate),
      reference: reference?.trim() || null,
      createdBy: req.user.id,
      tenant: req.tenant?._id,
      type: 'account_payment'
    };

    // Guardar como una transacción bancaria especial
    const BankTransactionModel = req.tenantModels?.BankTransaction || (await import('../models/BankTransaction.js')).default;
    
    const accountTransaction = await BankTransactionModel.create({
      bank: bankAccount || null,
      type: 'account_payment',
      amount,
      previousBalance: bankAccount ? (await BankModel.findById(bankAccount)).currentBalance : 0,
      newBalance: bankAccount ? (await BankModel.findById(bankAccount)).currentBalance : 0,
      description: `Pago ${category}: ${description}`,
      reference: reference || null,
      referenceType: 'account_payment',
      createdBy: req.user.id,
      tenant: req.tenant?._id,
      accountId,
      accountCode: account.code,
      accountName: account.name,
      accountType: account.type,
      category,
      paymentDate: new Date(paymentDate)
    });

    // Crear también un registro de compra para mostrar en la tabla
    const PurchaseModel = req.tenantModels?.Purchase || (await import('../models/Purchase.js')).default;
    
    // Generar número de compra único para pagos contables
    const purchaseCount = await PurchaseModel.countDocuments({ 
      purchaseNumber: { $regex: /^PC-/ }
    });
    const purchaseNumber = `PC-${String(purchaseCount + 1).padStart(4, '0')}`;
    
    
    const purchaseData = {
      purchaseNumber,
      supplier: supplierId || null, // Proveedor opcional
      supplierName: supplierName || 'Pago Contable',
      category: category,
      orderDate: new Date(paymentDate),
      expectedDelivery: new Date(paymentDate),
      status: 'recibida', // Los pagos contables se consideran recibidos inmediatamente
      paymentStatus: 'pagado', // Ya están pagados
      total: amount,
      paidAmount: amount,
      remainingAmount: 0,
      items: [{
        product: null,
        productName: `Pago ${category}`,
        quantity: 1,
        unitPrice: amount,
        total: amount,
        description: description.trim()
      }],
      notes: `Pago contable - Cuenta: ${account.code} - ${account.name}`,
      createdBy: req.user.id,
      tenant: req.tenant?._id,
      isActive: true, // Asegurar que esté activo
      isAccountPayment: true, // Marcar como pago contable
      accountPaymentId: accountTransaction._id,
      accountId,
      accountCode: account.code,
      accountName: account.name,
      accountType: account.type,
      paymentMethod,
      bankAccount: bankAccount || null,
      reference: reference?.trim() || null
    };

    const purchase = await PurchaseModel.create(purchaseData);

    res.status(201).json({
      success: true,
      message: 'Pago con cuenta contable registrado exitosamente',
      data: {
        id: accountTransaction._id,
        amount,
        paymentMethod,
        accountId,
        accountCode: account.code,
        accountName: account.name,
        category,
        description: description.trim(),
        paymentDate: new Date(paymentDate),
        reference: reference?.trim() || null
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al registrar pago con cuenta contable',
      error: error.message
    });
  }
});

// @desc    Eliminar pago parcial de una compra
// @route   DELETE /api/purchases/:id/payments/:paymentId
// @access  Private
router.delete('/:id/payments/:paymentId', protect, async (req, res) => {
  try {
    const PurchaseModel = req.tenantModels?.Purchase || Purchase;
    const purchase = await PurchaseModel.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
    }
    
    const paymentIndex = purchase.partialPayments.findIndex(
      payment => payment._id.toString() === req.params.paymentId
    );
    
    if (paymentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Pago no encontrado'
      });
    }
    
    const payment = purchase.partialPayments[paymentIndex];
    
    // Crear transacción bancaria de reversión si era un pago bancario
    if (payment.bankAccount && payment.paymentMethod !== 'Efectivo') {
      try {
        const BankTransactionModel = req.tenantModels?.BankTransaction || (await import('../models/BankTransaction.js')).default;
        const BankModel = req.tenantModels?.Bank || (await import('../models/Bank.js')).default;
        
        const bank = await BankModel.findById(payment.bankAccount);
        if (bank) {
          const previousBalance = bank.currentBalance;
          const newBalance = previousBalance + payment.amount; // Revertir el pago
          
          await BankTransactionModel.create({
            bank: payment.bankAccount,
            type: 'deposit',
            amount: payment.amount,
            previousBalance,
            newBalance,
            description: `Reversión pago compra ${purchase.purchaseNumber}`,
            reference: purchase._id.toString(),
            referenceType: 'purchase',
            createdBy: req.user.id,
            tenant: req.tenant?._id
          });
          
          // Actualizar saldo de la cuenta bancaria
          bank.currentBalance = newBalance;
          await bank.save();
        }
      } catch (bankError) {
        // No fallar la operación por error en transacción bancaria
      }
    }
    
    // Eliminar el pago
    purchase.partialPayments.splice(paymentIndex, 1);
    await purchase.save();
    
    // Poblar la compra actualizada
    const updatedPurchase = await PurchaseModel.findById(req.params.id)
      .populate('supplier', 'name email phone')
      .populate('items.product', 'name sku')
      .populate('items.batch', 'batchNumber expirationDate')
      .populate('partialPayments.bankAccount', 'name accountNumber')
      .populate('partialPayments.createdBy', 'name email')
      .populate('bankAccount', 'name accountNumber');
    
    res.json({
      success: true,
      message: 'Pago eliminado exitosamente',
      data: updatedPurchase
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al eliminar pago parcial',
      error: error.message
    });
  }
});

export default router;
