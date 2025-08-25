import crypto from 'crypto';

// Generar un JWT_SECRET seguro de 64 caracteres
const jwtSecret = crypto.randomBytes(32).toString('hex');

console.log('🔐 JWT_SECRET generado:');
console.log('='.repeat(50));
console.log(jwtSecret);
console.log('='.repeat(50));
console.log('\n📋 Copia este valor en tu archivo .env como:');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log('\n⚠️  IMPORTANTE: Nunca compartas este secreto ni lo subas a Git!');
