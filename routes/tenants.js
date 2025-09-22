import express from 'express';
import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import { protect, admin } from '../middleware/auth.js';
import { identifyTenant, requireTenant, checkTenantLimits, getModel } from '../middleware/tenant.js';
import databaseManager from '../services/DatabaseManager.js';

const router = express.Router();

// @desc    Crear nuevo tenant (registro de empresa)
// @route   POST /api/tenants/register
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { 
      subdomain, 
      companyName, 
      companyEmail, 
      companyPhone,
      adminUser: { username, email, password, firstName, lastName }
    } = req.body;

    // Verificar que el subdominio no esté en uso
    const existingTenant = await Tenant.findBySubdomain(subdomain);
    if (existingTenant) {
      return res.status(400).json({
        success: false,
        message: 'El subdominio ya está en uso'
      });
    }

    // Verificar que el email del admin no esté en uso
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // Crear usuario administrador primero (en BD principal)
    const adminUser = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      role: 'admin',
      tenantRole: 'owner',
      emailVerified: false
    });

    // Crear tenant
    const tenant = await Tenant.create({
      name: companyName,
      subdomain: subdomain.toLowerCase(),
      companyName,
      companyEmail,
      companyPhone,
      adminUser: adminUser._id,
      database: {
        connectionString: process.env.MONGODB_URI, // Usar la misma conexión por ahora
        databaseName: `tenant_${subdomain.toLowerCase()}_${Date.now()}`,
        isShared: false
      },
      status: 'trial'
    });

    // Actualizar usuario con tenantId
    adminUser.tenantId = tenant._id;
    await adminUser.save();

    // Inicializar base de datos del tenant
    await databaseManager.initializeTenantDatabase(tenant);

    // Crear usuario admin en la BD del tenant también
    const tenantModels = await databaseManager.getTenantModels(tenant);
    await tenantModels.User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      role: 'admin',
      tenantRole: 'owner',
      tenantId: tenant._id,
      emailVerified: false
    });

    res.status(201).json({
      success: true,
      message: 'Tenant creado exitosamente',
      data: {
        tenant: {
          id: tenant._id,
          subdomain: tenant.subdomain,
          companyName: tenant.companyName,
          status: tenant.status,
          plan: tenant.plan,
          trialEndsAt: tenant.trialEndsAt
        },
        adminUser: {
          id: adminUser._id,
          username: adminUser.username,
          email: adminUser.email,
          role: adminUser.role,
          tenantRole: adminUser.tenantRole
        },
        accessInfo: {
          url: `https://${tenant.subdomain}.${process.env.BASE_DOMAIN || 'localhost:5173'}`,
          databaseName: tenant.database.databaseName
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// @desc    Obtener información del tenant actual
// @route   GET /api/tenants/current
// @access  Private (con tenant)
router.get('/current', identifyTenant, requireTenant, protect, async (req, res) => {
  try {
    const tenant = req.tenant;
    
    // Obtener estadísticas del tenant
    const stats = await Promise.all([
      req.tenantModels.User.countDocuments(),
      req.tenantModels.Product.countDocuments(),
      req.tenantModels.Client.countDocuments(),
      req.tenantModels.Supplier.countDocuments()
    ]);

    res.json({
      success: true,
      data: {
        tenant: {
          id: tenant._id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          companyName: tenant.companyName,
          companyEmail: tenant.companyEmail,
          plan: tenant.plan,
          status: tenant.status,
          trialEndsAt: tenant.trialEndsAt,
          subscriptionEndsAt: tenant.subscriptionEndsAt,
          features: tenant.features,
          limits: tenant.limits,
          customization: tenant.customization
        },
        stats: {
          users: stats[0],
          products: stats[1],
          clients: stats[2],
          suppliers: stats[3]
        },
        usage: {
          usersPercentage: tenant.limits.maxUsers > 0 ? (stats[0] / tenant.limits.maxUsers) * 100 : 0,
          productsPercentage: tenant.limits.maxProducts > 0 ? (stats[1] / tenant.limits.maxProducts) * 100 : 0
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo información del tenant'
    });
  }
});

// @desc    Actualizar configuración del tenant
// @route   PUT /api/tenants/current
// @access  Private (solo owner/admin del tenant)
router.put('/current', identifyTenant, requireTenant, protect, async (req, res) => {
  try {
    // Verificar que el usuario sea owner o admin del tenant
    if (req.user.tenantRole !== 'owner' && req.user.tenantRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para actualizar la configuración del tenant'
      });
    }

    const { companyName, companyEmail, companyPhone, customization } = req.body;
    const tenant = req.tenant;

    // Actualizar campos permitidos
    if (companyName) tenant.companyName = companyName;
    if (companyEmail) tenant.companyEmail = companyEmail;
    if (companyPhone) tenant.companyPhone = companyPhone;
    if (customization) {
      tenant.customization = { ...tenant.customization, ...customization };
    }

    await tenant.save();

    res.json({
      success: true,
      message: 'Configuración actualizada exitosamente',
      data: tenant
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error actualizando configuración'
    });
  }
});

// @desc    Upgrade de plan del tenant
// @route   POST /api/tenants/upgrade
// @access  Private (solo owner del tenant)
router.post('/upgrade', identifyTenant, requireTenant, protect, async (req, res) => {
  try {
    // Verificar que el usuario sea owner del tenant
    if (req.user.tenantRole !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Solo el propietario puede actualizar el plan'
      });
    }

    const { plan } = req.body;
    const tenant = req.tenant;

    if (!['basic', 'premium', 'enterprise'].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: 'Plan inválido'
      });
    }

    // Simular upgrade (aquí iría la integración con el sistema de pagos)
    switch (plan) {
      case 'basic':
        await tenant.upgradeToBasic();
        break;
      case 'enterprise':
        await tenant.upgradeToEnterprise();
        break;
      // Agregar más planes según necesidad
    }

    res.json({
      success: true,
      message: `Plan actualizado a ${plan} exitosamente`,
      data: {
        plan: tenant.plan,
        features: tenant.features,
        limits: tenant.limits,
        status: tenant.status
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error actualizando plan'
    });
  }
});

// @desc    Obtener todos los tenants (solo super admin)
// @route   GET /api/tenants
// @access  Private (solo super admin)
router.get('/', protect, admin, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, plan } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (plan) query.plan = plan;

    const tenants = await Tenant.find(query)
      .populate('adminUser', 'username email firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Tenant.countDocuments(query);

    res.json({
      success: true,
      data: {
        tenants,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo tenants'
    });
  }
});

// @desc    Suspender/activar tenant (solo super admin)
// @route   PUT /api/tenants/:id/status
// @access  Private (solo super admin)
router.put('/:id/status', protect, admin, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'suspended', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Estado inválido'
      });
    }

    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant no encontrado'
      });
    }

    tenant.status = status;
    await tenant.save();

    res.json({
      success: true,
      message: `Tenant ${status === 'suspended' ? 'suspendido' : 'activado'} exitosamente`,
      data: tenant
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error actualizando estado'
    });
  }
});

// @desc    Obtener tenants del usuario actual
// @route   GET /api/tenants/current
// @access  Private
router.get('/current', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('tenantId', 'name subdomain _id companyName plan status');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Si el usuario tiene un tenant asignado, devolverlo
    if (user.tenantId) {
      return res.json({
        success: true,
        data: {
          tenants: [user.tenantId]
        }
      });
    }

    // Si no tiene tenant, devolver array vacío
    res.json({
      success: true,
      data: {
        tenants: []
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo tenants'
    });
  }
});

export default router;
