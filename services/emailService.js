import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Configurar transporter de Nodemailer para SMTP de cPanel
const createTransporter = () => {
  return nodemailer.createTransport({
    host: 'mail.innovadom.net',
    port: 465,
    secure: true, // true para 465, false para otros puertos
    auth: {
      user: process.env.SMTP_USER || 'juancarlos@innovadom.net',
      pass: process.env.SMTP_PASSWORD
    },
    tls: {
      rejectUnauthorized: false // Para evitar problemas de certificados
    }
  });
};

/**
 * Genera un token seguro para recuperación de contraseña
 * @returns {string} Token generado
 */
export const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Envía correo de recuperación de contraseña
 * @param {string} email - Email del destinatario
 * @param {string} resetToken - Token de recuperación
 * @param {string} resetUrl - URL para restablecer contraseña
 * @returns {Promise<Object>} Resultado del envío
 */
export const sendPasswordResetEmail = async (email, resetToken, resetUrl) => {
  try {
    
    const transporter = createTransporter();
    
    // Verificar conexión SMTP
    await transporter.verify();
    
    const mailOptions = {
      from: '"ProductOneX - Sistema de Gestión" <juancarlos@innovadom.net>',
      to: email,
             subject: 'Recuperación de Contraseña - ProductOneX',
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Recuperación de Contraseña</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f4f4f4;
            }
            .container {
              background-color: #ffffff;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 35px;
            }
                         .logo {
               background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #404040 100%);
               color: white;
               padding: 30px;
               border-radius: 16px;
               margin-bottom: 30px;
               box-shadow: 0 12px 35px rgba(0, 0, 0, 0.4);
               position: relative;
               overflow: hidden;
             }
             .logo::before {
               content: '';
               position: absolute;
               top: 0;
               left: 0;
               right: 0;
               bottom: 0;
               background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%);
               animation: shimmer 2s infinite;
             }
             @keyframes shimmer {
               0% { transform: translateX(-100%); }
               100% { transform: translateX(100%); }
             }
             .logo h1 {
               margin: 0;
               font-size: 28px;
               font-weight: 700;
               letter-spacing: -0.5px;
               text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
             }
             .logo p {
               margin: 5px 0 0 0;
               font-size: 16px;
               opacity: 0.9;
             }
             .content {
               margin-bottom: 30px;
             }
             .content h2 {
               color: #1a1a1a;
               font-size: 26px;
               font-weight: 700;
               margin-bottom: 25px;
               text-align: center;
               position: relative;
             }
             .content h2::after {
               content: '';
               position: absolute;
               bottom: -8px;
               left: 50%;
               transform: translateX(-50%);
               width: 50px;
               height: 3px;
               background: linear-gradient(90deg, #ff6b35, #ff8c42);
               border-radius: 2px;
             }
             .content p {
               margin-bottom: 15px;
               line-height: 1.7;
             }
             .button {
               display: inline-block;
               background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #404040 100%);
               color: white;
               padding: 18px 36px;
               text-decoration: none;
               border-radius: 12px;
               font-weight: 600;
               text-align: center;
               margin: 30px 0;
               box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
               transition: all 0.3s ease;
               border: 1px solid #333;
               position: relative;
               overflow: hidden;
               font-size: 16px;
               letter-spacing: 0.5px;
             }
             .button::before {
               content: '';
               position: absolute;
               top: 0;
               left: -100%;
               width: 100%;
               height: 100%;
               background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
               transition: left 0.5s;
             }
             .button:hover::before {
               left: 100%;
             }
             .button:hover {
               transform: translateY(-2px);
               box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5);
               background: linear-gradient(135deg, #2d2d2d 0%, #404040 50%, #1a1a1a 100%);
             }
             .warning {
               background: linear-gradient(135deg, #2d2d2d 0%, #404040 100%);
               border: 1px solid #555;
               color: #ffffff;
               padding: 22px;
               border-radius: 12px;
               margin: 30px 0;
               border-left: 5px solid #ff6b35;
               position: relative;
               box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
             }
             .warning::before {
               content: '⚠️';
               position: absolute;
               top: -10px;
               left: 20px;
               background: #ff6b35;
               color: white;
               padding: 5px 10px;
               border-radius: 20px;
               font-size: 14px;
               box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
             }
             .warning strong {
               color: #ff6b35;
             }
             .footer {
               text-align: center;
               margin-top: 40px;
               padding-top: 30px;
               border-top: 2px solid #333;
               color: #888;
               font-size: 14px;
               background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
               padding: 25px;
               border-radius: 12px;
               position: relative;
               box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
             }
             .footer::before {
               content: '';
               position: absolute;
               top: 0;
               left: 50%;
               transform: translateX(-50%);
               width: 60px;
               height: 3px;
               background: linear-gradient(90deg, #ff6b35, #ff8c42);
               border-radius: 2px;
             }
             .footer p {
               color: #ccc;
             }
             .token-info {
               background: linear-gradient(135deg, #2d2d2d 0%, #404040 100%);
               border: 1px solid #555;
               padding: 20px;
               border-radius: 12px;
               margin: 30px 0;
               font-family: 'Courier New', monospace;
               word-break: break-all;
               font-size: 13px;
               color: #ffffff;
               border-left: 5px solid #666;
               position: relative;
               box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
             }
             .token-info::before {
               content: '🔗';
               position: absolute;
               top: -8px;
               left: 15px;
               background: #666;
               color: white;
               padding: 3px 8px;
               border-radius: 15px;
               font-size: 12px;
               box-shadow: 0 2px 6px rgba(102, 102, 102, 0.3);
             }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
                             <div class="logo">
                 <h1>🔐 ProductOneX</h1>
                 <p>Sistema de Gestión</p>
               </div>
            </div>
            
            <div class="content">
              <h2>Recuperación de Contraseña</h2>
              <p>Hola,</p>
                             <p>Has solicitado restablecer tu contraseña en el sistema ProductOneX. Para continuar con el proceso, haz clic en el botón de abajo:</p>
              
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">
                  🔑 Restablecer Contraseña
                </a>
              </div>
              
              <p>Si el botón no funciona, puedes copiar y pegar el siguiente enlace en tu navegador:</p>
              <div class="token-info">
                ${resetUrl}
              </div>
              
              <div class="warning">
                <strong>⚠️ Importante:</strong>
                <ul>
                  <li>Este enlace expirará en <strong>1 hora</strong></li>
                  <li>Si no solicitaste este cambio, puedes ignorar este correo</li>
                  <li>Por seguridad, no compartas este enlace con nadie</li>
                </ul>
              </div>
              
                             <p>Si tienes alguna pregunta, no dudes en contactar al equipo de soporte.</p>
             </div>
             
             <div class="footer">
               <p>© 2025 ProductOneX. Todos los derechos reservados.</p>
               <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
             </div>
          </div>
        </body>
        </html>
      `,
      text: `
                 Recuperación de Contraseña - ProductOneX
         
         Has solicitado restablecer tu contraseña en el sistema ProductOneX.
         
         Para continuar con el proceso, visita el siguiente enlace:
         ${resetUrl}
         
         Este enlace expirará en 1 hora.
         
         Si no solicitaste este cambio, puedes ignorar este correo.
         
         © 2025 ProductOneX. Todos los derechos reservados.
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    
    return {
      success: true,
      message: 'Correo de recuperación enviado exitosamente',
      data: info
    };
    
  } catch (error) {
    
    return {
      success: false,
      message: 'Error al enviar el correo de recuperación',
      error: error.message
    };
  }
};

/**
 * Envía correo de confirmación de cambio de contraseña
 * @param {string} email - Email del destinatario
 * @param {string} userName - Nombre del usuario
 * @returns {Promise<Object>} Resultado del envío
 */
export const sendPasswordChangedEmail = async (email, userName) => {
  try {
    
    const transporter = createTransporter();
    
    const mailOptions = {
      from: '"ProductOneX - Sistema de Gestión" <juancarlos@innovadom.net>',
      to: email,
      subject: 'Contraseña Cambiada - ProductOneX',
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Contraseña Cambiada</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f4f4f4;
            }
            .container {
              background-color: #ffffff;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              padding: 20px;
              border-radius: 10px;
              margin-bottom: 20px;
            }
            .logo h1 {
              margin: 0;
              font-size: 24px;
              font-weight: bold;
            }
            .content {
              margin-bottom: 30px;
            }
            .success-icon {
              text-align: center;
              font-size: 48px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              color: #666;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">
                <h1>✅ ProductOneX</h1>
                <p>Sistema de Gestión</p>
              </div>
            </div>
            
            <div class="content">
              <div class="success-icon">🎉</div>
              <h2>Contraseña Cambiada Exitosamente</h2>
              <p>Hola ${userName || 'Usuario'},</p>
              <p>Tu contraseña ha sido restablecida exitosamente en el sistema ProductOneX.</p>
              
              <p>Ahora puedes acceder a tu cuenta con tu nueva contraseña.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" 
                   style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
                          color: white; 
                          padding: 15px 30px; 
                          text-decoration: none; 
                          border-radius: 25px; 
                          font-weight: bold;">
                  🔐 Ir al Login
                </a>
              </div>
              
              <p>Si no realizaste este cambio, contacta inmediatamente al equipo de soporte.</p>
            </div>
            
            <div class="footer">
              <p>© 2024 Innovadom. Todos los derechos reservados.</p>
              <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
                 Contraseña Cambiada - ProductOneX
         
         Hola ${userName || 'Usuario'},
         
         Tu contraseña ha sido restablecida exitosamente en el sistema ProductOneX.
         
         Ahora puedes acceder a tu cuenta con tu nueva contraseña.
         
         Si no realizaste este cambio, contacta inmediatamente al equipo de soporte.
         
         © 2025 ProductOneX. Todos los derechos reservados.
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    
    return {
      success: true,
      message: 'Correo de confirmación enviado exitosamente',
      data: info
    };
    
  } catch (error) {
    
    return {
      success: false,
      message: 'Error al enviar el correo de confirmación',
      error: error.message
    };
  }
};
