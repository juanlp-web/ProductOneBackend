import express from 'express';
import Supplier from '../models/Supplier.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Middleware para todas las rutas
router.use(protect);

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
    const suppliers = await Supplier.find(filters)
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip(skip)
      .select('-__v');

    // Contar total de documentos
    const total = await Supplier.countDocuments(filters);

    // Calcular estadísticas
    const stats = await Supplier.getStats();

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
    console.error('Error al obtener proveedores:', error);
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
    const supplier = await Supplier.findById(req.params.id).select('-__v');
    
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
    console.error('Error al obtener proveedor:', error);
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

    const supplier = new Supplier(supplierData);
    await supplier.save();

    res.status(201).json({
      success: true,
      message: 'Proveedor creado exitosamente',
      data: supplier
    });
  } catch (error) {
    console.error('Error al crear proveedor:', error);
    
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

    // Verificar si el proveedor existe
    const existingSupplier = await Supplier.findById(supplierId);
    if (!existingSupplier) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    // No hay validaciones adicionales necesarias para la nueva estructura

    const updatedSupplier = await Supplier.findByIdAndUpdate(
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
    console.error('Error al actualizar proveedor:', error);
    
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
    const supplier = await Supplier.findById(req.params.id);
    
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
    console.error('Error al eliminar proveedor:', error);
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

    const supplier = await Supplier.findByIdAndUpdate(
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
    console.error('Error al cambiar estado del proveedor:', error);
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
    const stats = await Supplier.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
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
    const suppliers = await Supplier.findByCategory(category).select('-__v');
    
    res.json({
      success: true,
      data: suppliers
    });
  } catch (error) {
    console.error('Error al buscar proveedores por categoría:', error);
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
    const suppliers = await Supplier.findByStatus(status).select('-__v');
    
    res.json({
      success: true,
      data: suppliers
    });
  } catch (error) {
    console.error('Error al buscar proveedores por estado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar proveedores por estado',
      error: error.message
    });
  }
});

export default router;
