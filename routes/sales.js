import express from 'express';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import Batch from '../models/Batch.js';
import Package from '../models/Package.js';
import Config from '../models/Config.js';
import { protect, manager } from '../middleware/auth.js';

const router = express.Router();

// @desc    Obtener paquetes disponibles para ventas
// @route   GET /api/sales/available-packages
// @access  Private
router.get('/available-packages', protect, async (req, res) => {
  try {
    const packages = await Package.find({ isActive: true })
      .populate('items.product', 'name sku price cost stock category')
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
    console.error('Error al obtener paquetes disponibles:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener todas las ventas
// @route   GET /api/sales
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
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
    
    const sales = await Sale.find(query)
      .populate('client', 'name email')
      .populate('items.product', 'name sku')
      .populate('items.batch', 'batchNumber status currentStock')
      .populate('createdBy', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ saleDate: -1 });
    
    const total = await Sale.countDocuments(query);
    
    res.json({
      sales,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error al obtener ventas:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener venta por ID
// @route   GET /api/sales/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
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
    console.error('Error al obtener venta:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Crear venta
// @route   POST /api/sales
// @access  Private (Manager/Admin)
router.post('/', protect, manager, async (req, res) => {
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
        const packageItem = await Package.findById(item.package);
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
        const packageItem = await Package.findById(item.packageId);
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
        const product = await Product.findById(item.product);
        if (!product) {
          return res.status(400).json({ message: `Producto ${item.product} no encontrado` });
        }
        
        // Si se especifica un lote, validar y consumir stock del lote
        if (item.batch) {
          const batch = await Batch.findById(item.batch);
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
          await Batch.findByIdAndUpdate(item.batch, {
            $inc: { currentStock: -item.quantity }
          });
          
          // Actualizar estado del lote si se agota
          if (batch.currentStock - item.quantity === 0) {
            await Batch.findByIdAndUpdate(item.batch, { status: 'agotado' });
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
        await Product.findByIdAndUpdate(item.product, {
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
        const product = await Product.findById(item.product);
        if (!product) {
          return res.status(400).json({ message: `Producto ${item.product} no encontrado` });
        }
        
        // Si se especifica un lote, validar y consumir stock del lote
        if (item.batch) {
          const batch = await Batch.findById(item.batch);
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
          await Batch.findByIdAndUpdate(item.batch, {
            $inc: { currentStock: -item.quantity }
          });
          
          // Actualizar estado del lote si se agota
          if (batch.currentStock - item.quantity === 0) {
            await Batch.findByIdAndUpdate(item.batch, { status: 'agotado' });
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
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: -item.quantity }
        });
      }
      
      subtotal += itemTotal;
      processedItems.push(processedItem);
    }
    
    // Obtener IVA de la configuración
    const ivaPercentage = await Config.getByKey('iva_percentage') || 0;
    const tax = subtotal * (ivaPercentage / 100);
    const total = subtotal + tax;
    
    // Calcular ganancia y margen
    const profit = subtotal - totalCost;
    const profitMargin = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    
    console.log(`[SALE] Cálculos de ganancia:`);
    console.log(`[SALE] - Subtotal: $${subtotal}`);
    console.log(`[SALE] - Costo total: $${totalCost}`);
    console.log(`[SALE] - Ganancia: $${profit}`);
    console.log(`[SALE] - Margen de ganancia: ${profitMargin.toFixed(2)}%`);
    
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
    
    const sale = await Sale.create(saleData);
    
    // Populate para la respuesta
    const populatedSale = await Sale.findById(sale._id)
      .populate('client', 'name email')
      .populate('items.product', 'name sku')
      .populate('items.batch', 'batchNumber status currentStock')
      .populate('createdBy', 'name');
    
    res.status(201).json(populatedSale);
  } catch (error) {
    console.error('Error al crear venta:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Actualizar estado de pago
// @route   PUT /api/sales/:id/payment-status
// @access  Private
router.put('/:id/payment-status', protect, async (req, res) => {
  try {
    const { paymentStatus } = req.body;
    
    const sale = await Sale.findByIdAndUpdate(
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
    console.error('Error al actualizar estado de pago:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener estadísticas de ventas
// @route   GET /api/sales/stats/summary
// @access  Private
router.get('/stats/summary', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = { isActive: true };
    if (startDate && endDate) {
      query.saleDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const totalSales = await Sale.countDocuments(query);
    const totalRevenue = await Sale.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    
    const salesByStatus = await Sale.aggregate([
      { $match: query },
      { $group: { _id: '$paymentStatus', count: { $sum: 1 } } }
    ]);
    
    res.json({
      totalSales,
      totalRevenue: totalRevenue[0]?.total || 0,
      salesByStatus
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Generar número de factura único
const generateInvoiceNumber = () => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${timestamp.slice(-6)}-${random}`;
};

export default router;
