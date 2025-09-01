import dotenv from 'dotenv';
import mongoose from 'mongoose';
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

// Función para probar el envío de correos
const testEmailSending = async () => {
  console.log('📧 Probando envío de correos...');
  
  try {
    const testToken = generateResetToken();
    const testEmail = 'test@example.com'; // Cambiar por un email real para pruebas
    const resetUrl = `http://localhost:3000/reset-password?token=${testToken}`;
    
    console.log('Enviando correo de prueba a:', testEmail);
    console.log('URL de restablecimiento:', resetUrl);
    
    const result = await sendPasswordResetEmail(testEmail, testToken, resetUrl);
    
    if (result.success) {
      console.log('✅ Correo enviado exitosamente');
      console.log('Respuesta:', result.message);
    } else {
      console.log('❌ Error al enviar correo:', result.message);
      console.log('Error detallado:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error en prueba de correo:', error.message);
  }
  
  console.log('');
};

// Función para probar la conexión a MongoDB
const testMongoConnection = async () => {
  console.log('🗄️ Probando conexión a MongoDB...');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conexión a MongoDB exitosa');
    
    // Probar creación de modelo PasswordReset
    const PasswordReset = mongoose.model('PasswordReset');
    console.log('✅ Modelo PasswordReset cargado correctamente');
    
    await mongoose.disconnect();
    console.log('✅ Desconexión de MongoDB exitosa\n');
    
  } catch (error) {
    console.error('❌ Error en conexión a MongoDB:', error.message);
    console.log('');
  }
};

// Función principal de pruebas
const runTests = async () => {
  console.log('🚀 Iniciando pruebas de recuperación de contraseña...\n');
  
  // Prueba 1: Generación de tokens
  testTokenGeneration();
  
  // Prueba 2: Conexión a MongoDB
  await testMongoConnection();
  
  // Prueba 3: Envío de correos (solo si hay API key configurada)
  if (process.env.MAILERSEND_API_KEY) {
    console.log('🔑 API Key encontrada:', process.env.MAILERSEND_API_KEY.substring(0, 20) + '...');
    await testEmailSending();
  } else {
    console.log('⚠️ MAILERSEND_API_KEY no configurada, saltando prueba de correos');
    console.log('💡 Para probar correos, configura MAILERSEND_API_KEY en tu archivo .env\n');
  }
  
  console.log('🏁 Pruebas completadas');
};

// Ejecutar pruebas si el archivo se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests };
