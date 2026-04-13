import mongoose from "mongoose";

const suggestionSchema = new mongoose.Schema({
  type: { type: String, enum: ["tax", "customer"], required: true },
  value: { type: String, required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null }
}, { timestamps: true });

suggestionSchema.index({ type: 1, value: 1, companyId: 1 }, { unique: true });

export default mongoose.model("Suggestion", suggestionSchema);
