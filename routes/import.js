import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { identifyTenant } from '../middleware/tenant.js';

const router = express.Router();

// Ruta de prueba
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Ruta de importación funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Configuración de multer para subir archivos
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo se permiten archivos CSV y Excel.'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Middleware para procesar archivos CSV
const processCSV = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No se proporcionó archivo' });
  }

  const results = [];
  const errors = [];
  let rowCount = 0;

  // Verificar que el archivo existe
  if (!fs.existsSync(req.file.path)) {
    return res.status(400).json({ 
      success: false, 
      message: 'El archivo no se pudo procesar correctamente' 
    });
  }

  try {
    // Obtener opciones del body
    const options = JSON.parse(req.body.options || '{}');
    
    // Leer el archivo línea por línea para procesar por número de columna
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    
    lines.forEach((line, index) => {
      rowCount++;
      
      // Saltar la primera fila si contiene headers
      if (index === 0 && options.skipFirstRow) {
        return;
      }
      
      // Dividir la línea en valores
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      
      // Validar que hay datos
      if (values.length === 0 || values.every(v => v === '')) {
        errors.push(`Fila ${rowCount}: Datos vacíos`);
        return;
      }

      // Crear objeto con índices de columna como claves
      const cleanedData = {};
      values.forEach((value, i) => {
        if (value !== null && value !== undefined && value !== '') {
          cleanedData[i] = value.trim();
        }
      });

      // Verificar que hay al menos un campo con valor
      const hasData = Object.values(cleanedData).some(value => 
        value !== null && value !== undefined && value !== ''
      );

      if (hasData) {
        results.push(cleanedData);
      } else {
        errors.push(`Fila ${rowCount}: No contiene datos válidos`);
      }
    });
    
    // Procesar datos y continuar
    req.processedData = {
      data: results,
      errors,
      rowCount
    };
    next();
  } catch (error) {
    console.error('Error procesando archivo:', error);
    res.status(400).json({ 
      success: false, 
      message: 'Error procesando archivo', 
      error: error.message 
    });
  }
};

