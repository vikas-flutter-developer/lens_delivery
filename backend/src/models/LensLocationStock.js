import mongoose from "mongoose";

const LensLocationStockSchema = new mongoose.Schema(
    {
        item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
        group_id: { type: String, default: "" }, // Derived from Item.groupName or referenced
        sph: { type: Number, default: 0 },
        cyl: { type: Number, default: 0 },
        add_power: { type: Number, default: 0 },
        eye: { type: String, default: "" },
        quantity: { type: Number, default: 0 },
        godown: { type: String, default: "" },
        rack_no: { type: String, default: "" },
        box_no: { type: String, default: "" },
        companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    },
    { timestamps: true }
);

const LensLocationStock = mongoose.model("LensLocationStock", LensLocationStockSchema);
export default LensLocationStock;
