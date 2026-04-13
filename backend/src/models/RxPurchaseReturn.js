import mongoose from "mongoose";
const RxPurchaseReturnSchema = new mongoose.Schema(
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
        dia: { type: String, default: "" },
        eye: { type: String, default: "" },
        sph: { type: Number, default: 0 },
        cyl: { type: Number, default: 0 },
        axis: { type: Number, default: 0 },
        add: { type: Number, default: 0 },
        qty: { type: Number, default: 0 },
        isInvoiced: { type: Boolean, default: false },
        purchasePrice: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 0 },
        sellPrice: { type: Number, default: 0 },
        combinationId: { type: String, default: "" },
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
    deliveryDate: { type: Date, default: Date.now() },
    time: {
      type: String,
      default: () => new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
    },
    remark: { type: String, default: "" },
    status: {
      type: String,
      default: "Pending",
      enum: ["Pending", "Shipped", "Received"],
    },
    summary: {
      totalQty: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
    },
    dcId: { type: String, default: "" },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
  },
  { timestamps: true }
);

const RxPurchaseReturn = mongoose.model(
  "RxPurchaseReturn",
  RxPurchaseReturnSchema
);
export default RxPurchaseReturn;
