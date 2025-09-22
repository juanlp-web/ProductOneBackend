import express from 'express';
import Client from '../models/Client.js';
import { protect, manager } from '../middleware/auth.js';
import { identifyTenant } from '../middleware/tenant.js';

const router = express.Router();

// @desc    Obtener todos los clientes
// @route   GET /api/clients
// @access  Private
router.get('/', protect, identifyTenant, async (req, res) => {
  try {
    const ClientModel = req.tenantModels?.Client || Client;
    const { page = 1, limit = 10, search, type, status } = req.query;
    
    const query = {};
    
    // Filtro por estado
    if (status && status !== 'Todos los estados') {
      if (status === 'Activo') {
        query.isActive = true;
      } else if (status === 'Inactivo') {
        query.isActive = false;
      } else {
        // Para otros estados, usar el campo status si existe
        query.status = status;
      }
    }
    
    if (search) {
      query.$text = { $search: search };
    }
    
    if (type && type !== 'Todos los tipos') {
      query.type = type;
    }
    
    const clients = await ClientModel.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    
    const total = await ClientModel.countDocuments(query);
    
    res.json({
      success: true,
      data: clients,
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

// @desc    Obtener cliente por ID
// @route   GET /api/clients/:id
// @access  Private
router.get('/:id', protect, identifyTenant, async (req, res) => {
  try {
    const ClientModel = req.tenantModels?.Client || Client;
    const client = await ClientModel.findById(req.params.id);
    if (client) {
      res.json({
        success: true,
        data: client
      });
    } else {
      res.status(404).json({ 
        success: false,
        message: 'Cliente no encontrado' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor' 
    });
  }
});

// @desc    Crear cliente
// @route   POST /api/clients
// @access  Private (Manager/Admin)
router.post('/', protect, identifyTenant, manager, async (req, res) => {
  try {
    const ClientModel = req.tenantModels?.Client || Client;
    const client = await ClientModel.create(req.body);
    res.status(201).json({
      success: true,
      data: client
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor' 
    });
  }
});

// @desc    Actualizar cliente
// @route   PUT /api/clients/:id
// @access  Private (Manager/Admin)
router.put('/:id', protect, identifyTenant, manager, async (req, res) => {
  try {
    const ClientModel = req.tenantModels?.Client || Client;
    const client = await ClientModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (client) {
      res.json({
        success: true,
        data: client
      });
    } else {
      res.status(404).json({ 
        success: false,
        message: 'Cliente no encontrado' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor' 
    });
  }
});

// @desc    Eliminar cliente
// @route   DELETE /api/clients/:id
// @access  Private (Manager/Admin)
router.delete('/:id', protect, identifyTenant, manager, async (req, res) => {
  try {
    const ClientModel = req.tenantModels?.Client || Client;
    const client = await ClientModel.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (client) {
      res.json({ message: 'Cliente eliminado correctamente' });
    } else {
      res.status(404).json({ message: 'Cliente no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

export default router;
