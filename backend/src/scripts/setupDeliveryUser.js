import mongoose from 'mongoose';
import Company from '../models/Company.js';
import User from '../models/User.js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function createDeliveryUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    let company = await Company.findOne();
    if (!company) {
      console.log('No company found, creating a test company...');
      company = await Company.create({
        name: 'Test Delivery Company',
        isActive: true,
      });
    }
    console.log('Using Company:', company.name, 'ID:', company._id);

    const email = 'delivery@example.com';
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      console.log('User already exists, updating role and password...');
      existingUser.role = 'delivery_person';
      existingUser.password = await bcrypt.hash('delivery123', 10);
      existingUser.companyId = company._id;
      await existingUser.save();
    } else {
      console.log('Creating new Delivery Person user...');
      const hashedPassword = await bcrypt.hash('delivery123', 10);
      await User.create({
        name: 'John Delivery',
        email: email,
        password: hashedPassword,
        role: 'delivery_person',
        companyId: company._id,
      });
    }

    console.log('Successfully set up test user:');
    console.log('Email: delivery@example.com');
    console.log('Password: delivery123');
    console.log('Role: delivery_person');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Setup failed:', err);
    process.exit(1);
  }
}

createDeliveryUser();
