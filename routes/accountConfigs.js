import express from 'express';
import mongoose from 'mongoose';
import AccountConfig from '../models/AccountConfig.js';
import Account from '../models/Account.js';
import { protect } from '../middleware/auth.js';
import { identifyTenant } from '../middleware/tenant.js';

const router = express.Router();

// Aplicar middleware de autenticación y tenant a todas las rutas
router.use(protect);
router.use(identifyTenant);

// GET /api/account-configs - Obtener todas las configuraciones del tenant
router.get('/', async (req, res) => {
  try {
    const AccountConfigModel = req.tenantModels?.AccountConfig || AccountConfig;
    const AccountModel = req.tenantModels?.Account || Account;

    const configs = await AccountConfigModel.find({  })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ module: 1 });


    // Convertir a formato más fácil de usar en el frontend
    const configsByModule = {};
    configs.forEach(config => {
      configsByModule[config.module] = {};
      config.configurations.forEach((value, key) => {
        configsByModule[config.module][key] = {
          id: value.accountId,
          code: value.accountCode,
          name: value.accountName,
          type: value.accountType
        };
      });
    });

    res.json({
      success: true,
      data: configsByModule
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener configuraciones contables',
      error: error.message
    });
  }
});

// GET /api/account-configs/:module - Obtener configuración de un módulo específico
router.get('/:module', async (req, res) => {
  try {
    const AccountConfigModel = req.tenantModels?.AccountConfig || AccountConfig;
    const AccountModel = req.tenantModels?.Account || Account;
    const { module } = req.params;
    
    
    if (!['ventas', 'compras', 'bancos', 'clientes', 'proveedores'].includes(module)) {
      return res.status(400).json({
        success: false,
        message: 'Módulo no válido'
      });
    }

    const config = await AccountConfigModel.findOne({ 
      tenant: req.tenant._id, 
      module 
    }).populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!config) {
      return res.json({
        success: true,
        data: {}
      });
    }

    // Convertir a formato más fácil de usar
    const configData = {};
    config.configurations.forEach((value, key) => {
      configData[key] = {
        id: value.accountId,
        code: value.accountCode,
        name: value.accountName,
        type: value.accountType
      };
    });

    res.json({
      success: true,
      data: configData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener configuración del módulo',
      error: error.message
    });
  }
});

// PUT /api/account-configs/:module - Actualizar configuración de un módulo
router.put('/:module', async (req, res) => {
  try {
    const AccountConfigModel = req.tenantModels?.AccountConfig || AccountConfig;
    const AccountModel = req.tenantModels?.Account || Account;
    const { module } = req.params;
    const { configurations } = req.body;
    

    if (!['ventas', 'compras', 'bancos', 'clientes', 'proveedores'].includes(module)) {
      return res.status(400).json({
        success: false,
        message: 'Módulo no válido'
      });
    }

    // Validar que las cuentas existan
    const accountIds = Object.values(configurations).map(config => config.id);
    const accounts = await AccountModel.find({ 
      _id: { $in: accountIds },
      isActive: true
    });

    if (accounts.length !== accountIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Una o más cuentas no existen o no están activas'
      });
    }

    // Crear mapa de cuentas para validación
    const accountMap = {};
    accounts.forEach(account => {
      accountMap[account._id.toString()] = account;
    });

    // Preparar configuraciones para guardar
    const configMap = new Map();
    Object.entries(configurations).forEach(([key, config]) => {
      const account = accountMap[config.id];
      if (account) {
        configMap.set(key, {
          accountId: account._id,
          accountCode: account.code,
          accountName: account.name,
          accountType: account.type
        });
      }
    });

    // Buscar configuración existente o crear nueva
    let accountConfig = await AccountConfigModel.findOne({ 
      tenant: req.tenant._id, 
      module 
    });

    if (accountConfig) {
      // Actualizar configuración existente
      accountConfig.configurations = configMap;
      accountConfig.updatedBy = req.user.id;
      await accountConfig.save();
    } else {
      // Crear nueva configuración
      accountConfig = new AccountConfigModel({
        tenant: req.tenant._id,
        module,
        configurations: configMap,
        createdBy: req.user.id,
        updatedBy: req.user.id
      });
      await accountConfig.save();
    }

    // Poblar referencias para la respuesta
    await accountConfig.populate('createdBy', 'name email');
    await accountConfig.populate('updatedBy', 'name email');

    // Convertir a formato de respuesta
    const responseData = {};
    accountConfig.configurations.forEach((value, key) => {
      responseData[key] = {
        id: value.accountId,
        code: value.accountCode,
        name: value.accountName,
        type: value.accountType
      };
    });


    res.json({
      success: true,
      message: 'Configuración guardada exitosamente',
      data: responseData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar configuración contable',
      error: error.message
    });
  }
});

// POST /api/account-configs - Crear o actualizar múltiples configuraciones
router.post('/', async (req, res) => {
  try {
    const AccountConfigModel = req.tenantModels?.AccountConfig || AccountConfig;
    const AccountModel = req.tenantModels?.Account || Account;
    const { configs } = req.body;

    const results = {};

    for (const [module, configurations] of Object.entries(configs)) {
      if (!['ventas', 'compras', 'bancos', 'clientes', 'proveedores'].includes(module)) {
        continue;
      }

      // Validar que las cuentas existan
      const accountIds = Object.values(configurations).map(config => config.id);
      const accounts = await AccountModel.find({ 
        _id: { $in: accountIds },
        tenant: req.tenant._id,
        isActive: true
      });

      if (accounts.length !== accountIds.length) {
        continue;
      }

      // Crear mapa de cuentas
      const accountMap = {};
      accounts.forEach(account => {
        accountMap[account._id.toString()] = account;
      });

      // Preparar configuraciones
      const configMap = new Map();
      Object.entries(configurations).forEach(([key, config]) => {
        const account = accountMap[config.id];
        if (account) {
          configMap.set(key, {
            accountId: account._id,
            accountCode: account.code,
            accountName: account.name,
            accountType: account.type
          });
        }
      });

      // Buscar o crear configuración
      let accountConfig = await AccountConfigModel.findOne({ 
        tenant: req.tenant._id, 
        module 
      });

      if (accountConfig) {
        accountConfig.configurations = configMap;
        accountConfig.updatedBy = req.user.id;
        await accountConfig.save();
      } else {
        accountConfig = new AccountConfigModel({
          tenant: req.tenant._id,
          module,
          configurations: configMap,
          createdBy: req.user.id,
          updatedBy: req.user.id
        });
        await accountConfig.save();
      }

      // Convertir a formato de respuesta
      results[module] = {};
      accountConfig.configurations.forEach((value, key) => {
        results[module][key] = {
          id: value.accountId,
          code: value.accountCode,
          name: value.accountName,
          type: value.accountType
        };
      });
    }


    res.json({
      success: true,
      message: 'Configuraciones guardadas exitosamente',
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al guardar configuraciones contables',
      error: error.message
    });
  }
});

export default router;
