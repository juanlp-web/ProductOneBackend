import crypto from 'crypto';

// Generar un JWT_SECRET seguro de 64 caracteres
const jwtSecret = crypto.randomBytes(32).toString('hex');

