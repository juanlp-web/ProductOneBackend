import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/database.js';
import Account from '../models/Account.js';
import AccountConfig from '../models/AccountConfig.js';

// Cargar variables de entorno
dotenv.config();

// Catálogo de cuentas por defecto
const defaultAccounts = [
  // ACTIVO
  {
    code: '1',
    name: 'ACTIVO',
    type: 'activo',
    level: 1,
    parentId: null,
    children: [
      {
        code: '11',
        name: 'ACTIVO CORRIENTE',
        type: 'activo',
        level: 2,
        children: [
          {
            code: '111',
            name: 'Efectivo y Equivalentes',
            type: 'activo',
            level: 3,
            children: [
              { code: '1111', name: 'Caja', type: 'activo', level: 4 },
              { code: '1112', name: 'Bancos', type: 'activo', level: 4 }
            ]
          },
          {
            code: '112',
            name: 'Cuentas por Cobrar',
            type: 'activo',
            level: 3,
            children: [
              { code: '1121', name: 'Clientes', type: 'activo', level: 4 },
              { code: '1122', name: 'Deudores Varios', type: 'activo', level: 4 }
            ]
          },
          {
            code: '113',
            name: 'Inventarios',
            type: 'activo',
            level: 3,
            children: [
              { code: '1131', name: 'Materias Primas', type: 'activo', level: 4 },
              { code: '1132', name: 'Productos en Proceso', type: 'activo', level: 4 },
              { code: '1133', name: 'Productos Terminados', type: 'activo', level: 4 }
            ]
          }
        ]
      },
      {
        code: '12',
        name: 'ACTIVO NO CORRIENTE',
        type: 'activo',
        level: 2,
        children: [
          {
            code: '121',
            name: 'Propiedades, Planta y Equipo',
            type: 'activo',
            level: 3,
            children: [
              { code: '1211', name: 'Terrenos', type: 'activo', level: 4 },
              { code: '1212', name: 'Edificios', type: 'activo', level: 4 },
              { code: '1213', name: 'Maquinaria y Equipo', type: 'activo', level: 4 },
              { code: '1214', name: 'Muebles y Enseres', type: 'activo', level: 4 }
            ]
          }
        ]
      }
    ]
  },
  // PASIVO
  {
    code: '2',
    name: 'PASIVO',
    type: 'pasivo',
    level: 1,
    parentId: null,
    children: [
      {
        code: '21',
        name: 'PASIVO CORRIENTE',
        type: 'pasivo',
        level: 2,
        children: [
          {
            code: '211',
            name: 'Cuentas por Pagar',
            type: 'pasivo',
            level: 3,
            children: [
              { code: '2111', name: 'Proveedores', type: 'pasivo', level: 4 },
              { code: '2112', name: 'Acreedores Varios', type: 'pasivo', level: 4 }
            ]
          },
          {
            code: '212',
            name: 'Obligaciones Laborales',
            type: 'pasivo',
            level: 3,
            children: [
              { code: '2121', name: 'Salarios por Pagar', type: 'pasivo', level: 4 },
              { code: '2122', name: 'Prestaciones Sociales', type: 'pasivo', level: 4 }
            ]
          }
        ]
      },
      {
        code: '22',
        name: 'PASIVO NO CORRIENTE',
        type: 'pasivo',
        level: 2,
        children: [
          {
            code: '221',
            name: 'Obligaciones Financieras',
            type: 'pasivo',
            level: 3,
            children: [
              { code: '2211', name: 'Préstamos Bancarios', type: 'pasivo', level: 4 }
            ]
          }
        ]
      }
    ]
  },
  // PATRIMONIO
  {
    code: '3',
    name: 'PATRIMONIO',
    type: 'patrimonio',
    level: 1,
    parentId: null,
    children: [
      {
        code: '31',
        name: 'CAPITAL',
        type: 'patrimonio',
        level: 2,
        children: [
          { code: '311', name: 'Capital Social', type: 'patrimonio', level: 3 }
        ]
      },
      {
        code: '32',
        name: 'RESERVAS',
        type: 'patrimonio',
        level: 2,
        children: [
          { code: '321', name: 'Reservas Legales', type: 'patrimonio', level: 3 }
        ]
      }
    ]
  },
  // INGRESOS
  {
    code: '4',
    name: 'INGRESOS',
    type: 'ingreso',
    level: 1,
    parentId: null,
    children: [
      {
        code: '41',
        name: 'INGRESOS OPERACIONALES',
        type: 'ingreso',
        level: 2,
        children: [
          { code: '411', name: 'Ventas', type: 'ingreso', level: 3 },
          { code: '412', name: 'Devoluciones en Ventas', type: 'ingreso', level: 3 }
        ]
      },
      {
        code: '42',
        name: 'INGRESOS NO OPERACIONALES',
        type: 'ingreso',
        level: 2,
        children: [
          { code: '421', name: 'Otros Ingresos', type: 'ingreso', level: 3 }
        ]
      }
    ]
  },
  // GASTOS
  {
    code: '5',
    name: 'GASTOS',
    type: 'gasto',
    level: 1,
    parentId: null,
    children: [
      {
        code: '51',
        name: 'GASTOS OPERACIONALES',
        type: 'gasto',
        level: 2,
        children: [
          { code: '511', name: 'Compras', type: 'gasto', level: 3 },
          { code: '512', name: 'Gastos Administrativos', type: 'gasto', level: 3 },
          { code: '513', name: 'Gastos de Ventas', type: 'gasto', level: 3 }
        ]
      },
      {
        code: '52',
        name: 'GASTOS NO OPERACIONALES',
        type: 'gasto',
        level: 2,
        children: [
          { code: '521', name: 'Otros Gastos', type: 'gasto', level: 3 }
        ]
      }
    ]
  }
];

