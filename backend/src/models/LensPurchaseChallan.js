import mongoose from "mongoose";



const PurchaseChallanSchema = new mongoose.Schema(
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
        sph: { type: mongoose.Schema.Types.Mixed, default: 0 },
        cyl: { type: mongoose.Schema.Types.Mixed, default: 0 },
        axis: { type: mongoose.Schema.Types.Mixed, default: 0 },
        add: { type: mongoose.Schema.Types.Mixed, default: 0 },
        qty: { type: Number, default: 0 },
        isInvoiced: { type: Boolean, default: false },
        purchasePrice: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 0 },
        sellPrice: { type: Number, default: 0 },
        mrp: { type: Number, default: 0 },
        salePrice: { type: Number, default: 0 },
        importDate: { type: Date, default: null },
        expiryDate: { type: Date, default: null },
        vendor: { type: String, default: "" },
        combinationId: { type: String, default: "" },
        orderNo: { type: String, default: "" },
        remark: { type: String, default: "" },
        // Item-level status tracking
        itemStatus: {
          type: String,
          enum: ["Pending", "In Progress", "Done", "Cancelled"],
          default: "Pending"
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
          invoiceId: { type: String },
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
    deliveryDate: { type: Date, default: Date.now() },
    time: {
      type: String,
      default: () => new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
    },
    remark: { type: String, default: "" },
    // Parent-level status derived from item statuses
    parentStatus: {
      type: String,
      enum: ["Pending", "In Progress", "Done", "Cancelled"],
      default: "Pending"
    },
    status: {
      type: String,
      default: "Pending",
      enum: ["Pending", "In Progress", "Done", "Cancelled"],
    },
    cancelReason: { type: String, default: "" },
    isInvoiced: { type: Boolean, default: false }, // Flag to track if challan has been converted to invoice
    sourcePurchaseId: { type: mongoose.Schema.Types.ObjectId, default: null }, // Reference to source purchase order
    orderType: { type: String, enum: ['LENS', 'RX', 'CONTACT'], default: 'LENS' },
    settlementDate: { type: Date, default: null },
    dcId: { type: String, default: "" },
    usedIn: {
      type: [
        {
          type: { type: String },
          number: { type: String },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

const PurchaseChallan = mongoose.model("PurchaseChallan", PurchaseChallanSchema);
export default PurchaseChallan;
