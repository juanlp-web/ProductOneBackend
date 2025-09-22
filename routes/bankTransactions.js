import express from 'express';
import mongoose from 'mongoose';
import BankTransaction from '../models/BankTransaction.js';
import Bank from '../models/Bank.js';
import { protect, manager } from '../middleware/auth.js';
import { identifyTenant } from '../middleware/tenant.js';

const router = express.Router();

// @desc    Obtener historial de transacciones de una cuenta bancaria
// @route   GET /api/bank-transactions/:bankId
// @access  Private
router.get('/:bankId', protect, identifyTenant, async (req, res) => {
  try {
    
    // Validar que el bankId sea un ObjectId válido
    if (!req.params.bankId) {
      return res.status(400).json({
        success: false,
        message: 'ID de cuenta bancaria requerido'
      });
    }
    
    // Verificar si es un ObjectId válido usando mongoose
    if (!mongoose.Types.ObjectId.isValid(req.params.bankId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cuenta bancaria inválido'
      });
    }
    
    const { page = 1, limit = 20, type, startDate, endDate } = req.query;
    
    // Verificar que la cuenta bancaria existe y pertenece al tenant
    const query = { _id: req.params.bankId };
    
    
    const BankModel = req.tenantModels?.Bank || Bank;
    const bank = await BankModel.findOne(query);
    if (!bank) {
      return res.status(404).json({
        success: false,
        message: 'Cuenta bancaria no encontrada'
      });
    }
    
    
    // Construir query para transacciones
    const transactionQuery = { bank: req.params.bankId };
    
    if (type && type !== 'all') {
      transactionQuery.type = type;
    }
    
    if (startDate || endDate) {
      transactionQuery.createdAt = {};
      if (startDate) {
        transactionQuery.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        transactionQuery.createdAt.$lte = new Date(endDate);
      }
    }
    
    
    const BankTransactionModel = req.tenantModels?.BankTransaction || BankTransaction;
    const transactions = await BankTransactionModel.find(transactionQuery)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    
    const total = await BankTransactionModel.countDocuments(transactionQuery);
    
    // Calcular estadísticas
    const stats = {
      totalTransactions: total,
      totalDeposits: 0,
      totalWithdrawals: 0,
      netChange: 0
    };
    
    const allTransactions = await BankTransactionModel.find(transactionQuery);
    allTransactions.forEach(transaction => {
      if (transaction.type === 'deposit' || transaction.type === 'payment') {
        stats.totalDeposits += transaction.amount;
        stats.netChange += transaction.amount;
      } else if (transaction.type === 'withdrawal' || transaction.type === 'refund') {
        stats.totalWithdrawals += transaction.amount;
        stats.netChange -= transaction.amount;
      }
    });
    
    res.json({
      success: true,
      data: transactions,
      stats,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// @desc    Crear transacción bancaria manual
// @route   POST /api/bank-transactions/:bankId
// @access  Private (Manager)
router.post('/:bankId', protect, identifyTenant, manager, async (req, res) => {
  try {
    const { type, amount, description } = req.body;
    
    if (!type || !amount || !description) {
      return res.status(400).json({
        success: false,
        message: 'Tipo, monto y descripción son requeridos'
      });
    }
    
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El monto debe ser mayor a 0'
      });
    }
    
    // Verificar que la cuenta bancaria existe
    const query = { _id: req.params.bankId };

    
    const BankModel = req.tenantModels?.Bank || Bank;
    const bank = await BankModel.findOne(query);
    if (!bank) {
      return res.status(404).json({
        success: false,
        message: 'Cuenta bancaria no encontrada'
      });
    }
    
    const previousBalance = bank.currentBalance;
    let newBalance = previousBalance;
    
    // Calcular nuevo saldo según el tipo de transacción
    if (type === 'deposit' || type === 'payment') {
      newBalance += amount;
    } else if (type === 'withdrawal' || type === 'refund') {
      if (amount > previousBalance) {
        return res.status(400).json({
          success: false,
          message: 'El monto excede el saldo disponible'
        });
      }
      newBalance -= amount;
    }
    
    // Crear la transacción
    const BankTransactionModel = req.tenantModels?.BankTransaction || BankTransaction;
    const transaction = await BankTransactionModel.create({
      bank: req.params.bankId,
      type,
      amount,
      previousBalance,
      newBalance,
      description,
      referenceType: 'manual',
      createdBy: req.user.id,
      tenant: req.tenant?._id
    });
    
    // Actualizar saldo de la cuenta bancaria
    bank.currentBalance = newBalance;
    await bank.save();
    
    // Poblar la transacción creada
    const populatedTransaction = await BankTransactionModel.findById(transaction._id)
      .populate('createdBy', 'name email')
      .populate('bank', 'name accountNumber');
    
    res.status(201).json({
      success: true,
      data: populatedTransaction,
      message: 'Transacción registrada correctamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// @desc    Obtener estadísticas de transacciones
// @route   GET /api/bank-transactions/:bankId/stats
// @access  Private
router.get('/:bankId/stats', protect, identifyTenant, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calcular fechas según el período
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    const query = { 
      bank: req.params.bankId,
      createdAt: { $gte: startDate }
    };
    
    const transactions = await BankTransaction.find(query);
    
    const stats = {
      period,
      totalTransactions: transactions.length,
      totalDeposits: 0,
      totalWithdrawals: 0,
      netChange: 0,
      averageTransaction: 0,
      transactionsByType: {},
      transactionsByDay: {}
    };
    
    // Calcular estadísticas
    transactions.forEach(transaction => {
      if (transaction.type === 'deposit' || transaction.type === 'payment') {
        stats.totalDeposits += transaction.amount;
        stats.netChange += transaction.amount;
      } else if (transaction.type === 'withdrawal' || transaction.type === 'refund') {
        stats.totalWithdrawals += transaction.amount;
        stats.netChange -= transaction.amount;
      }
      
      // Contar por tipo
      if (!stats.transactionsByType[transaction.type]) {
        stats.transactionsByType[transaction.type] = 0;
      }
      stats.transactionsByType[transaction.type]++;
      
      // Contar por día
      const day = transaction.createdAt.toISOString().split('T')[0];
      if (!stats.transactionsByDay[day]) {
        stats.transactionsByDay[day] = 0;
      }
      stats.transactionsByDay[day]++;
    });
    
    stats.averageTransaction = transactions.length > 0 ? 
      (stats.totalDeposits + stats.totalWithdrawals) / transactions.length : 0;
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

export default router;
