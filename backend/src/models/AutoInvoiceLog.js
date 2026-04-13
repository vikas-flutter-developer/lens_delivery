import mongoose from 'mongoose';

const AutoInvoiceLogSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    runDate: { type: Date, required: true },
    status: { type: String, enum: ['success', 'failed', 'skipped'], default: 'success' },
    details: { type: String, default: "" },
    error: { type: String, default: "" },
    processedChallansCount: { type: Number, default: 0 }
}, { timestamps: true });

// Ensure we don't double run for the same company on the same day easily
// Actually, check logic in code is safer, but index helps.
AutoInvoiceLogSchema.index({ companyId: 1, runDate: 1 });

const AutoInvoiceLog = mongoose.model('AutoInvoiceLog', AutoInvoiceLogSchema);
export default AutoInvoiceLog;
