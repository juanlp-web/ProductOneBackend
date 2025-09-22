import express from 'express';
import Bank from '../models/Bank.js';
import { protect, manager } from '../middleware/auth.js';
import { identifyTenant } from '../middleware/tenant.js';

const router = express.Router();

// @desc    Obtener todas las cuentas bancarias
// @route   GET /api/banks
// @access  Private
router.get('/', protect, identifyTenant, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, type, status, currency } = req.query;
    
    // Usar tenant si está disponible, sino usar query vacío para BD principal
    const query =  {};
    
    // Filtro por estado
    if (status && status !== 'Todos los estados') {
      if (status === 'Activo') {
        query.isActive = true;
      } else if (status === 'Inactivo') {
        query.isActive = false;
      } else {
        query.status = status;
      }
    }
    
    // Filtro por tipo
    if (type && type !== 'Todos los tipos') {
      query.type = type;
    }
    
    // Filtro por moneda
    if (currency && currency !== 'Todas las monedas') {
      query.currency = currency;
    }
    
    // Búsqueda por texto
    if (search) {
      query.$text = { $search: search };
    }
    
    const BankModel = req.tenantModels?.Bank || Bank;
    const banks = await BankModel.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    
    const total = await BankModel.countDocuments(query);
    
    // Calcular estadísticas
    const totalBalance = banks.reduce((sum, bank) => sum + bank.currentBalance, 0);
    const activeAccounts = banks.filter(bank => bank.isActive).length;
    const accountTypes = [...new Set(banks.map(bank => bank.type))].length;
    
    res.json({
      success: true,
      data: banks,
      summary: {
        totalBalance,
        activeAccounts,
        accountTypes,
        totalAccounts: banks.length
      },
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

// @desc    Obtener cuenta bancaria por ID
// @route   GET /api/banks/:id
// @access  Private
router.get('/:id', protect, identifyTenant, async (req, res) => {
  try {
    const query = { _id: req.params.id };

    
    const BankModel = req.tenantModels?.Bank || Bank;
    const bank = await BankModel.findOne(query);
    
    if (bank) {
      res.json({
        success: true,
        data: bank
      });
    } else {
      res.status(404).json({ 
        success: false,
        message: 'Cuenta bancaria no encontrada' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor' 
    });
  }
});

// @desc    Crear cuenta bancaria
// @route   POST /api/banks
// @access  Private (Manager/Admin)
router.post('/', protect, identifyTenant, manager, async (req, res) => {
  try {
    const bankData = {
      ...req.body,
      currentBalance: req.body.initialBalance // El saldo actual inicia igual al inicial
    };
    

    const BankModel = req.tenantModels?.Bank || Bank;
    const bank = await BankModel.create(bankData);
    
    // Crear transacción inicial si el saldo inicial es mayor a 0
    if (bank.initialBalance > 0) {
      try {
        const BankTransactionModel = req.tenantModels?.BankTransaction || (await import('../models/BankTransaction.js')).default;
        
        await BankTransactionModel.create({
          bank: bank._id,
          type: 'deposit',
          amount: bank.initialBalance,
          previousBalance: 0,
          newBalance: bank.initialBalance,
          description: `Saldo inicial - ${bank.name}`,
          reference: bank._id.toString(),
          referenceType: 'manual',
          createdBy: req.user.id
        });
        
      } catch (transactionError) {
        // No fallar la creación del banco por error en transacción
      }
    }
    
    res.status(201).json({
      success: true,
      data: bank,
      message: 'Cuenta bancaria creada correctamente'
    });
  } catch (error) {
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor' 
    });
  }
});

// @desc    Actualizar cuenta bancaria
// @route   PUT /api/banks/:id
// @access  Private (Manager/Admin)
router.put('/:id', protect, identifyTenant, manager, async (req, res) => {
  try {
    
    // Obtener el banco actual para comparar saldos
    const BankModel = req.tenantModels?.Bank || Bank;
    const currentBank = await BankModel.findOne(query);
    if (!currentBank) {
      return res.status(404).json({
        success: false,
        message: 'Cuenta bancaria no encontrada'
      });
    }
    
    // Si se cambió el saldo inicial, calcular el nuevo currentBalance
    let updateData = { ...req.body };
    if (req.body.initialBalance !== undefined && req.body.initialBalance !== currentBank.initialBalance) {
      const difference = req.body.initialBalance - currentBank.initialBalance;
      updateData.currentBalance = currentBank.currentBalance + difference;
    }
    
    const bank = await BankModel.findOneAndUpdate(
      query,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (bank) {
      // Si se cambió el saldo inicial, crear transacción de ajuste
      if (req.body.initialBalance !== undefined && req.body.initialBalance !== currentBank.initialBalance) {
        try {
          const BankTransactionModel = req.tenantModels?.BankTransaction || (await import('../models/BankTransaction.js')).default;
          
          const difference = req.body.initialBalance - currentBank.initialBalance;
          const transactionType = difference > 0 ? 'deposit' : 'withdrawal';
          const amount = Math.abs(difference);
          
          await BankTransactionModel.create({
            bank: bank._id,
            type: transactionType,
            amount: amount,
            previousBalance: currentBank.currentBalance,
            newBalance: bank.currentBalance,
            description: `Ajuste de saldo inicial - ${bank.name}`,
            reference: bank._id.toString(),
            referenceType: 'manual',
            createdBy: req.user.id
          });
          
        } catch (transactionError) {
          // No fallar la actualización del banco por error en transacción
        }
      }
      
      res.json({
        success: true,
        data: bank,
        message: 'Cuenta bancaria actualizada correctamente'
      });
    } else {
      res.status(404).json({ 
        success: false,
        message: 'Cuenta bancaria no encontrada' 
      });
    }
  } catch (error) {
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor' 
    });
  }
});

