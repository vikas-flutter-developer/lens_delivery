import mongoose from 'mongoose';
const { Schema } = mongoose;

const PlanSchema = new Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    prices: {
        monthly: { type: Number, required: true },
        quarterly: { type: Number, required: true },
        yearly: { type: Number, required: true }
    },
    limits: {
        maxUsers: { type: Number, default: 5 },
        maxStorageGB: { type: Number, default: 1 },
        maxOrdersPerMonth: { type: Number, default: 100 },
        maxItems: { type: Number, default: 1000 }
    },
    features: [String],
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Plan = mongoose.model("Plan", PlanSchema);
export default Plan;
