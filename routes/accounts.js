import express from 'express';
import mongoose from 'mongoose';
import Account from '../models/Account.js';
import { protect } from '../middleware/auth.js';
import { identifyTenant } from '../middleware/tenant.js';

const router = express.Router();

// Aplicar middleware de autenticación y tenant a todas las rutas
router.use(protect);
router.use(identifyTenant);

// GET /api/accounts - Obtener todas las cuentas del tenant
router.get('/', async (req, res) => {
  try {
    const AccountModel = req.tenantModels?.Account || Account;
    
    const { type, search, parentId } = req.query;
    
    let query = { 
      isActive: true
    };

    if (type) {
      query.type = type;
    }

    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    if (parentId) {
      if (parentId === 'null' || parentId === '') {
        query.parentId = null;
      } else {
        query.parentId = parentId;
      }
    }

    const accounts = await AccountModel.find(query)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ code: 1 });


    // Organizar en estructura jerárquica
    const buildHierarchy = (accounts, parentId = null) => {
      const filteredAccounts = accounts.filter(account => {
        if (parentId === null) {
          return !account.parentId;
        }
        
        return account.parentId && account.parentId.toString() === parentId.toString();
      });
             
      return filteredAccounts.map(account => {
        return {
          ...account.toObject(),
          id: account._id.toString(),
          children: buildHierarchy(accounts, account._id.toString())
        };
      });
    };


    const hierarchicalAccounts = buildHierarchy(accounts);

    res.json({
      success: true,
      data: hierarchicalAccounts,
      flat: accounts.map(account => ({
        id: account._id,
        code: account.code,
        name: account.name,
        type: account.type,
        level: account.level,
        parentId: account.parentId,
        isActive: account.isActive,
        description: account.description
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener cuentas contables',
      error: error.message
    });
  }
});

// GET /api/accounts/flat - Obtener cuentas en formato plano
router.get('/flat', async (req, res) => {
  try {
    const AccountModel = req.tenantModels?.Account || Account;
    
    const { type, search } = req.query;
    
    let query = { 
      isActive: true
    };

    if (type) {
      query.type = type;
    }

    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    const accounts = await AccountModel.find(query)
      .populate('parentId', 'code name')
      .sort({ code: 1 });


    res.json({
      success: true,
      data: accounts.map(account => ({
        id: account._id,
        code: account.code,
        name: account.name,
        type: account.type,
        level: account.level,
        parentId: account.parentId,
        isActive: account.isActive,
        description: account.description,
        fullPath: account.fullPath
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener cuentas contables',
      error: error.message
    });
  }
});

// GET /api/accounts/:id - Obtener una cuenta específica
router.get('/:id', async (req, res) => {
  try {
    const AccountModel = req.tenantModels?.Account || Account;
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cuenta no válido'
      });
    }

    const account = await AccountModel.findOne({ 
      _id: id
    })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('parentId', 'code name');

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Cuenta no encontrada'
      });
    }

    res.json({
      success: true,
      data: account
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener cuenta contable',
      error: error.message
    });
  }
});

// POST /api/accounts - Crear nueva cuenta
router.post('/', async (req, res) => {
  try {
    const AccountModel = req.tenantModels?.Account || Account;
    const { code, name, type, level, parentId, description } = req.body;
    
    // Validar que el código sea único
    const existingAccount = await AccountModel.findOne({ 
      code, 
    });

    if (existingAccount) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una cuenta con este código'
      });
    }

    // Validar parentId si se proporciona
    if (parentId) {
      const parentAccount = await AccountModel.findOne({ 
        _id: parentId    });

      if (!parentAccount) {
        return res.status(400).json({
          success: false,
          message: 'Cuenta padre no encontrada'
        });
      }
    }

    const account = new AccountModel({
      code,
      name,
      type,
      level: level || 1,
      parentId: parentId || null,
      description: description || '',
      createdBy: req.user.id,
      updatedBy: req.user.id
    });

    await account.save();
    await account.populate('createdBy', 'name email');
    await account.populate('updatedBy', 'name email');
    await account.populate('parentId', 'code name');


    res.status(201).json({
      success: true,
      message: 'Cuenta creada exitosamente',
      data: account
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al crear cuenta contable',
      error: error.message
    });
  }
});

// PUT /api/accounts/:id - Actualizar cuenta
router.put('/:id', async (req, res) => {
  try {
    const AccountModel = req.tenantModels?.Account || Account;
    const { id } = req.params;
    const { code, name, type, level, parentId, description, isActive } = req.body;
    
  

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cuenta no válido'
      });
    }

    const account = await AccountModel.findOne({ 
      _id: id 
       });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Cuenta no encontrada'
      });
    }

    // Validar que el código sea único (si cambió)
    if (code && code !== account.code) {
      const existingAccount = await AccountModel.findOne({ 
        code, 
        _id: { $ne: id }
      });

      if (existingAccount) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe una cuenta con este código'
        });
      }
    }

    // Validar parentId si se proporciona
    if (parentId && parentId !== account.parentId?.toString()) {
      if (parentId === 'null' || parentId === '') {
        account.parentId = null;
      } else {
        const parentAccount = await AccountModel.findOne({ 
          _id: parentId        });

        if (!parentAccount) {
          return res.status(400).json({
            success: false,
            message: 'Cuenta padre no encontrada'
          });
        }
        account.parentId = parentId;
      }
    }

    // Actualizar campos
    if (code) account.code = code;
    if (name) account.name = name;
    if (type) account.type = type;
    if (level) account.level = level;
    if (description !== undefined) account.description = description;
    if (isActive !== undefined) account.isActive = isActive;
    
    account.updatedBy = req.user.id;

    await account.save();
    await account.populate('createdBy', 'name email');
    await account.populate('updatedBy', 'name email');
    await account.populate('parentId', 'code name');


    res.json({
      success: true,
      message: 'Cuenta actualizada exitosamente',
      data: account
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar cuenta contable',
      error: error.message
    });
  }
});

// DELETE /api/accounts/:id - Eliminar cuenta (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const AccountModel = req.tenantModels?.Account || Account;
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cuenta no válido'
      });
    }

    const account = await AccountModel.findOne({ 
      _id: id    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Cuenta no encontrada'
      });
    }

    // Verificar si tiene cuentas hijas
    const children = await AccountModel.find({ 
      parentId: id,
      isActive: true
    });

    if (children.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar una cuenta que tiene cuentas hijas'
      });
    }

    // Soft delete
    account.isActive = false;
    account.updatedBy = req.user.id;
    await account.save();


    res.json({
      success: true,
      message: 'Cuenta eliminada exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al eliminar cuenta contable',
      error: error.message
    });
  }
});

export default router;
