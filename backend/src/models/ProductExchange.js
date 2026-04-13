import mongoose from "mongoose";

const ProductExchangeSchema = new mongoose.Schema(
    {
        billData: {
            billSeries: { type: String, default: "Exchange" },
            billNo: { type: String, default: "" },
            date: { type: Date, default: Date.now },
            type: { type: String, default: "Lens" },
            godown: { type: String, default: "MT-1" },
            bookedBy: { type: String, default: "" },
        },
        partyData: {
            partyAccount: { type: String, default: "" },
            address: { type: String, default: "" },
            contactNumber: { type: String, default: "" },
        },
        exchangeOutItems: [
            {
                code: { type: String, default: "" },
                itemName: { type: String, default: "" },
                unit: { type: String, default: "" },
                dia: { type: String, default: "" },
                eye: { type: String, default: "" },
                sph: { type: Number, default: 0 },
                cyl: { type: Number, default: 0 },
                axis: { type: Number, default: 0 },
                add: { type: Number, default: 0 },
                qty: { type: Number, default: 0 },
                price: { type: Number, default: 0 },
                totalAmount: { type: Number, default: 0 },
            },
        ],
        exchangeInItems: [
            {
                code: { type: String, default: "" },
                itemName: { type: String, default: "" },
                unit: { type: String, default: "" },
                dia: { type: String, default: "" },
                eye: { type: String, default: "" },
                sph: { type: Number, default: 0 },
                cyl: { type: Number, default: 0 },
                axis: { type: Number, default: 0 },
                add: { type: Number, default: 0 },
                qty: { type: Number, default: 0 },
                price: { type: Number, default: 0 },
                totalAmount: { type: Number, default: 0 },
            },
        ],
        totals: {
            totalExchInQty: { type: Number, default: 0 },
            totalExchInAmnt: { type: Number, default: 0 },
            totalExchOutQty: { type: Number, default: 0 },
            totalExchOutAmnt: { type: Number, default: 0 },
        },
        remarks: { type: String, default: "" },
        status: {
            type: String,
            enum: ["Exchange-Out", "Exchange-In", "Completed"],
            default: "Completed",
        },
    },
    { timestamps: true }
);

const ProductExchange = mongoose.model("ProductExchange", ProductExchangeSchema);
export default ProductExchange;
