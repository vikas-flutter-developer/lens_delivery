import mongoose from "mongoose";
const { Schema } = mongoose;

const ProductPowerGroupPricingSchema = new Schema(
    {
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: false, // For safety with existing multi-tenant logic
        },
        partyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Account",
            required: true,
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "LensGroup",
            required: true,
        },
        powerGroupId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        priceType: {
            type: String,
            enum: ["Sale", "Purchase"],
            default: "Sale",
        },
        customPrice: {
            type: Number,
            required: true,
            default: 0,
        },
    },
    { timestamps: true }
);

// Compound index for efficient queries and uniqueness
ProductPowerGroupPricingSchema.index({ companyId: 1, partyId: 1, productId: 1, powerGroupId: 1, priceType: 1 }, { unique: true });

const ProductPowerGroupPricing = mongoose.model("ProductPowerGroupPricing", ProductPowerGroupPricingSchema);
export default ProductPowerGroupPricing;
