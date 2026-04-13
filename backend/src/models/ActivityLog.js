import mongoose from 'mongoose';
const { Schema } = mongoose;

const ActivityLogSchema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    action: { type: String, required: true }, // e.g., 'CREATE', 'UPDATE', 'DELETE', 'LOGIN'
    module: { type: String, required: true }, // e.g., 'Invoices', 'Users', 'Settings'
    details: { type: Schema.Types.Mixed }, // Store JSON details of the change
    ipAddress: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now },
});

const ActivityLog = mongoose.model("ActivityLog", ActivityLogSchema);
export default ActivityLog;
