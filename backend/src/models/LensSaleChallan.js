import mongoose from "mongoose";

const SaleChallanSchema = new mongoose.Schema(
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
        isInvoiced: { type: Boolean, default: false },
        salePrice: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 0 },
        sellPrice: { type: Number, default: 0 },
        purchasePrice: { type: Number, default: 0 },
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
    deliveryPerson: { type: String, default: "" },
    deliveryPersonAssignedAt: { type: Date, default: null },
    // Parent-level status derived from item statuses
    parentStatus: {
      type: String,
      enum: ["Pending", "In Progress", "Done", "Cancelled"],
      default: "Pending"
    },
    // Legacy status field - kept for backward compatibility
    status: {
      type: String,
      default: "Pending",
      enum: ["Pending", "In Progress", "Done", "Cancelled"],
    },
    // Delivery tracking fields
    outForDeliveryTime: { type: Date, default: null },
    deliveredTime: { type: Date, default: null },
    dispatchTime: { type: Date, default: null },
    deliveryCompletionTime: { type: Date, default: null },
    arrivalTime: { type: Date, default: null },
    deliveryOtp: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    deliveryStatus: {
      type: String,
      enum: ["Pending", "Out for Delivery", "Delivered"],
      default: "Pending"
    },
    cancelReason: { type: String, default: "" },
    isInvoiced: { type: Boolean, default: false }, // Flag to track if challan has been converted to invoice
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'LensSale', default: null },
    settlementDate: { type: Date, default: null },

    // Auto-invoice and reminder fields
    autoInvoiceDate: { type: Date },
    reminderSent: { type: Boolean, default: false },
    reminderSentAt: { type: Date, default: null },
    reminderType: { type: String, enum: ['WhatsApp', 'Email', 'Both', null], default: null },
    whatsappStatus: { type: String, default: null },
    whatsappResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    emailStatus: { type: String, default: null },
    emailResponse: { type: mongoose.Schema.Types.Mixed, default: null },

    // Track source order type and ID for proper syncing
    orderType: { type: String, enum: ['LENS', 'RX', 'CONTACT', null], default: null },
    sourceSaleId: { type: mongoose.Schema.Types.ObjectId, default: null },
    usedIn: {
      type: [
        {
          type: { type: String },
          number: { type: String },
        },
      ],
      default: [],
    },

    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
  },
  { timestamps: true }
);

const SaleChallan = mongoose.model("SaleChallan", SaleChallanSchema);
export default SaleChallan;
