import mongoose from 'mongoose';

const BackupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['daily', 'weekly', 'monthly', 'manual'], required: true },
  size: { type: Number }, // in bytes, optional initially
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  storageLocation: { type: String, enum: ['local', 'cloud'], default: 'local' },
  cloudPath: { type: String },
  localPath: { type: String },
  error: { type: String }
}, { timestamps: true });

export default mongoose.model('Backup', BackupSchema);
