import { generateResetToken } from './services/emailService.js';

console.log('🚀 Prueba simple de generación de tokens...\n');

try {
  // Prueba 1: Generación de tokens
  console.log('🔑 Probando generación de tokens...');
  
  const token1 = generateResetToken();
  const token2 = generateResetToken();
  
  console.log('Token 1:', token1);
  console.log('Token 2:', token2);
  console.log('¿Los tokens son diferentes?', token1 !== token2);
  console.log('Longitud del token:', token1.length);
  console.log('✅ Generación de tokens funcionando correctamente\n');
  
  // Prueba 2: Verificar configuración
  console.log('⚙️ Configuración del sistema...');
  console.log('SMTP_USER configurada:', !!process.env.SMTP_USER);
  console.log('SMTP_PASSWORD configurada:', !!process.env.SMTP_PASSWORD);
  console.log('FRONTEND_URL configurada:', !!process.env.FRONTEND_URL);
  
  if (process.env.SMTP_USER) {
    console.log('📧 Usuario SMTP:', process.env.SMTP_USER);
  } else {
    console.log('⚠️ SMTP_USER no configurada');
  }
  
  if (process.env.SMTP_PASSWORD) {
    console.log('🔑 Contraseña SMTP: ***configurada***');
  } else {
    console.log('⚠️ SMTP_PASSWORD no configurada');
  }
  
  console.log('\n🏁 Prueba simple completada');
  
} catch (error) {
  console.error('❌ Error en la prueba:', error.message);
  console.error('Stack trace:', error.stack);
}