// Ruta genérica para importar datos
router.post('/:module', identifyTenant, upload.single('file'), processCSV, async (req, res) => {
  try {
    const { module } = req.params;
    const { data, errors, rowCount } = req.processedData;
    const options = JSON.parse(req.body.options || '{}');

    console.log(`Datos procesados: ${data.length} filas, ${errors.length} errores`);
    console.log('Primera fila de datos:', data[0]);
    console.log('Errores encontrados:', errors);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Errores en el archivo',
        errors
      });
    }

    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se encontraron datos válidos en el archivo'
      });
    }

    // Obtener el modelo correspondiente
    const Model = req.tenantModels?.[getModelName(module)] || getDefaultModel(module);
    
    if (!Model) {
      return res.status(400).json({
        success: false,
        message: `Módulo ${module} no soporta importación`
      });
    }

    // Procesar datos según el módulo
    const processedData = await processDataForModule(module, data, options);
    
    // Insertar datos
    let insertedCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < processedData.length; i++) {
      const item = processedData[i];
      try {
        console.log(`Procesando item ${i + 1}/${processedData.length}:`, item);
        
        if (options.updateExisting && item.id) {
          // Actualizar registro existente
          await Model.findByIdAndUpdate(item.id, item, { new: true });
          updatedCount++;
          console.log(`Item ${i + 1} actualizado correctamente`);
        } else {
          // Crear nuevo registro
          const newItem = new Model(item);
          await newItem.save();
          insertedCount++;
          console.log(`Item ${i + 1} insertado correctamente`);
        }
      } catch (error) {
        console.error(`Error procesando item ${i + 1}:`, error);
        console.error(`Datos del item:`, item);
        
        // Si es un error de validación, agregar más detalles
        if (error.name === 'ValidationError') {
          const validationErrors = Object.values(error.errors).map(err => err.message).join(', ');
          console.error(`Errores de validación: ${validationErrors}`);
        }
        
        // Continuar con el siguiente item
      }
    }

    // Limpiar archivo temporal
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: 'Importación completada',
      count: insertedCount + updatedCount,
      inserted: insertedCount,
      updated: updatedCount,
      totalRows: rowCount
    });

  } catch (error) {
    console.error('Error en importación:', error);
    
    // Limpiar archivo temporal si existe
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// Función para obtener el nombre del modelo
function getModelName(module) {
  const modelMap = {
    'products': 'Product',
    'clients': 'Client',
    'suppliers': 'Supplier',
    'sales': 'Sale',
    'purchases': 'Purchase',
    'banks': 'Bank',
    'batches': 'Batch',
    'packages': 'Package',
    'recipes': 'Recipe',
    'accounts': 'Account'
  };
  return modelMap[module] || null;
}

// Función para obtener modelo por defecto
function getDefaultModel(module) {
  // Aquí podrías importar los modelos por defecto si no hay tenant
  return null;
}

// Función para procesar datos según el módulo
async function processDataForModule(module, data, options) {
  switch (module) {
    case 'products':
      return data.map(item => ({
        // Mapeo por número de columna: 0=name, 1=unit, 2=category, 3=minStock, 4=description, 5=price, 6=cost, 7=managesBatches
        name: item[0] || '',
        unit: item[1] || '',
        category: item[2] || 'materia_prima',
        minStock: parseInt(item[3] || 0),
        description: item[4] || '',
        price: parseFloat(item[5] || 0),
        cost: parseFloat(item[6] || 0),
        managesBatches: item[7] === 'true' || item[7] === '1',
        isActive: item[8] !== 'inactivo' && item[8] !== 'false'
      }));

    case 'clients':
      return data.map((item, index) => {
        // Mapeo por número de columna: 0=name, 1=email, 2=phone, 3=address, 4=type, 5=status
        const name = item[0];
        if (!name || name.trim() === '') {
          console.error(`Cliente en fila ${index + 1}: Nombre requerido pero no encontrado`, item);
          throw new Error(`Fila ${index + 1}: El nombre del cliente es requerido`);
        }

        const processedItem = {
          name: name.trim(),
          email: item[1] || '',
          phone: item[2] || '',
          address: typeof item[3] === 'string' 
            ? { street: item[3] } 
            : (item[3] || {}),
          type: mapClientType(item[4] || 'individual'),
          status: mapClientStatus(item[5] || 'Activo'),
          isActive: item[5] !== 'inactivo' && item[5] !== 'Inactivo'
        };

        console.log(`Cliente procesado ${index + 1}:`, processedItem);
        return processedItem;
      });

    case 'suppliers':
      return data.map(item => ({
        // Mapeo por número de columna: 0=name, 1=email, 2=phone, 3=address, 4=type, 5=status
        name: item[0] || '',
        email: item[1] || '',
        phone: item[2] || '',
        address: typeof item[3] === 'string' 
          ? { street: item[3] } 
          : (item[3] || {}),
        type: mapSupplierType(item[4] || 'individual'),
        status: mapSupplierStatus(item[5] || 'Activo'),
        isActive: item[5] !== 'inactivo' && item[5] !== 'Inactivo'
      }));

    case 'sales':
      return data.map(item => ({
        // Mapeo por número de columna: 0=clientId, 1=productId, 2=quantity, 3=price, 4=total, 5=date, 6=status
        clientId: item[0],
        productId: item[1],
        quantity: parseInt(item[2] || 0),
        price: parseFloat(item[3] || 0),
        total: parseFloat(item[4] || 0),
        date: new Date(item[5] || new Date()),
        status: item[6] || 'completada'
      }));

    case 'purchases':
      return data.map(item => ({
        // Mapeo por número de columna: 0=supplierId, 1=productId, 2=quantity, 3=price, 4=total, 5=date, 6=status
        supplierId: item[0],
        productId: item[1],
        quantity: parseInt(item[2] || 0),
        price: parseFloat(item[3] || 0),
        total: parseFloat(item[4] || 0),
        date: new Date(item[5] || new Date()),
        status: item[6] || 'completada'
      }));

    case 'banks':
      return data.map(item => ({
        // Mapeo por número de columna: 0=name, 1=accountNumber, 2=accountType, 3=balance, 4=currency, 5=isActive
        name: item[0] || '',
        accountNumber: item[1] || '',
        accountType: item[2] || 'ahorro',
        balance: parseFloat(item[3] || 0),
        currency: item[4] || 'USD',
        isActive: item[5] !== 'inactivo' && item[5] !== 'false'
      }));

    default:
      return data;
  }
}

// Funciones de mapeo para clientes
function mapClientType(type) {
  const typeMap = {
    'persona': 'individual',
    'individual': 'individual',
    'empresa': 'empresa',
    'company': 'empresa',
    'distribuidor': 'distribuidor',
    'distributor': 'distribuidor'
  };
  return typeMap[type?.toLowerCase()] || 'individual';
}

function mapClientStatus(status) {
  const statusMap = {
    'activo': 'Activo',
    'active': 'Activo',
    'pendiente': 'Pendiente',
    'pending': 'Pendiente',
    'inactivo': 'Inactivo',
    'inactive': 'Inactivo',
    'bloqueado': 'Bloqueado',
    'blocked': 'Bloqueado'
  };
  return statusMap[status?.toLowerCase()] || 'Activo';
}

// Funciones de mapeo para proveedores
function mapSupplierType(type) {
  const typeMap = {
    'persona': 'individual',
    'individual': 'individual',
    'empresa': 'empresa',
    'company': 'empresa',
    'distribuidor': 'distribuidor',
    'distributor': 'distribuidor'
  };
  return typeMap[type?.toLowerCase()] || 'individual';
}

function mapSupplierStatus(status) {
  const statusMap = {
    'activo': 'Activo',
    'active': 'Activo',
    'pendiente': 'Pendiente',
    'pending': 'Pendiente',
    'inactivo': 'Inactivo',
    'inactive': 'Inactivo',
    'bloqueado': 'Bloqueado',
    'blocked': 'Bloqueado'
  };
  return statusMap[status?.toLowerCase()] || 'Activo';
}

export default router;