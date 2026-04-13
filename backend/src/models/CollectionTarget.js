import mongoose from "mongoose";

const CollectionTargetSchema = new mongoose.Schema({
    partyId: { type: String, required: true },
    partyName: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    targetType: { type: String, enum: ['Customer', 'Vendor'], required: true },
    periodType: { type: String, enum: ['Monthly', 'Quarterly', 'Yearly'], required: true },
    year: { type: Number, required: true },
    month: { type: Number }, // 1-12, if Monthly
    quarter: { type: Number }, // 1-4, if Quarterly
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
}, { timestamps: true });

// Unique target per party + type + period
CollectionTargetSchema.index(
    { partyId: 1, targetType: 1, periodType: 1, year: 1, month: 1, quarter: 1, companyId: 1 },
    { unique: true }
);

const CollectionTarget = mongoose.model("CollectionTarget", CollectionTargetSchema);
export default CollectionTarget;
