import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import PasswordReset from '../models/PasswordReset.js';
import { protect } from '../middleware/auth.js';
import { 
  generateResetToken, 
  sendPasswordResetEmail, 
  sendPasswordChangedEmail 
} from '../services/emailService.js';

const router = express.Router();

// @desc    Registrar usuario
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role, firstName, lastName } = req.body;

    // Verificar si el usuario ya existe
    const userExists = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    if (userExists) {
      return res.status(400).json({ 
        success: false,
        message: 'El usuario ya existe con ese email o nombre de usuario' 
      });
    }

    // Crear usuario
    const user = await User.create({
      username,
      email,
      password,
      role: role || 'user',
      firstName,
      lastName
    });

    if (user) {
      res.status(201).json({
        success: true,
        data: {
          _id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          token: generateToken(user._id, user.tenantId)
        }
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor',
      error: error.message 
    });
  }
});

// @desc    Autenticar usuario
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar que se proporcione email y contraseña
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'El email es requerido'
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña es requerida'
      });
    }

    // Buscar usuario por email con información del tenant
    const user = await User.findOne({ email }).populate('tenantId', 'name subdomain _id');
    
    if (user && (await user.comparePassword(password))) {
      // Actualizar último login
      user.lastLogin = new Date();
      
      // Agregar entrada al historial de accesos
      const loginEntry = {
        date: new Date(),
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent') || 'Unknown',
        device: getDeviceType(req.get('User-Agent'))
      };
      
      user.loginHistory.push(loginEntry);
      await user.save();

      res.json({
        success: true,
        data: {
          _id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          tenant: user.tenantId,
          token: generateToken(user._id, user.tenantId)
        }
      });
    } else {
      res.status(401).json({ 
        success: false,
        message: 'Email o contraseña inválidos' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor',
      error: error.message 
    });
  }
});

// @desc    Obtener perfil del usuario
// @route   GET /api/auth/profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password').populate('tenantId', 'name subdomain _id');
    if (user) {
      res.json({
        success: true,
        data: user
      });
    } else {
      res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor',
      error: error.message 
    });
  }
});

// @desc    Actualizar perfil del usuario
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (user) {
      // Actualizar campos permitidos
      if (req.body.firstName !== undefined) user.firstName = req.body.firstName;
      if (req.body.lastName !== undefined) user.lastName = req.body.lastName;
      if (req.body.phone !== undefined) user.phone = req.body.phone;
      if (req.body.address !== undefined) user.address = req.body.address;
      if (req.body.birthDate !== undefined) user.birthDate = req.body.birthDate;
      
      const updatedUser = await user.save();
      
      res.json({
        success: true,
        data: {
          _id: updatedUser._id,
          username: updatedUser.username,
          email: updatedUser.email,
          role: updatedUser.role,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          phone: updatedUser.phone,
          address: updatedUser.address,
          birthDate: updatedUser.birthDate
        }
      });
    } else {
      res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor',
      error: error.message 
    });
  }
});

// @desc    Cambiar contraseña
// @route   PUT /api/auth/change-password
// @access  Private
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (user && (await user.comparePassword(currentPassword))) {
      user.password = newPassword;
      await user.save();
      
      res.json({ 
        success: true,
        message: 'Contraseña actualizada correctamente' 
      });
    } else {
      res.status(400).json({ 
        success: false,
        message: 'Contraseña actual incorrecta' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor',
      error: error.message 
    });
  }
});

// @desc    Solicitar recuperación de contraseña
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    // Validar que se proporcione email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'El email es requerido'
      });
    }

    // Verificar si el usuario existe
    const user = await User.findOne({ email });
    if (!user) {
      // Por seguridad, no revelar si el email existe o no
      return res.json({
        success: true,
        message: 'Si el email está registrado, recibirás instrucciones de recuperación'
      });
    }

    // Generar token único
    const resetToken = generateResetToken();
    
    
    // Crear registro de recuperación
    const passwordReset = await PasswordReset.create({
      email: email.toLowerCase(),
      token: resetToken
    });

    // Construir URL de restablecimiento
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    // Enviar correo
    const emailResult = await sendPasswordResetEmail(email, resetToken, resetUrl);

    if (emailResult.success) {
      res.json({
        success: true,
        message: 'Si el email está registrado, recibirás instrucciones de recuperación'
      });
    } else {
      // Si falla el envío, eliminar el registro de recuperación
      await PasswordReset.findByIdAndDelete(passwordReset._id);
      
      res.status(500).json({
        success: false,
        message: 'Error al enviar el correo de recuperación. Intenta nuevamente.'
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
      error: error.message
    });
  }
});

// @desc    Restablecer contraseña con token
// @route   POST /api/auth/reset-password
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Validar datos requeridos
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token y nueva contraseña son requeridos'
      });
    }

    // Validar longitud de contraseña
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Buscar token válido
    const passwordReset = await PasswordReset.findOne({ 
      token, 
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!passwordReset) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    // Buscar usuario
    const user = await User.findOne({ email: passwordReset.email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Actualizar contraseña
    user.password = newPassword;
    await user.save();

    // Marcar token como usado
    await passwordReset.markAsUsed();

    // Enviar correo de confirmación
    try {
      await sendPasswordChangedEmail(
        user.email, 
        user.firstName || user.username
      );
    } catch (emailError) {
      // No fallar si el correo de confirmación falla
    }

    res.json({
      success: true,
      message: 'Contraseña restablecida exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
      error: error.message
    });
  }
});

// Función auxiliar para determinar el tipo de dispositivo
function getDeviceType(userAgent) {
  if (!userAgent) return 'Unknown';
  
  if (userAgent.includes('Mobile')) return 'Mobile';
  if (userAgent.includes('Tablet')) return 'Tablet';
  if (userAgent.includes('Windows')) return 'PC Windows';
  if (userAgent.includes('Mac')) return 'Mac';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS')) return 'iOS';
  
  return 'Desktop';
}

// Generar token JWT con información del tenant
const generateToken = (id, tenantId = null) => {
  const payload = { id };
  if (tenantId) {
    payload.tenantId = tenantId;
  }
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

export default router;