// @desc    Eliminar cuenta bancaria
// @route   DELETE /api/banks/:id
// @access  Private (Manager/Admin)
router.delete('/:id', protect, identifyTenant, manager, async (req, res) => {
  try {
    const query = { _id: req.params.id };

    const BankModel = req.tenantModels?.Bank || Bank;
    const bank = await BankModel.findOneAndUpdate(
      query,
      { isActive: false, status: 'Inactivo' },
      { new: true }
    );
    
    if (bank) {
      res.json({
        success: true,
        message: 'Cuenta bancaria eliminada correctamente'
      });
    } else {
      res.status(404).json({ 
        success: false,
        message: 'Cuenta bancaria no encontrada' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor' 
    });
  }
});

// @desc    Actualizar saldo de cuenta bancaria
// @route   PATCH /api/banks/:id/balance
// @access  Private (Manager/Admin)
router.patch('/:id/balance', protect, identifyTenant, manager, async (req, res) => {
  try {
    const {  transactionType, amount, description } = req.body;
    
    const query = { _id: req.params.id };

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
    let shouldCreateTransaction = false;
    let transactionData = null;
    
    // Si se proporciona un nuevo saldo directo
    if (req.body.newBalance !== undefined) {
      newBalance = req.body.newBalance;
      shouldCreateTransaction = true;
      transactionData = {
        type: newBalance > previousBalance ? 'deposit' : 'withdrawal',
        amount: Math.abs(newBalance - previousBalance),
        description: description || `Ajuste manual de saldo - ${bank.name}`
      };
    } 
    // Si se proporciona una transacción
    else if (transactionType && amount) {
      if (transactionType === 'deposit') {
        newBalance = previousBalance + amount;
      } else if (transactionType === 'withdrawal') {
        if (amount > previousBalance) {
          return res.status(400).json({
            success: false,
            message: 'El monto excede el saldo disponible'
          });
        }
        newBalance = previousBalance - amount;
      }
      shouldCreateTransaction = true;
      transactionData = {
        type: transactionType,
        amount: amount,
        description: description || `Transacción manual - ${bank.name}`
      };
    }
    
    bank.currentBalance = newBalance;
    await bank.save();
    
    // Crear transacción bancaria si es necesario
    if (shouldCreateTransaction && transactionData) {
      try {
        const BankTransactionModel = req.tenantModels?.BankTransaction || (await import('../models/BankTransaction.js')).default;
        
        await BankTransactionModel.create({
          bank: bank._id,
          type: transactionData.type,
          amount: transactionData.amount,
          previousBalance: previousBalance,
          newBalance: newBalance,
          description: transactionData.description,
          reference: bank._id.toString(),
          referenceType: 'manual',
          createdBy: req.user.id
        });
        
      } catch (transactionError) {
        // No fallar la actualización del banco por error en transacción
      }
    }
    
    res.json({
      success: true,
      data: bank,
      message: 'Saldo actualizado correctamente'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor' 
    });
  }
});

// @desc    Obtener estadísticas de cuentas bancarias
// @route   GET /api/banks/stats/summary
// @access  Private
router.get('/stats/summary', protect, identifyTenant, async (req, res) => {
  try {
    const query = { isActive: true };
    
    const BankModel = req.tenantModels?.Bank || Bank;
    const banks = await BankModel.find(query);
    
    const stats = {
      totalBalance: banks.reduce((sum, bank) => sum + bank.currentBalance, 0),
      totalAccounts: banks.length,
      accountTypes: [...new Set(banks.map(bank => bank.type))].length,
      currencyBreakdown: {},
      typeBreakdown: {}
    };
    
    // Desglose por moneda
    banks.forEach(bank => {
      if (!stats.currencyBreakdown[bank.currency]) {
        stats.currencyBreakdown[bank.currency] = 0;
      }
      stats.currencyBreakdown[bank.currency] += bank.currentBalance;
    });
    
    // Desglose por tipo
    banks.forEach(bank => {
      if (!stats.typeBreakdown[bank.type]) {
        stats.typeBreakdown[bank.type] = { count: 0, balance: 0 };
      }
      stats.typeBreakdown[bank.type].count += 1;
      stats.typeBreakdown[bank.type].balance += bank.currentBalance;
    });
    
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
