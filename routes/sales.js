import express from 'express';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import { protect, manager } from '../middleware/auth.js';

const router = express.Router();

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
    const processedItems = [];
    
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(400).json({ message: `Producto ${item.product} no encontrado` });
      }
      
      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          message: `Stock insuficiente para ${product.name}. Disponible: ${product.stock}` 
        });
      }
      
      const itemTotal = (item.unitPrice - (item.discount || 0)) * item.quantity;
      subtotal += itemTotal;
      
      processedItems.push({
        ...item,
        total: itemTotal
      });
      
      // Actualizar stock
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity }
      });
    }
    
    const tax = subtotal * 0.16; // 16% IVA
    const total = subtotal + tax;
    
    const saleData = {
      invoiceNumber: generateInvoiceNumber(),
      client,
      items: processedItems,
      subtotal,
      tax,
      total,
      paymentMethod,
      notes,
      createdBy: req.user._id
    };
    
    const sale = await Sale.create(saleData);
    
    // Populate para la respuesta
    const populatedSale = await Sale.findById(sale._id)
      .populate('client', 'name email')
      .populate('items.product', 'name sku')
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
