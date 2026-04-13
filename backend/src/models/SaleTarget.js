import mongoose from "mongoose";

const SaleTargetSchema = new mongoose.Schema({
    partyId: { type: String, required: true }, // Linking to account name or identifier used in transactions
    partyName: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    periodType: { type: String, enum: ['Monthly', 'Quarterly', 'Yearly'], required: true },
    year: { type: Number, required: true },
    month: { type: Number }, // 1-12, relevant if periodType is Monthly
    quarter: { type: Number }, // 1-4, relevant if periodType is Quarterly
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
}, { timestamps: true });

// Ensure unique target per party per period per year
SaleTargetSchema.index({ partyId: 1, periodType: 1, year: 1, month: 1, quarter: 1, companyId: 1 }, { unique: true });

const SaleTarget = mongoose.model("SaleTarget", SaleTargetSchema);
export default SaleTarget;
