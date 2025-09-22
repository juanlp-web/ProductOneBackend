import mongoose from 'mongoose';
import BankTransaction from './models/BankTransaction.js';
import Bank from './models/Bank.js';

// Conectar a MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/innovadomprod');
  } catch (error) {
    process.exit(1);
  }
};

// Función de prueba
const testBankTransaction = async () => {
  try {
    
    // Buscar una cuenta bancaria existente
    const bank = await Bank.findOne();
    if (!bank) {
      return;
    }
    
    
    // Crear una transacción de prueba
    const transactionData = {
      bank: bank._id,
      type: 'deposit',
      amount: 100.00,
      previousBalance: bank.currentBalance,
      newBalance: bank.currentBalance + 100.00,
      description: 'Transacción de prueba',
      referenceType: 'manual',
      createdBy: new mongoose.Types.ObjectId(), // ID ficticio para la prueba
      tenant: bank.tenant
    };
    
    
    const transaction = await BankTransaction.create(transactionData);
    
    // Buscar la transacción creada
    const foundTransaction = await BankTransaction.findById(transaction._id);
    
    // Limpiar - eliminar la transacción de prueba
    await BankTransaction.findByIdAndDelete(transaction._id);
    
  } catch (error) {
  }
};

// Ejecutar prueba
const runTest = async () => {
  await connectDB();
  await testBankTransaction();
  await mongoose.connection.close();
};

runTest();
