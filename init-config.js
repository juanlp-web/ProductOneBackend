import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Config from './models/Config.js';

// Cargar variables de entorno
dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
  } catch (error) {
    process.exit(1);
  }
};

const initConfig = async () => {
  try {
    await connectDB();
    
    
    // Configuraciones por defecto
    const defaultConfigs = [
      {
        key: 'iva_percentage',
        value: 16,
        type: 'number',
        description: 'Porcentaje de IVA aplicado a las ventas'
      },
      {
        key: 'company_name',
        value: 'Innovadomprod',
        type: 'string',
        description: 'Nombre de la empresa'
      },
      {
        key: 'company_address',
        value: '',
        type: 'string',
        description: 'Dirección de la empresa'
      },
      {
        key: 'company_phone',
        value: '',
        type: 'string',
        description: 'Teléfono de la empresa'
      },
      {
        key: 'company_email',
        value: '',
        type: 'string',
        description: 'Email de la empresa'
      },
      {
        key: 'currency_symbol',
        value: '$',
        type: 'string',
        description: 'Símbolo de moneda'
      },
      {
        key: 'currency_code',
        value: 'USD',
        type: 'string',
        description: 'Código de moneda'
      }
    ];
    
    // Crear un usuario por defecto para las configuraciones
    // En un entorno real, esto debería ser el ID del usuario administrador
    const defaultUserId = new mongoose.Types.ObjectId();
    
    for (const configData of defaultConfigs) {
      const existingConfig = await Config.findOne({ key: configData.key });
      
      if (!existingConfig) {
        await Config.create({
          ...configData,
          createdBy: defaultUserId,
          updatedBy: defaultUserId
        });
      } else {
      }
    }
    
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
};

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  initConfig();
}

export default initConfig;
