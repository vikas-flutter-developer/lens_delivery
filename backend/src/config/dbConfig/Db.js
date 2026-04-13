import mongoose from 'mongoose';
import config from '../env.js';
import { tenantPlugin } from '../../middlewares/tenantSupport.js';

// Apply the global multi-tenancy plugin to ALL mongoose models
mongoose.plugin(tenantPlugin);

try {
  await mongoose.connect(config.MONGO_URI);
  console.log('Connected to MongoDB successfully!');
} catch (err) {
  console.log(err);
}