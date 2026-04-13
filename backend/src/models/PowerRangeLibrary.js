import mongoose from "mongoose";

const PowerRangeLibrarySchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    sphMin: { type: Number, default: 0 },
    sphMax: { type: Number, default: 0 },
    sphStep: { type: Number, default: 0.25 },
    cylMin: { type: Number, default: 0 },
    cylMax: { type: Number, default: 0 },
    cylStep: { type: Number, default: 0.25 },
    addMin: { type: Number, default: 0 },
    addMax: { type: Number, default: 0 },
    addStep: { type: Number, default: 0.25 },
    label: { type: String, required: true },
    groupNames: [{ type: String }],
}, {
    timestamps: true
});

// Ensure uniqueness per company for the same range values
PowerRangeLibrarySchema.index({
    companyId: 1,
    sphMin: 1, sphMax: 1,
    cylMin: 1, cylMax: 1,
    addMin: 1, addMax: 1
}, { unique: true });

const PowerRangeLibrary = mongoose.model("PowerRangeLibrary", PowerRangeLibrarySchema);
export default PowerRangeLibrary;