// Configuraciones contables por defecto
const defaultConfigs = {
  ventas: {
    ingresos: { code: '411', name: 'Ventas', type: 'ingreso' },
    devoluciones: { code: '412', name: 'Devoluciones en Ventas', type: 'ingreso' }
  },
  compras: {
    gastos: { code: '511', name: 'Compras', type: 'gasto' },
    devoluciones: { code: '512', name: 'Devoluciones en Compras', type: 'gasto' }
  },
  bancos: {
    efectivo: { code: '1111', name: 'Caja', type: 'activo' },
    bancos: { code: '1112', name: 'Bancos', type: 'activo' }
  },
  clientes: {
    cuentasPorCobrar: { code: '1121', name: 'Clientes', type: 'activo' }
  },
  proveedores: {
    cuentasPorPagar: { code: '2111', name: 'Proveedores', type: 'pasivo' }
  }
};

// Función para crear cuentas de forma recursiva
async function createAccountsRecursively(accounts, parentId = null, tenantId, userId) {
  const createdAccounts = [];
  
  for (const accountData of accounts) {
    const account = new Account({
      code: accountData.code,
      name: accountData.name,
      type: accountData.type,
      level: accountData.level,
      parentId: parentId,
      tenant: tenantId,
      createdBy: userId,
      updatedBy: userId,
      isActive: true
    });
    
    const savedAccount = await account.save();
    createdAccounts.push(savedAccount);
    
    // Crear cuentas hijas si existen
    if (accountData.children && accountData.children.length > 0) {
      const childAccounts = await createAccountsRecursively(
        accountData.children, 
        savedAccount._id, 
        tenantId, 
        userId
      );
      createdAccounts.push(...childAccounts);
    }
  }
  
  return createdAccounts;
}

// Función para crear configuraciones contables
async function createAccountConfigs(tenantId, userId, allAccounts) {
  const configs = {};
  
  for (const [module, fields] of Object.entries(defaultConfigs)) {
    const moduleConfig = {};
    
    for (const [field, accountInfo] of Object.entries(fields)) {
      // Buscar la cuenta por código
      const account = allAccounts.find(acc => acc.code === accountInfo.code);
      
      if (account) {
        moduleConfig[field] = {
          accountId: account._id,
          accountCode: account.code,
          accountName: account.name,
          accountType: account.type
        };
      }
    }
    
    if (Object.keys(moduleConfig).length > 0) {
      const accountConfig = new AccountConfig({
        tenant: tenantId,
        module,
        configurations: new Map(Object.entries(moduleConfig)),
        createdBy: userId,
        updatedBy: userId
      });
      
      await accountConfig.save();
      configs[module] = moduleConfig;
    }
  }
  
  return configs;
}

// Función principal
async function loadDefaultAccounts() {
  try {
    
    // Conectar a la base de datos
    await connectDB();
    
    // Obtener el primer tenant (asumiendo que existe)
    const Tenant = (await import('../models/Tenant.js')).default;
    const tenant = await Tenant.findOne();
    
    if (!tenant) {
      process.exit(1);
    }
    
    
    // Obtener el primer usuario (asumiendo que existe)
    const User = (await import('../models/User.js')).default;
    const user = await User.findOne();
    
    if (!user) {
      process.exit(1);
    }
    
    
    // Verificar si ya existen cuentas para este tenant
    const existingAccounts = await Account.find({ tenant: tenant._id });
    
    if (existingAccounts.length > 0) {
      
      // En un script real, podrías usar readline para preguntar al usuario
      // Por ahora, continuamos automáticamente
    }
    
    // Crear cuentas
    const createdAccounts = await createAccountsRecursively(
      defaultAccounts, 
      null, 
      tenant._id, 
      user._id
    );
    
    
    // Crear configuraciones contables
    const configs = await createAccountConfigs(tenant._id, user._id, createdAccounts);
    
    
    // Mostrar resumen
    
    
  } catch (error) {
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  loadDefaultAccounts();
}

export default loadDefaultAccounts;
