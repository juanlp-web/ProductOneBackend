import express from 'express';
import Product from '../models/Product.js';
import Client from '../models/Client.js';
import Supplier from '../models/Supplier.js';
import Sale from '../models/Sale.js';
import Purchase from '../models/Purchase.js';
import Batch from '../models/Batch.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @desc    Obtener estadísticas generales del dashboard
// @route   GET /api/dashboard/stats
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    // Estadísticas de productos
    const productsStats = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    const productsByCategory = {};
    productsStats.forEach(stat => {
      productsByCategory[stat._id] = stat.count;
    });

    const totalProducts = await Product.countDocuments();

    // Estadísticas de clientes
    const totalClients = await Client.countDocuments();
    const activeClients = await Client.countDocuments({ isActive: true });

    // Estadísticas de proveedores
    const totalSuppliers = await Supplier.countDocuments();
    const activeSuppliers = await Supplier.countDocuments({ isActive: true });

    // Estadísticas de ventas del mes actual
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const monthlySales = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          totalCost: { $sum: '$totalCost' },
          profit: { $sum: '$profit' },
          count: { $sum: 1 }
        }
      }
    ]);

    const monthlySalesData = monthlySales[0] || { total: 0, totalCost: 0, profit: 0, count: 0 };

    // Estadísticas de compras del mes
    const monthlyPurchases = await Purchase.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      }
    ]);

    const monthlyPurchasesData = monthlyPurchases[0] || { total: 0, count: 0 };

    // Estadísticas de lotes
    const totalBatches = await Batch.countDocuments({ isActive: true });
    const expiringSoon = await Batch.countDocuments({
      isActive: true,
      expirationDate: { $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
    });

    // Usar el profit real calculado en las ventas
    const profit = monthlySalesData.profit;
    const profitMargin = monthlySalesData.totalCost > 0 ? (profit / monthlySalesData.totalCost) * 100 : 0;
    
    console.log(`[DASHBOARD] Estadísticas de ventas del mes:`);
    console.log(`[DASHBOARD] - Total ventas: $${monthlySalesData.total}`);
    console.log(`[DASHBOARD] - Costo total: $${monthlySalesData.totalCost}`);
    console.log(`[DASHBOARD] - Ganancia: $${profit}`);
    console.log(`[DASHBOARD] - Margen de ganancia: ${profitMargin.toFixed(2)}%`);
    console.log(`[DASHBOARD] - Número de ventas: ${monthlySalesData.count}`);

    res.json({
      success: true,
      data: {
        products: {
          total: totalProducts,
          byCategory: productsByCategory
        },
        clients: {
          total: totalClients,
          active: activeClients
        },
        suppliers: {
          total: totalSuppliers,
          active: activeSuppliers
        },
        sales: {
          total: monthlySalesData.total,
          monthly: monthlySalesData.total,
          totalCost: monthlySalesData.totalCost,
          profit: Math.max(0, profit),
          profitMargin: Math.round(profitMargin * 100) / 100,
          count: monthlySalesData.count
        },
        purchases: {
          total: monthlyPurchasesData.total,
          monthly: monthlyPurchasesData.total
        },
        batches: {
          total: totalBatches,
          expiringSoon: expiringSoon
        }
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas del dashboard:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener top productos vendidos
// @route   GET /api/dashboard/top-products
// @access  Private
router.get('/top-products', protect, async (req, res) => {
  try {
    const { limit = 6 } = req.query;
    
    const topProducts = await Sale.aggregate([
      {
        $unwind: '$items'
      },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.productName' },
          quantity: { $sum: '$items.quantity' },
          total: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
        }
      },
      {
        $sort: { quantity: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    res.json({
      success: true,
      data: topProducts
    });
  } catch (error) {
    console.error('Error al obtener top productos:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener datos mensuales de ventas
// @route   GET /api/dashboard/monthly-sales
// @access  Private
router.get('/monthly-sales', protect, async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    
    const monthlyData = await Sale.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(year, 0, 1),
            $lt: new Date(year + 1, 0, 1)
          }
        }
      },
      {
        $group: {
          _id: { $month: '$createdAt' },
          month: { $first: { $month: '$createdAt' } },
          total: { $sum: '$total' },
          totalCost: { $sum: '$totalCost' },
          profit: { $sum: '$profit' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { month: 1 }
      }
    ]);

    // Llenar meses faltantes con 0
    const months = [];
    for (let i = 1; i <= 12; i++) {
      const monthData = monthlyData.find(m => m.month === i);
      const total = monthData ? monthData.total : 0;
      const totalCost = monthData ? monthData.totalCost : 0;
      const profit = monthData ? monthData.profit : 0;
      const profitMargin = totalCost > 0 ? (profit / totalCost) * 100 : 0;
      
      months.push({
        month: i,
        total: total,
        totalCost: totalCost,
        profit: profit,
        profitMargin: Math.round(profitMargin * 100) / 100,
        count: monthData ? monthData.count : 0
      });
    }

    res.json({
      success: true,
      data: months
    });
  } catch (error) {
    console.error('Error al obtener datos mensuales:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener estadísticas de distribución de inversión
// @route   GET /api/dashboard/investment-distribution
// @access  Private
router.get('/investment-distribution', protect, async (req, res) => {
  try {
    const { year } = req.query;
    const startDate = new Date(year || new Date().getFullYear(), 0, 1);
    const endDate = new Date(year || new Date().getFullYear(), 11, 31, 23, 59, 59);

    // Obtener compras por categoría de producto
    const investmentByCategory = await Purchase.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'recibida'
        }
      },
      {
        $unwind: '$items'
      },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      {
        $unwind: '$productInfo'
      },
      {
        $group: {
          _id: '$productInfo.category',
          totalInvestment: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { totalInvestment: -1 }
      }
    ]);

    // Calcular total de inversión
    const totalInvestment = investmentByCategory.reduce((sum, item) => sum + item.totalInvestment, 0);

    // Formatear datos para el gráfico
    const distributionData = investmentByCategory.map(item => {
      const percentage = totalInvestment > 0 ? (item.totalInvestment / totalInvestment) * 100 : 0;
      return {
        name: getCategoryDisplayName(item._id),
        value: Math.round(percentage * 100) / 100, // Redondear a 2 decimales
        amount: item.totalInvestment,
        count: item.count,
        color: getCategoryColor(item._id)
      };
    });

    // Agregar categorías que no tienen inversión
    const allCategories = ['materia_prima', 'envases_embalaje', 'reventa', 'gastos_generales'];
    allCategories.forEach(category => {
      if (!distributionData.find(item => item.name === getCategoryDisplayName(category))) {
        distributionData.push({
          name: getCategoryDisplayName(category),
          value: 0,
          amount: 0,
          count: 0,
          color: getCategoryColor(category)
        });
      }
    });

    res.json({
      success: true,
      data: {
        distribution: distributionData,
        totalInvestment,
        year: year || new Date().getFullYear()
      }
    });
  } catch (error) {
    console.error('Error al obtener distribución de inversión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener distribución de inversión',
      error: error.message
    });
  }
});

// Función auxiliar para obtener nombres de categorías en español
function getCategoryDisplayName(category) {
  const categoryNames = {
    'materia_prima': 'Materia Prima',
    'envases_embalaje': 'Envases y Embalaje',
    'reventa': 'Reventa',
    'gastos_generales': 'Gastos Generales',
    'producto_terminado': 'Productos Terminados'
  };
  return categoryNames[category] || category;
}

// Función auxiliar para obtener colores de categorías
function getCategoryColor(category) {
  const categoryColors = {
    'materia_prima': '#10B981',
    'envases_embalaje': '#3B82F6',
    'reventa': '#8B5CF6',
    'gastos_generales': '#F59E0B',
    'producto_terminado': '#EC4899'
  };
  return categoryColors[category] || '#6B7280';
}

export default router;
