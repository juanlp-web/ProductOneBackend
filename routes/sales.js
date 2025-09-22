import express from 'express';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import Batch from '../models/Batch.js';
import Package from '../models/Package.js';
import Config from '../models/Config.js';
import Bank from '../models/Bank.js';
import BankTransaction from '../models/BankTransaction.js';
import { protect, manager } from '../middleware/auth.js';
import { identifyTenant } from '../middleware/tenant.js';

const router = express.Router();

// @desc    Obtener paquetes disponibles para ventas
// @route   GET /api/sales/available-packages
// @access  Private
router.get('/available-packages', protect, identifyTenant, async (req, res) => {
  try {
    
    const PackageModel = req.tenantModels?.Package || Package;
    const packages = await PackageModel.find({ isActive: true })
      .populate({
        path: 'items.product',
        select: 'name sku price cost stock category',
        model: req.tenantModels?.Product || Product
      })
      .select('name sku category items sellingPrice discount finalPrice profitMargin')
      .lean();

    // Verificar disponibilidad de stock para cada paquete
    const availablePackages = [];
    
    for (const packageItem of packages) {
      // Verificar stock manualmente ya que usamos .lean()
      let stockAvailable = true;
      const unavailableItems = [];
      
      for (const item of packageItem.items) {
        if (item.product && item.product.stock < item.quantity) {
          stockAvailable = false;
          unavailableItems.push({
            product: item.product.name,
            required: item.quantity,
            available: item.product.stock
          });
        }
      }
      
      availablePackages.push({
        ...packageItem,
        stockAvailable,
        unavailableItems: stockAvailable ? [] : unavailableItems
      });
    }

    res.json(availablePackages);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener todas las ventas
// @route   GET /api/sales
// @access  Private
router.get('/', protect, identifyTenant, async (req, res) => {
  try {
    const SaleModel = req.tenantModels?.Sale || Sale;
    const { page = 1, limit = 10, startDate, endDate, paymentStatus, client } = req.query;
    
    const query = { isActive: true };
    
    if (startDate && endDate) {
      query.saleDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }
    
    if (client) {
      query.client = client;
    }
    
    const sales = await SaleModel.find(query)
      .populate('client', 'name email')
      .populate('items.product', 'name sku')
      .populate('items.batch', 'batchNumber status currentStock')
      .populate('createdBy', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ saleDate: -1 });
    
    const total = await SaleModel.countDocuments(query);
    
    res.json({
      sales,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener venta por ID
// @route   GET /api/sales/:id
// @access  Private
router.get('/:id', protect, identifyTenant, async (req, res) => {
  try {
    const SaleModel = req.tenantModels?.Sale || Sale;
    const sale = await SaleModel.findById(req.params.id)
      .populate('client', 'name email phone address')
      .populate('items.product', 'name sku price cost')
      .populate('items.batch', 'batchNumber status currentStock expirationDate')
      .populate('createdBy', 'name');
    
    if (sale) {
      res.json(sale);
    } else {
      res.status(404).json({ message: 'Venta no encontrada' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Crear venta
// @route   POST /api/sales
// @access  Private (Manager/Admin)
router.post('/', protect, identifyTenant, manager, async (req, res) => {
  try {
    const { items, client, paymentMethod, notes } = req.body;
    
    // Calcular totales
    let subtotal = 0;
    let totalCost = 0;
    const processedItems = [];
    
    for (const item of items) {
      let itemTotal = 0;
      let processedItem = { ...item };
      
      // Manejar ventas de paquetes
      if (item.isPackage && item.package) {
        const PackageModel = req.tenantModels?.Package || Package;
        const packageItem = await PackageModel.findById(item.package);
        if (!packageItem) {
          return res.status(400).json({ message: `Paquete ${item.package} no encontrado` });
        }
        
        if (!packageItem.isActive) {
          return res.status(400).json({ message: `El paquete ${packageItem.name} no está activo` });
        }
        
        // Verificar disponibilidad de stock del paquete
        const availability = await packageItem.checkStockAvailability();
        if (!availability.available) {
          return res.status(400).json({ 
            message: `Stock insuficiente para el paquete ${packageItem.name}. Productos no disponibles: ${availability.unavailableItems.map(i => `${i.product} (necesario: ${i.required}, disponible: ${i.available})`).join(', ')}` 
          });
        }
        
        // Consumir stock de todos los productos del paquete
        const consumedItems = await packageItem.consumeStock();
        
        itemTotal = (packageItem.finalPrice - (item.discount || 0)) * item.quantity;
        const itemCost = packageItem.totalCost * item.quantity;
        
        processedItem = {
          ...item,
          unitPrice: packageItem.finalPrice,
          cost: packageItem.totalCost,
          total: itemTotal,
          consumedItems: consumedItems
        };
        
        totalCost += itemCost;
        
      } else if (item.isFromPackage && item.packageId) {
        // Manejar productos que vienen de paquetes
        const PackageModel = req.tenantModels?.Package || Package;
        const packageItem = await PackageModel.findById(item.packageId);
        if (!packageItem) {
          return res.status(400).json({ message: `Paquete ${item.packageId} no encontrado` });
        }
        
        if (!packageItem.isActive) {
          return res.status(400).json({ message: `El paquete ${packageItem.name} no está activo` });
        }
        
        // Verificar que el producto pertenece al paquete
        const packageProduct = packageItem.items.find(pkgItem => 
          pkgItem.product.toString() === item.product.toString()
        );
        
        if (!packageProduct) {
          return res.status(400).json({ 
            message: `El producto ${item.product} no pertenece al paquete ${packageItem.name}` 
          });
        }
        
        // Verificar stock del producto individual
        const ProductModel = req.tenantModels?.Product || Product;
        const product = await ProductModel.findById(item.product);
        if (!product) {
          return res.status(400).json({ message: `Producto ${item.product} no encontrado` });
        }
        
        // Si se especifica un lote, validar y consumir stock del lote
        if (item.batch) {
          const BatchModel = req.tenantModels?.Batch || Batch;
          const batch = await BatchModel.findById(item.batch);
          if (!batch) {
            return res.status(400).json({ message: `Lote ${item.batch} no encontrado` });
          }
          
          if (batch.product.toString() !== item.product.toString()) {
            return res.status(400).json({ 
              message: `El lote ${batch.batchNumber} no pertenece al producto ${product.name}` 
            });
          }
          
          if (batch.currentStock < item.quantity) {
            return res.status(400).json({ 
              message: `Stock insuficiente en el lote ${batch.batchNumber}. Disponible: ${batch.currentStock}` 
            });
          }
          
          if (batch.status !== 'activo') {
            return res.status(400).json({ 
              message: `El lote ${batch.batchNumber} no está activo` 
            });
          }
          
          // Consumir stock del lote
          await BatchModel.findByIdAndUpdate(item.batch, {
            $inc: { currentStock: -item.quantity }
          });
          
          // Actualizar estado del lote si se agota
          if (batch.currentStock - item.quantity === 0) {
            await BatchModel.findByIdAndUpdate(item.batch, { status: 'agotado' });
          }
        } else {
          // Validación tradicional de stock del producto
          if (product.stock < item.quantity) {
            return res.status(400).json({ 
              message: `Stock insuficiente para ${product.name}. Disponible: ${product.stock}` 
            });
          }
        }
        
        // SIEMPRE actualizar stock del producto principal para productos individuales
        // El lote es solo una subdivisión del inventario total
        await ProductModel.findByIdAndUpdate(item.product, {
          $inc: { stock: -item.quantity }
        });
        
        itemTotal = (item.unitPrice - (item.discount || 0)) * item.quantity;
        const itemCost = product.cost * item.quantity;
        processedItem = {
          ...item,
          cost: product.cost,
          package: packageItem._id,
          packageName: packageItem.name,
          total: itemTotal
        };
        
        totalCost += itemCost;
        
      } else {
        // Lógica tradicional de ventas de productos individuales
        const ProductModel = req.tenantModels?.Product || Product;
        const product = await ProductModel.findById(item.product);
        if (!product) {
          return res.status(400).json({ message: `Producto ${item.product} no encontrado` });
        }
        
        // Si se especifica un lote, validar y consumir stock del lote
        if (item.batch) {
          const BatchModel = req.tenantModels?.Batch || Batch;
          const batch = await BatchModel.findById(item.batch);
          if (!batch) {
            return res.status(400).json({ message: `Lote ${item.batch} no encontrado` });
          }
          
          if (batch.product.toString() !== item.product) {
            return res.status(400).json({ message: `El lote ${batch.batchNumber} no corresponde al producto ${product.name}` });
          }
          
          if (batch.currentStock < item.quantity) {
            return res.status(400).json({ 
              message: `Stock insuficiente en lote #${batch.batchNumber} para ${product.name}. Disponible: ${batch.currentStock} ${batch.unit}` 
            });
          }
          
          if (batch.status !== 'activo') {
            return res.status(400).json({ 
              message: `El lote #${batch.batchNumber} no está activo (estado: ${batch.status})` 
            });
          }
          
          // Consumir stock del lote
          await BatchModel.findByIdAndUpdate(item.batch, {
            $inc: { currentStock: -item.quantity }
          });
          
          // Actualizar estado del lote si se agota
          if (batch.currentStock - item.quantity === 0) {
            await BatchModel.findByIdAndUpdate(item.batch, { status: 'agotado' });
          }
        } else {
          // Validación tradicional de stock del producto
          if (product.stock < item.quantity) {
            return res.status(400).json({ 
              message: `Stock insuficiente para ${product.name}. Disponible: ${product.stock}` 
            });
          }
        }
        
        itemTotal = (item.unitPrice - (item.discount || 0)) * item.quantity;
        const itemCost = product.cost * item.quantity;
        processedItem = {
          ...item,
          cost: product.cost,
          total: itemTotal
        };
        
        totalCost += itemCost;
        
        // SIEMPRE actualizar stock del producto principal para productos individuales
        // El lote es solo una subdivisión del inventario total
        await ProductModel.findByIdAndUpdate(item.product, {
          $inc: { stock: -item.quantity }
        });
      }
      
      subtotal += itemTotal;
      processedItems.push(processedItem);
    }
    
    // Obtener IVA de la configuración
    const ConfigModel = req.tenantModels?.Config || Config;
    const ivaPercentage = await ConfigModel.getByKey('iva_percentage') || 0;
    const tax = subtotal * (ivaPercentage / 100);
    const total = subtotal + tax;
    
    // Calcular ganancia y margen
    const profit = subtotal - totalCost;
    const profitMargin = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    
    
    const saleData = {
      invoiceNumber: generateInvoiceNumber(),
      client,
      items: processedItems,
      subtotal,
      tax,
      total,
      totalCost,
      profit,
      profitMargin,
      paymentMethod,
      notes,
      createdBy: req.user._id
    };
    
    const SaleModel = req.tenantModels?.Sale || Sale;
    const sale = await SaleModel.create(saleData);
    
    // Populate para la respuesta
    const populatedSale = await SaleModel.findById(sale._id)
      .populate('client', 'name email')
      .populate('items.product', 'name sku')
      .populate('items.batch', 'batchNumber status currentStock')
      .populate('createdBy', 'name');
    
    res.status(201).json(populatedSale);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Actualizar estado de pago
// @route   PUT /api/sales/:id/payment-status
// @access  Private
router.put('/:id/payment-status', protect, identifyTenant, async (req, res) => {
  try {
    const { paymentStatus } = req.body;
    
    const SaleModel = req.tenantModels?.Sale || Sale;
    const sale = await SaleModel.findByIdAndUpdate(
      req.params.id,
      { paymentStatus },
      { new: true }
    ).populate('client', 'name email');
    
    if (sale) {
      res.json(sale);
    } else {
      res.status(404).json({ message: 'Venta no encontrada' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener estadísticas de ventas
// @route   GET /api/sales/stats/summary
// @access  Private
router.get('/stats/summary', protect, identifyTenant, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = { isActive: true };
    if (startDate && endDate) {
      query.saleDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const SaleModel = req.tenantModels?.Sale || Sale;
    const totalSales = await SaleModel.countDocuments(query);
    const totalRevenue = await SaleModel.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    
    const salesByStatus = await SaleModel.aggregate([
      { $match: query },
      { $group: { _id: '$paymentStatus', count: { $sum: 1 } } }
    ]);
    
    res.json({
      totalSales,
      totalRevenue: totalRevenue[0]?.total || 0,
      salesByStatus
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Agregar pago parcial a una venta
// @route   POST /api/sales/:id/payments
// @access  Private
router.post('/:id/payments', protect, identifyTenant, async (req, res) => {
  try {
    const { amount, paymentMethod, bankAccount, notes } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        success: false,
        message: 'El monto del pago debe ser mayor a 0' 
      });
    }
    
    const SaleModel = req.tenantModels?.Sale || Sale;
    const sale = await SaleModel.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ 
        success: false,
        message: 'Venta no encontrada' 
      });
    }
    
    // Verificar que el pago no exceda el monto restante
    if (amount > sale.remainingAmount) {
      return res.status(400).json({ 
        success: false,
        message: `El monto del pago (${amount}) excede el monto restante (${sale.remainingAmount})` 
      });
    }
    
    // Agregar el pago parcial
    const newPayment = {
      amount,
      paymentMethod,
      bankAccount: bankAccount || null,
      paymentDate: new Date(),
      notes: notes || '',
      createdBy: req.user.id
    };
    
    sale.partialPayments.push(newPayment);
    
    // Si es el primer pago, actualizar el método de pago principal de la venta
    if (sale.partialPayments.length === 1) {
      sale.paymentMethod = paymentMethod;
      sale.bankAccount = bankAccount || null;
    }
    
    // Actualizar saldo de la cuenta bancaria si se especifica
    if (bankAccount && paymentMethod !== 'efectivo') {
      try {
        
        const BankModel = req.tenantModels?.Bank || Bank;
        const bank = await BankModel.findById(bankAccount);
        if (bank) {
          const previousBalance = bank.currentBalance;
          const newBalance = previousBalance + amount;
          
          
          // Aumentar el saldo de la cuenta bancaria
          bank.currentBalance = newBalance;
          await bank.save();
          
          
          // Registrar la transacción bancaria
          const transactionData = {
            bank: bankAccount,
            type: 'payment',
            amount,
            previousBalance,
            newBalance,
            description: `Pago de venta #${sale.invoiceNumber}`,
            reference: sale._id,
            referenceType: 'sale',
            createdBy: req.user.id,
            tenant: req.tenant?._id
          };
          
          
          const BankTransactionModel = req.tenantModels?.BankTransaction || BankTransaction;
          const transaction = await BankTransactionModel.create(transactionData);
        } else {
        }
      } catch (bankError) {
        // No fallar la operación si hay error con el banco
      }
    }
    
    await sale.save();
    
    // Poblar las referencias para devolver datos completos
    const populatedSale = await SaleModel.findById(sale._id)
      .populate('client', 'name email phone')
      .populate('items.product', 'name sku price')
      .populate('items.batch', 'batchNumber expirationDate')
      .populate('partialPayments.bankAccount', 'name accountNumber type')
      .populate('partialPayments.createdBy', 'name email')
      .populate('bankAccount', 'name accountNumber type')
      .populate('createdBy', 'name email')
      .lean();
    
    res.json({
      success: true,
      data: populatedSale,
      message: 'Pago parcial registrado correctamente'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor' 
    });
  }
});

// @desc    Obtener pagos parciales de una venta
// @route   GET /api/sales/:id/payments
// @access  Private
router.get('/:id/payments', protect, identifyTenant, async (req, res) => {
  try {
    const SaleModel = req.tenantModels?.Sale || Sale;
    const sale = await SaleModel.findById(req.params.id)
      .populate('partialPayments.bankAccount', 'name accountNumber type')
      .populate('partialPayments.createdBy', 'name email')
      .select('partialPayments paidAmount remainingAmount total paymentStatus');
    
    if (!sale) {
      return res.status(404).json({ 
        success: false,
        message: 'Venta no encontrada' 
      });
    }
    
    res.json({
      success: true,
      data: {
        payments: sale.partialPayments,
        paidAmount: sale.paidAmount,
        remainingAmount: sale.remainingAmount,
        total: sale.total,
        paymentStatus: sale.paymentStatus
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor' 
    });
  }
});

// @desc    Eliminar un pago parcial
// @route   DELETE /api/sales/:id/payments/:paymentId
// @access  Private (Manager)
router.delete('/:id/payments/:paymentId', protect, identifyTenant, manager, async (req, res) => {
  try {
    const SaleModel = req.tenantModels?.Sale || Sale;
    const sale = await SaleModel.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ 
        success: false,
        message: 'Venta no encontrada' 
      });
    }
    
    const paymentIndex = sale.partialPayments.findIndex(
      payment => payment._id.toString() === req.params.paymentId
    );
    
    if (paymentIndex === -1) {
      return res.status(404).json({ 
        success: false,
        message: 'Pago no encontrado' 
      });
    }
    
    // Obtener el pago antes de eliminarlo para restaurar el saldo bancario
    const paymentToDelete = sale.partialPayments[paymentIndex];
    
    // Restaurar saldo de la cuenta bancaria si el pago tenía una cuenta bancaria
    if (paymentToDelete.bankAccount && paymentToDelete.paymentMethod !== 'efectivo') {
      try {
        
        const BankModel = req.tenantModels?.Bank || Bank;
        const bank = await BankModel.findById(paymentToDelete.bankAccount);
        if (bank) {
          const previousBalance = bank.currentBalance;
          const newBalance = previousBalance - paymentToDelete.amount;
          
          
          // Restar el monto del saldo de la cuenta bancaria
          bank.currentBalance = newBalance;
          await bank.save();
          
          
          // Registrar la transacción de reversión
          const refundData = {
            bank: paymentToDelete.bankAccount,
            type: 'refund',
            amount: paymentToDelete.amount,
            previousBalance,
            newBalance,
            description: `Reversión de pago de venta #${sale.invoiceNumber}`,
            reference: sale._id,
            referenceType: 'sale',
            createdBy: req.user.id,
            tenant: req.tenant?._id
          };
          
          
          const BankTransactionModel = req.tenantModels?.BankTransaction || BankTransaction;
          const refundTransaction = await BankTransactionModel.create(refundData);
        } else {
        }
      } catch (bankError) {
        // No fallar la operación si hay error con el banco
      }
    }
    
    // Eliminar el pago
    sale.partialPayments.splice(paymentIndex, 1);
    await sale.save();
    
    // Poblar las referencias para devolver datos completos
    const populatedSale = await SaleModel.findById(sale._id)
      .populate('client', 'name email phone')
      .populate('items.product', 'name sku price')
      .populate('items.batch', 'batchNumber expirationDate')
      .populate('partialPayments.bankAccount', 'name accountNumber type')
      .populate('partialPayments.createdBy', 'name email')
      .populate('bankAccount', 'name accountNumber type')
      .populate('createdBy', 'name email')
      .lean();
    
    res.json({
      success: true,
      data: populatedSale,
      message: 'Pago eliminado correctamente'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor' 
    });
  }
});

// Generar número de factura único
const generateInvoiceNumber = () => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${timestamp.slice(-6)}-${random}`;
};

export default router;
