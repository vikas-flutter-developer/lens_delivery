import mongoose from "mongoose";
const TaxCategorySchema = new mongoose.Schema({
  Name: { type: String, required: true, unique: true },
  type: { type: String, enum: ["goods", "services"], required: true },
  localTax1: { type: Number, default: 0 }, // CGST %
  localTax2: { type: Number, default: 0 }, // SGST %
  centralTax: { type: Number, default: 0 }, // IGST %
  cessTax: { type: Number, default: 0 }, // CESS %
  taxOnMRP: { type: Boolean, default: false },
  isDefault: { type: Boolean, default: false },
  remarks: { type: String },

}, {timestamps : true});

export default mongoose.model("TaxCategory", TaxCategorySchema);
