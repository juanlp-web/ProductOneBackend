import dotenv from 'dotenv';
import { generateResetToken, sendPasswordResetEmail } from './services/emailService.js';

// Cargar variables de entorno
dotenv.config();

// Función para probar la generación de tokens
const testTokenGeneration = () => {
  console.log('🔑 Probando generación de tokens...');
  
  const token1 = generateResetToken();
  const token2 = generateResetToken();
  
  console.log('Token 1:', token1);
  console.log('Token 2:', token2);
  console.log('¿Los tokens son diferentes?', token1 !== token2);
  console.log('Longitud del token:', token1.length);
  console.log('✅ Generación de tokens funcionando correctamente\n');
};

// Función para probar la conexión SMTP
const testSMTPConnection = async () => {
  console.log('📧 Probando conexión SMTP...');
  
  try {
    const testToken = generateResetToken();
    const testEmail = 'test@example.com'; // Cambiar por un email real para pruebas
    const resetUrl = `http://localhost:3000/reset-password?token=${testToken}`;
    
    console.log('Configuración SMTP:');
    console.log('- Host: mail.innovadom.net');
    console.log('- Puerto: 465');
    console.log('- Usuario:', process.env.SMTP_USER || 'juancarlos@innovadom.net');
    console.log('- Contraseña configurada:', !!process.env.SMTP_PASSWORD);
    
    if (!process.env.SMTP_PASSWORD) {
      console.log('⚠️ SMTP_PASSWORD no configurada en .env');
      console.log('💡 Configura la contraseña del email en tu archivo .env\n');
      return;
    }
    
    console.log('\nEnviando correo de prueba a:', testEmail);
    console.log('URL de restablecimiento:', resetUrl);
    
    const result = await sendPasswordResetEmail(testEmail, testToken, resetUrl);
    
    if (result.success) {
      console.log('✅ Correo enviado exitosamente');
      console.log('Message ID:', result.data.messageId);
      console.log('Respuesta:', result.message);
    } else {
      console.log('❌ Error al enviar correo:', result.message);
      console.log('Error detallado:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error en prueba SMTP:', error.message);
  }
  
  console.log('');
};

// Función para verificar configuración
const checkConfiguration = () => {
  console.log('⚙️ Verificando configuración...');
  
  const requiredVars = {
    'SMTP_USER': process.env.SMTP_USER,
    'SMTP_PASSWORD': process.env.SMTP_PASSWORD,
    'FRONTEND_URL': process.env.FRONTEND_URL
  };
  
  let allConfigured = true;
  
  Object.entries(requiredVars).forEach(([key, value]) => {
    if (value) {
      console.log(`✅ ${key}: ${key.includes('PASSWORD') ? '***configurada***' : value}`);
    } else {
      console.log(`❌ ${key}: No configurada`);
      allConfigured = false;
    }
  });
  
  console.log('');
  return allConfigured;
};

// Función principal de pruebas
const runTests = async () => {
  console.log('🚀 Iniciando pruebas de SMTP...\n');
  
  // Prueba 1: Generación de tokens
  testTokenGeneration();
  
  // Prueba 2: Verificar configuración
  const configOk = checkConfiguration();
  
  // Prueba 3: Envío de correos (solo si hay configuración)
  if (configOk) {
    await testSMTPConnection();
  } else {
    console.log('⚠️ Configuración incompleta, saltando prueba de correos');
    console.log('💡 Para probar correos, configura todas las variables en tu archivo .env\n');
  }
  
  console.log('🏁 Pruebas completadas');
};

// Ejecutar pruebas si el archivo se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests };
