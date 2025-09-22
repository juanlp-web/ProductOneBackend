import express from 'express';
import Config from '../models/Config.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @desc    Obtener todas las configuraciones
// @route   GET /api/config
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const configs = await Config.find({ isActive: true }).sort({ key: 1 });
    res.json(configs);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener configuración por clave
// @route   GET /api/config/:key
// @access  Private
router.get('/:key', protect, async (req, res) => {
  try {
    const config = await Config.getByKey(req.params.key);
    if (config === null) {
      return res.status(404).json({ message: 'Configuración no encontrada' });
    }
    res.json({ key: req.params.key, value: config });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Crear o actualizar configuración
// @route   POST /api/config
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { key, value, type, description } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ message: 'Clave y valor son requeridos' });
    }

    const config = await Config.setByKey(key, value, type, description, req.user.id);
    res.status(201).json(config);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Actualizar configuración
// @route   PUT /api/config/:key
// @access  Private
router.put('/:key', protect, async (req, res) => {
  try {
    const { value, type, description } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ message: 'Valor es requerido' });
    }

    const config = await Config.setByKey(req.params.key, value, type, description, req.user.id);
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Eliminar configuración (marcar como inactiva)
// @route   DELETE /api/config/:key
// @access  Private
router.delete('/:key', protect, async (req, res) => {
  try {
    const config = await Config.findOneAndUpdate(
      { key: req.params.key },
      { isActive: false, updatedBy: req.user.id },
      { new: true }
    );

    if (!config) {
      return res.status(404).json({ message: 'Configuración no encontrada' });
    }

    res.json({ message: 'Configuración eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// @desc    Obtener configuraciones como objeto plano
// @route   GET /api/config/values/all
// @access  Private
router.get('/values/all', protect, async (req, res) => {
  try {
    const configs = await Config.getAllActive();
    res.json(configs);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

export default router;
