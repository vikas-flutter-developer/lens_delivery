import mongoose from 'mongoose';
const { Schema } = mongoose;

const SystemSettingSchema = new Schema({
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    description: { type: String },
    group: { type: String, default: 'general' }, // e.g., 'email', 'api', 'branding'
}, { timestamps: true });

const SystemSetting = mongoose.model("SystemSetting", SystemSettingSchema);
export default SystemSetting;
