import dotenv from 'dotenv';
import { sendPasswordResetEmail } from './services/emailService.js';

// Cargar variables de entorno
dotenv.config();

// Función para probar solo el envío de correos
const testEmailFunction = async () => {
  console.log('📧 Probando función de envío de correos...\n');
  
  try {
    // Configuración de prueba
    const testEmail = 'juanlpalmanzar@gmail.com'; // Cambiar por un email real para pruebas
    const testToken = 'test-token-123456789';
    const resetUrl = `http://localhost:3000/reset-password?token=${testToken}`;
    
    console.log('Configuración de prueba:');
    console.log('- Email de destino:', testEmail);
    console.log('- Token de prueba:', testToken);
    console.log('- URL de restablecimiento:', resetUrl);
    console.log('');
    
    console.log('Configuración SMTP:');
    console.log('- Host: mail.innovadom.net');
    console.log('- Puerto: 465');
    console.log('- Usuario:', process.env.SMTP_USER || 'juancarlos@innovadom.net');
    console.log('- Contraseña configurada:', !!process.env.SMTP_PASSWORD);
    console.log('');
    
    if (!process.env.SMTP_PASSWORD) {
      console.log('⚠️ SMTP_PASSWORD no configurada en .env');
      console.log('💡 Para probar el envío real, configura la contraseña en tu archivo .env');
      console.log('   SMTP_PASSWORD=tu_contraseña_del_email_aqui');
      return;
    }
    
    console.log('🚀 Intentando enviar correo...');
    
    const result = await sendPasswordResetEmail(testEmail, testToken, resetUrl);
    
    if (result.success) {
      console.log('✅ Correo enviado exitosamente!');
      console.log('Message ID:', result.data.messageId);
      console.log('Respuesta:', result.message);
    } else {
      console.log('❌ Error al enviar correo:');
      console.log('Mensaje:', result.message);
      console.log('Error detallado:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error en la función de envío:', error.message);
    console.error('Stack trace:', error.stack);
  }
  
  console.log('\n🏁 Prueba completada');
};

// Ejecutar la prueba
testEmailFunction();
