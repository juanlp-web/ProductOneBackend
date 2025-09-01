import express from 'express';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @desc    Obtener perfil del usuario autenticado
// @route   GET /api/profile
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener perfil',
      error: error.message
    });
  }
});

// @desc    Actualizar perfil del usuario
// @route   PUT /api/profile
// @access  Private
router.put('/', protect, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      address,
      birthDate,
      emailNotifications,
      pushNotifications,
      darkMode
    } = req.body;

    // Validar que el usuario existe
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Actualizar campos permitidos
    const updateFields = {};
    if (firstName !== undefined) updateFields.firstName = firstName;
    if (lastName !== undefined) updateFields.lastName = lastName;
    if (phone !== undefined) updateFields.phone = phone;
    if (address !== undefined) updateFields.address = address;
    if (birthDate !== undefined) updateFields.birthDate = birthDate;
    if (emailNotifications !== undefined) updateFields.emailNotifications = emailNotifications;
    if (pushNotifications !== undefined) updateFields.pushNotifications = pushNotifications;
    if (darkMode !== undefined) updateFields.darkMode = darkMode;

    // Actualizar usuario
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updateFields,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Perfil actualizado correctamente',
      data: updatedUser
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil',
      error: error.message
    });
  }
});

// @desc    Cambiar contraseña
// @route   PUT /api/profile/change-password
// @access  Private
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Contraseña actual y nueva contraseña son requeridas'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 6 caracteres'
      });
    }

    // Obtener usuario con contraseña
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar contraseña actual
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Contraseña actual incorrecta'
      });
    }

    // Actualizar contraseña
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Contraseña cambiada correctamente'
    });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar contraseña',
      error: error.message
    });
  }
});

// @desc    Obtener historial de accesos
// @route   GET /api/profile/login-history
// @access  Private
router.get('/login-history', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('loginHistory');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Ordenar por fecha más reciente
    const sortedHistory = user.loginHistory.sort((a, b) => b.date - a.date);

    res.json({
      success: true,
      data: sortedHistory
    });
  } catch (error) {
    console.error('Error al obtener historial de accesos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial de accesos',
      error: error.message
    });
  }
});

// @desc    Actualizar configuración de notificaciones
// @route   PUT /api/profile/notifications
// @access  Private
router.put('/notifications', protect, async (req, res) => {
  try {
    const { emailNotifications, pushNotifications } = req.body;

    const updateFields = {};
    if (emailNotifications !== undefined) updateFields.emailNotifications = emailNotifications;
    if (pushNotifications !== undefined) updateFields.pushNotifications = pushNotifications;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updateFields,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Configuración de notificaciones actualizada',
      data: updatedUser
    });
  } catch (error) {
    console.error('Error al actualizar notificaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar notificaciones',
      error: error.message
    });
  }
});

// @desc    Actualizar preferencias de tema
// @route   PUT /api/profile/theme
// @access  Private
router.put('/theme', protect, async (req, res) => {
  try {
    const { darkMode } = req.body;

    if (darkMode === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Preferencia de tema es requerida'
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { darkMode },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Preferencia de tema actualizada',
      data: updatedUser
    });
  } catch (error) {
    console.error('Error al actualizar tema:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar tema',
      error: error.message
    });
  }
});

export default router;
