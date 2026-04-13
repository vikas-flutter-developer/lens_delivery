import mongoose from "mongoose";

const BarcodeLensDataSchema = new mongoose.Schema(
    {
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
            index: true,
        },
        barcode: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "LensGroup",
            required: true,
        },
        sph: {
            type: Number,
            default: 0,
        },
        cyl: {
            type: Number,
            default: 0,
        },
        axis: {
            type: Number,
            default: 0,
        },
        add: {
            type: Number,
            default: 0,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

// Ensure barcode is unique within a company if needed,
// but the requirement says "Avoid duplicate barcode entries (optional configurable behavior)".
// For now, making it globally unique or unique per company.
// Global unique is safer if barcodes are physical tags.
// BarcodeLensDataSchema.index({ companyId: 1, barcode: 1 }, { unique: true });

const BarcodeLensData = mongoose.model("BarcodeLensData", BarcodeLensDataSchema);
export default BarcodeLensData;
