import mongoose from "mongoose";
const { Schema } = mongoose;

const AccountWisePriceSchema = new Schema(
    {
        accountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Account",
            required: true,
        },
        // We can have either an Item or a LensGroup
        itemId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Item",
            required: false,
        },
        lensGroupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "LensGroup",
            required: false,
        },
        customPrice: {
            type: Number,
            required: true,
            default: 0,
        },
        percentage: {
            type: Number,
            required: false,
            default: 0,
        },
        status: {
            type: String,
            default: "CUSTOM",
        },
        type: {
            type: String,
            enum: ["Sale", "Purchase"],
            default: "Sale",
        }
    },
    { timestamps: true }
);

// Individual index for lookups
AccountWisePriceSchema.index({ accountId: 1, itemId: 1, type: 1 });
AccountWisePriceSchema.index({ accountId: 1, lensGroupId: 1, type: 1 });

const AccountWisePrice = mongoose.model("AccountWisePrice", AccountWisePriceSchema);
export default AccountWisePrice;
