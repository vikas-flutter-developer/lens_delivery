import mongoose from 'mongoose';
const { Schema } = mongoose;

const ShortcutKeySchema = new Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pageName: { type: String, required: true },
  module: { type: String, required: true },
  shortcutKey: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['Enabled', 'Disabled'], default: 'Enabled' },
  url: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("ShortcutKey", ShortcutKeySchema);
