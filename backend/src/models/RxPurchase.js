import mongoose from "mongoose";

const RxPurchaseSchema = new mongoose.Schema(
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
        purchasePrice: { type: Number, default: 0 },
        salePrice: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 0 },
        sellPrice: { type: Number, default: 0 },
        remark: { type: String, default: "" },
        vendor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Account",
          default: null,
        },
        refId: {
          type: Number,
          default: 0,
        },
        combinationId: { type: String, default: "" },
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
    grossAmount: { type: Number, default: 0 }, // sum of (qty * purchasePrice) - (discount amounts)
    subtotal: { type: Number, default: 0 }, // sum of item.totalAmount (before taxes)
    taxesAmount: { type: Number, default: 0 }, // sum of taxes.amount
    netAmount: { type: Number, default: 0 }, // subtotal + taxesAmount
    paidAmount: { type: Number, default: 0 }, // amount paid now (if none then 0)
    dueAmount: { type: Number, default: 0 }, // netAmount - paidAmount
    remark: { type: String, default: "" },
    summary: {
      totalQty: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
    },

    status: {
      type: String,
      enum: ["Pending", "In Progress", "Done", "Cancelled"],
      default: "Pending",
    },
    parentStatus: {
      type: String,
      enum: ["Pending", "In Progress", "Done", "Cancelled"],
      default: "Pending",
    },
    dcId: { type: String, default: "" },
  },
  { timestamps: true }
);

const RxPurchase = mongoose.model("RxPurchase", RxPurchaseSchema);
export default RxPurchase;
