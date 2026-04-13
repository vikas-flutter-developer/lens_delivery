import mongoose from "mongoose";
const { Schema } = mongoose;

const AccountSchema = new Schema(
  {
    Name: { type: String, required: true, trim: true },
    Alias: { type: String, trim: true, default: "" },
    PrintName: { type: String, required: true, trim: true },
    AccountId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    // arrays
    Groups: { type: [String], required: true, default: [] },
    Stations: { type: [String], required: true, default: [] },

    AccountDealerType: {
      type: String,
      required: true,
      enum: ["Registerd", "unregisterd", "composition", "uin holder"],
      trim: true,
    },
    GSTIN: { type: String, trim: true, default: "" },
    Transporter: { type: String, trim: true, default: "" },
    ContactPerson: { type: String, trim: true, default: "" },

    OpeningBalance: {
      balance: { type: Number, default: 0 },
      type: { type: String, enum: ["Dr", "Cr"], default: "Dr" },
    },

    PreviousYearBalance: {
      balance: { type: Number, default: 0 },
      type: { type: String, enum: ["Dr", "Cr"], default: "Dr" },
    },

    CurrentBalance: {
      amount: { type: Number, default: 0 },
      type: { type: String, enum: ["Dr", "Cr"], default: "Dr" },
    },

    CreditLimit: { type: Number, default: 0 },
    CreditDays: { type: Number, default: 0 },

    EnableLoyality: { type: String, enum: ["Y", "N"], default: "Y" },

    AccountCategory: {
      type: String,
      enum: [
        "default",
        "category1",
        "category2",
        "category3",
        "category4",
        "category5",
      ],
      default: "default",
    },


    CardNumber: { type: String, trim: true, default: "" },

    Address: { type: String, trim: true, default: "" },
    Addresses: { type: [String], default: [] },
    State: { type: String, required: true, trim: true },
    Email: { type: String, trim: true, default: "" },
    TelNumber: { type: String, trim: true, default: "" },
    MobileNumber: { type: String, trim: true, default: "" },

    Pincode: { type: String, trim: true, default: "" },
    Distance: { type: String, trim: true, default: "" },
    ItPlan: { type: String, trim: true, default: "" },

    LstNumber: { type: Number, default: null },
    CstNumber: { type: Number, default: null },
    AdharCardNumber: { type: Number, default: null },

    Dnd: { type: String, trim: true, default: "" },
    Ex1: { type: String, trim: true, default: "" },
    DayLimit: { type: String, trim: true, default: "" },
    AccountType: { type: String, enum: ["Sale", "Purchase", "Both"], default: "Both", trim: true },
    Password: { type: String, trim: true, default: "" },
    Remark: { type: String, trim: true, default: "" },
    isOtpWhitelisted: { type: Boolean, default: false },
    Tags: { type: [String], default: [] },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
  },
  { timestamps: true }
);

const Account = mongoose.model("Account", AccountSchema);
export default Account;
