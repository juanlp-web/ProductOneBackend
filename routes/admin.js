import express from 'express';
import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import { protect, admin } from '../middleware/auth.js';
import { identifyTenant, requireTenant } from '../middleware/tenant.js';

const router = express.Router();

// Aplicar middleware de autenticación y admin a todas las rutas
router.use(protect);
router.use(admin);

// @desc    Obtener todos los tenants
// @route   GET /api/admin/tenants
// @access  Private/Admin
router.get('/tenants', async (req, res) => {
  try {
    
    const { page = 1, limit = 10, status, plan, search } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (plan) query.plan = plan;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { subdomain: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } }
      ];
    }

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

// @desc    Crear nuevo tenant
// @route   POST /api/admin/tenants
// @access  Private/Admin
router.post('/tenants', async (req, res) => {
  try {
    
    const {
      name,
      subdomain,
      companyName,
      companyEmail,
      companyPhone,
      companyAddress,
      database,
      plan = 'free',
      status = 'trial',
      limits,
      features,
      customization,
      adminUser
    } = req.body;

    // Verificar que el subdominio no esté en uso
    const existingTenant = await Tenant.findOne({ subdomain });
    if (existingTenant) {
      return res.status(400).json({
        success: false,
        message: 'El subdominio ya está en uso'
      });
    }

    // Crear tenant con todos los campos
    const tenantData = {
      name,
      subdomain,
      companyName,
      companyEmail,
      companyPhone,
      plan,
      status,
      isActive: status === 'active',
      isTrialExpired: false,
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
    };

    // Agregar campos opcionales si existen
    if (companyAddress) {
      tenantData.companyAddress = companyAddress;
    }
    
    if (database) {
      tenantData.database = database;
    }
    
    if (limits) {
      tenantData.limits = limits;
    }
    
    if (features) {
      tenantData.features = features;
    }
    
    if (customization) {
      tenantData.customization = customization;
    }
    
    if (adminUser) {
      tenantData.adminUser = adminUser;
    }


    const tenant = await Tenant.create(tenantData);

    // Si se especificó un admin, asignar el tenant
    if (adminUser) {
      await User.findByIdAndUpdate(adminUser, {
        tenantId: tenant._id,
        tenantRole: 'owner'
      });
    }

    const populatedTenant = await Tenant.findById(tenant._id)
      .populate('adminUser', 'username email firstName lastName');

    res.status(201).json({
      success: true,
      data: populatedTenant
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creando tenant'
    });
  }
});

// @desc    Actualizar tenant
// @route   PUT /api/admin/tenants/:id
// @access  Private/Admin
router.put('/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de tenant inválido'
      });
    }

    // Verificar que el subdominio no esté en uso por otro tenant
    if (updateData.subdomain) {
      const existingTenant = await Tenant.findOne({ 
        subdomain: updateData.subdomain, 
        _id: { $ne: id } 
      });
      if (existingTenant) {
        return res.status(400).json({
          success: false,
          message: 'El subdominio ya está en uso por otro tenant'
        });
      }
    }

    const tenant = await Tenant.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('adminUser', 'username email firstName lastName');

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant no encontrado'
      });
    }

    res.json({
      success: true,
      data: tenant
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error actualizando tenant'
    });
  }
});

// @desc    Eliminar tenant
// @route   DELETE /api/admin/tenants/:id
// @access  Private/Admin
router.delete('/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de tenant inválido'
      });
    }

    const tenant = await Tenant.findByIdAndDelete(id);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant no encontrado'
      });
    }

    // Remover tenant de todos los usuarios
    await User.updateMany(
      { tenantId: id },
      { $unset: { tenantId: 1, tenantRole: 1 } }
    );

    res.json({
      success: true,
      message: 'Tenant eliminado correctamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error eliminando tenant'
    });
  }
});

// @desc    Obtener usuarios sin tenant
// @route   GET /api/admin/users/without-tenant
// @access  Private/Admin
router.get('/users/without-tenant', async (req, res) => {
  try {
    
    const users = await User.find({ 
      tenantId: { $exists: false } 
    }).select('username email firstName lastName role createdAt');

    res.json({
      success: true,
      data: users
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo usuarios sin tenant'
    });
  }
});

// @desc    Obtener todos los usuarios con información de tenant
// @route   GET /api/admin/users/all
// @access  Private/Admin
router.get('/users/all', identifyTenant, async (req, res) => {
  try {
    
    let users;

      // Si no hay tenant, usar la base de datos principal
      users = await User.find({})
        .select('-password')
        .populate('tenantId', 'name companyName subdomain status plan')
        .sort({ createdAt: -1 });
 
    res.json({ 
      success: true, 
      data: users 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener todos los usuarios', 
      error: error.message 
    });
  }
});

// @desc    Crear nuevo usuario
// @route   POST /api/admin/users
// @access  Private/Admin
router.post('/users', identifyTenant, async (req, res) => {
  try {
    
    const {
      firstName,
      lastName,
      username,
      email,
      password,
      role = 'user',
      isActive = true
    } = req.body;

    // Verificar que el email no esté en uso
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está en uso'
      });
    }

    // Verificar que el username no esté en uso
    const existingUserByUsername = await User.findOne({ username });
    if (existingUserByUsername) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de usuario ya está en uso'
      });
    }

    // Crear usuario
    const user = await User.create({
      firstName,
      lastName,
      username,
      email,
      password,
      role,
      isActive,
      emailVerified: false
    });

    // Remover password del objeto de respuesta
    const userResponse = user.toObject();
    delete userResponse.password;


    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: userResponse
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creando usuario',
      error: error.message
    });
  }
});

// @desc    Asignar tenant a usuario
// @route   POST /api/admin/users/:userId/assign-tenant
// @access  Private/Admin
router.post('/users/:userId/assign-tenant', async (req, res) => {
  try {
    const { userId } = req.params;
    const { tenantId, tenantRole = 'user' } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario inválido'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de tenant inválido'
      });
    }

    // Verificar que el usuario existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar que el tenant existe
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant no encontrado'
      });
    }

    // Asignar tenant al usuario
    user.tenantId = tenantId;
    user.tenantRole = tenantRole;
    await user.save();

    const updatedUser = await User.findById(userId)
      .populate('tenantId', 'name subdomain companyName');

    res.json({
      success: true,
      data: updatedUser
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error asignando tenant a usuario'
    });
  }
});

// @desc    Remover tenant de usuario
// @route   POST /api/admin/users/:userId/remove-tenant
// @access  Private/Admin
router.post('/users/:userId/remove-tenant', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario inválido'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Remover tenant del usuario
    user.tenantId = undefined;
    user.tenantRole = undefined;
    await user.save();

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error removiendo tenant de usuario'
    });
  }
});

// @desc    Obtener estadísticas de administración
// @route   GET /api/admin/stats
// @access  Private/Admin
router.get('/stats', async (req, res) => {
  try {
    
    const totalTenants = await Tenant.countDocuments();
    const activeTenants = await Tenant.countDocuments({ status: 'active' });
    const totalUsers = await User.countDocuments();
    const usersWithTenant = await User.countDocuments({ tenantId: { $exists: true } });
    const usersWithoutTenant = totalUsers - usersWithTenant;

    res.json({
      success: true,
      data: {
        tenants: {
          total: totalTenants,
          active: activeTenants,
          inactive: totalTenants - activeTenants
        },
        users: {
          total: totalUsers,
          withTenant: usersWithTenant,
          withoutTenant: usersWithoutTenant
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas'
    });
  }
});

export default router;
