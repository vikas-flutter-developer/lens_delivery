import mongoose from "mongoose";

const OfferSchema = new mongoose.Schema({
    groupName: { type: String, required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    lensGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'LensGroup' },
    defaultPrice: { type: Number, required: true },
    percentage: { type: Number, required: true },
    qty: { type: Number, required: true },
    offerPrice: { type: Number, required: true },
    status: { type: String, enum: ['OFFER SET', 'DEFAULT'], default: 'OFFER SET' }
}, { timestamps: true });

// Ensure a group has only one offer per product/lens group
// Using partial indexes to avoid null conflicts in compound unique indexes
OfferSchema.index(
    { groupName: 1, itemId: 1 },
    { unique: true, partialFilterExpression: { itemId: { $exists: true } } }
);
OfferSchema.index(
    { groupName: 1, lensGroupId: 1 },
    { unique: true, partialFilterExpression: { lensGroupId: { $exists: true } } }
);

const Offer = mongoose.model("Offer", OfferSchema);
export default Offer;
