import express from 'express';
import Supplier from '../models/Supplier.js';
import { protect, authorize } from '../middleware/auth.js';
import { identifyTenant } from '../middleware/tenant.js';

const router = express.Router();

// Middleware para todas las rutas
router.use(protect);
router.use(identifyTenant);

// @desc    Obtener todos los proveedores
// @route   GET /api/suppliers
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search, category, status, sortBy = 'name', sortOrder = 'asc' } = req.query;

    // Construir filtros
    const filters = { isActive: true };
    
    if (search) {
      filters.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contactName: { $regex: search, $options: 'i' } },
        { contactPhone: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category && category !== 'Todas las categorías') {
      filters.category = category;
    }
    
    if (status && status !== 'Todos los estados') {
      filters.status = status;
    }

    // Construir ordenamiento
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calcular paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Ejecutar consulta con paginación
    const SupplierModel = req.tenantModels?.Supplier || Supplier;
    const suppliers = await SupplierModel.find(filters)
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip(skip)
      .select('-__v');

    // Contar total de documentos
    const total = await SupplierModel.countDocuments(filters);

    // Calcular estadísticas
    const stats = await SupplierModel.getStats();

    res.json({
      success: true,
      data: suppliers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      },
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener proveedores',
      error: error.message
    });
  }
});

// @desc    Obtener un proveedor por ID
// @route   GET /api/suppliers/:id
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const SupplierModel = req.tenantModels?.Supplier || Supplier;
    const supplier = await SupplierModel.findById(req.params.id).select('-__v');
    
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener proveedor',
      error: error.message
    });
  }
});

// @desc    Crear un nuevo proveedor
// @route   POST /api/suppliers
// @access  Private (Admin, Manager)
router.post('/', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const supplierData = req.body;

    // Validar datos requeridos
    if (!supplierData.name) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del proveedor es requerido'
      });
    }

    const SupplierModel = req.tenantModels?.Supplier || Supplier;
    const supplier = new SupplierModel(supplierData);
    await supplier.save();

    res.status(201).json({
      success: true,
      message: 'Proveedor creado exitosamente',
      data: supplier
    });
  } catch (error) {
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al crear proveedor',
      error: error.message
    });
  }
});

// @desc    Actualizar un proveedor
// @route   PUT /api/suppliers/:id
// @access  Private (Admin, Manager)
router.put('/:id', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const supplierData = req.body;
    const supplierId = req.params.id;

    const SupplierModel = req.tenantModels?.Supplier || Supplier;
    
    // Verificar si el proveedor existe
    const existingSupplier = await SupplierModel.findById(supplierId);
    if (!existingSupplier) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    // No hay validaciones adicionales necesarias para la nueva estructura

    const updatedSupplier = await SupplierModel.findByIdAndUpdate(
      supplierId,
      supplierData,
      { new: true, runValidators: true }
    ).select('-__v');

    res.json({
      success: true,
      message: 'Proveedor actualizado exitosamente',
      data: updatedSupplier
    });
  } catch (error) {
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al actualizar proveedor',
      error: error.message
    });
  }
});

// @desc    Eliminar un proveedor (soft delete)
// @route   DELETE /api/suppliers/:id
// @access  Private (Admin)
router.delete('/:id', authorize(['admin']), async (req, res) => {
  try {
    const SupplierModel = req.tenantModels?.Supplier || Supplier;
    const supplier = await SupplierModel.findById(req.params.id);
    
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    // Soft delete - marcar como inactivo
    supplier.isActive = false;
    supplier.status = 'Inactivo';
    await supplier.save();

    res.json({
      success: true,
      message: 'Proveedor eliminado exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al eliminar proveedor',
      error: error.message
    });
  }
});

// @desc    Cambiar estado de un proveedor
// @route   PATCH /api/suppliers/:id/status
// @access  Private (Admin, Manager)
router.patch('/:id/status', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { status } = req.body;
    const supplierId = req.params.id;

    if (!['Activo', 'Inactivo', 'Pendiente', 'Bloqueado'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Estado inválido'
      });
    }

    const SupplierModel = req.tenantModels?.Supplier || Supplier;
    const supplier = await SupplierModel.findByIdAndUpdate(
      supplierId,
      { status },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Estado del proveedor actualizado exitosamente',
      data: supplier
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al cambiar estado del proveedor',
      error: error.message
    });
  }
});

// @desc    Obtener estadísticas de proveedores
// @route   GET /api/suppliers/stats/overview
// @access  Private
router.get('/stats/overview', async (req, res) => {
  try {
    const SupplierModel = req.tenantModels?.Supplier || Supplier;
    const stats = await SupplierModel.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
});

// @desc    Buscar proveedores por categoría
// @route   GET /api/suppliers/category/:category
// @access  Private
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const SupplierModel = req.tenantModels?.Supplier || Supplier;
    const suppliers = await SupplierModel.findByCategory(category).select('-__v');
    
    res.json({
      success: true,
      data: suppliers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al buscar proveedores por categoría',
      error: error.message
    });
  }
});

// @desc    Buscar proveedores por estado
// @route   GET /api/suppliers/status/:status
// @access  Private
router.get('/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const SupplierModel = req.tenantModels?.Supplier || Supplier;
    const suppliers = await SupplierModel.findByStatus(status).select('-__v');
    
    res.json({
      success: true,
      data: suppliers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al buscar proveedores por estado',
      error: error.message
    });
  }
});

export default router;
