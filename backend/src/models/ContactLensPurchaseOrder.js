import mongoose from "mongoose";

const ContactLensPurchaseOrderSchema = new mongoose.Schema(
    {
        billData: {
            billSeries: { type: String, default: "" },
            billNo: { type: String, default: "" },
            date: { type: Date, default: Date.now },
            billType: { type: String, default: "" },
            bankAccount: { type: String, default: "" },
            godown: { type: String, default: "" },
            bookedBy: { type: String, default: "" },
        },
        partyData: {
            partyAccount: { type: String, default: "" },
            address: { type: String, default: "" },
            contactNumber: { type: String, default: "" },
            stateCode: { type: String, default: "" },
            creditLimit: { type: Number, default: 0 },
            CurrentBalance: {
                amount: { type: Number, default: 0 },
                type: { type: String, enum: ["Dr", "Cr"], default: "Dr" },
            },
        },
        items: [
            {
                barcode: { type: String, default: "" },
                itemName: { type: String, default: "" },
                unit: { type: String, default: "" },
                qty: { type: Number, default: 0 },
                importDate: { type: Date, default: null },
                expiryDate: { type: Date, default: null },
                mrp: { type: Number, default: 0 },
                purchasePrice: { type: Number, default: 0 },
                salePrice: { type: Number, default: 0 },
                discount: { type: Number, default: 0 },
                totalAmount: { type: Number, default: 0 },
                isInvoiced: { type: Boolean, default: false },
                isChallaned: { type: Boolean, default: false },
                remark: { type: String, default: "" },
                vendor: { type: String, default: "" },
                combinationId: { type: String, default: "" },
                orderNo: { type: String, default: "" },
                eye: { type: String, default: "" },
                sph: { type: String, default: "" },
                cyl: { type: String, default: "" },
                axis: { type: String, default: "" },
                add: { type: String, default: "" },
                itemStatus: {
                    type: String,
                    enum: ["Pending", "In Progress", "Done", "Cancelled"],
                    default: "Pending",
                },
            },
        ],
        taxes: [
            {
                taxName: { type: String, default: "" },
                type: { type: String, default: "Additive" },
                percentage: { type: Number, default: 0 },
                amount: { type: Number, default: 0 },
                meta: { type: mongoose.Schema.Types.Mixed, default: {} },
            },
        ],
        orderQty: { type: Number, default: 0 },
        usedQty: { type: Number, default: 0 },
        balQty: { type: Number, default: 0 },
        usageHistory: {
            type: [
                {
                    challanId: { type: String },
                    billNo: { type: String },
                    series: { type: String },
                    qtyUsed: { type: Number },
                    date: { type: Date, default: Date.now },
                },
            ],
            default: [],
        },
        grossAmount: { type: Number, default: 0 },
        subtotal: { type: Number, default: 0 },
        taxesAmount: { type: Number, default: 0 },
        netAmount: { type: Number, default: 0 },
        paidAmount: { type: Number, default: 0 },
        dueAmount: { type: Number, default: 0 },
        deliveryDate: { type: Date, default: Date.now },
        time: {
            type: String,
            default: () => new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
        },
        remark: { type: String, default: "" },
        status: {
            type: String,
            default: "Pending",
            enum: ["Pending", "In Progress", "Done", "Shipped", "Delivered", "Cancelled"],
        },
        cancelReason: { type: String, default: "" },
        parentStatus: {
            type: String,
            default: "Pending",
            enum: ["Pending", "In Progress", "Done", "Cancelled"],
        },
        usedIn: {
            type: [
                {
                    type: { type: String },
                    number: { type: String },
                },
            ],
            default: [],
        },
        sourceSaleId: { type: String, default: "" }, // Add sourceSaleId field
    },
    { timestamps: true }
);

const ContactLensPurchaseOrder = mongoose.model("ContactLensPurchaseOrder", ContactLensPurchaseOrderSchema);
export default ContactLensPurchaseOrder;
