import mongoose from "mongoose";

const ContactLensSaleOrderSchema = new mongoose.Schema(
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
        refNo: { type: String, default: "" },
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
                billItemName: { type: String, default: "" },
                vendorItemName: { type: String, default: "" },
                unit: { type: String, default: "" },
                dia: { type: String, default: "" },
                eye: { type: String, default: "" },
                sph: { type: Number, default: 0 },
                cyl: { type: Number, default: 0 },
                axis: { type: Number, default: 0 },
                add: { type: Number, default: 0 },
                qty: { type: Number, default: 0 },
                importDate: { type: Date, default: null },
                expiryDate: { type: Date, default: null },
                mrp: { type: Number, default: 0 },
                salePrice: { type: Number, default: 0 },
                discount: { type: Number, default: 0 },
                totalAmount: { type: Number, default: 0 },
                isInvoiced: { type: Boolean, default: false },
                isChallaned: { type: Boolean, default: false },
                combinationId: { type: String, default: "" },
                orderNo: { type: String, default: "" },
                remark: { type: String, default: "" },
                vendor: { type: String, default: "" },
                itemStatus: {
                    type: String,
                    default: "Pending",
                    enum: ["Pending", "In Progress", "Done", "Shipped", "Delivered", "Cancelled", "On Approval"],
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
            enum: ["Pending", "In Progress", "Done", "Shipped", "Delivered", "Cancelled", "On Approval"],
        },
        cancelReason: { type: String, default: "" },
        usedIn: {
            type: [
                {
                    type: { type: String },
                    number: { type: String },
                },
            ],
            default: [],
        },
        companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
        isOrderPlaced: { type: Boolean, default: false },
        orderPlacedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

const ContactLensSaleOrder = mongoose.model("ContactLensSaleOrder", ContactLensSaleOrderSchema);
export default ContactLensSaleOrder;
