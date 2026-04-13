import mongoose from 'mongoose';

const voucherRowSchema = new mongoose.Schema({
    sn: Number,
    dc: { type: String, enum: ['C', 'D'] },
    account: { type: String, required: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    balance: { type: Number, default: 0 },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    modeOfPayment: { type: String, enum: ['Cash', 'Bank', 'Cheque'], default: 'Cash' },
    docType: String,
    chqDocNo: String,
    chqDocDate: Date,
    shortNarration: String,
    remark: String
});

const voucherSchema = new mongoose.Schema({
    recordType: { type: String, enum: ['Payment', 'Receipt', 'Journal', 'Contra', 'Debit', 'Credit'], required: true },
    billSeries: { type: String, required: true },
    billNo: { type: mongoose.Schema.Types.Mixed, required: true }, // can be string or num
    date: { type: Date, required: true },
    gstApplicable: { type: String, default: 'Not Applicable' },
    inputTaxCredit: { type: String, default: 'Not Applicable' },
    rcm: { type: String, default: 'Not Applicable' },
    rows: [voucherRowSchema],
    totalDebit: { type: Number, default: 0 },
    totalCredit: { type: Number, default: 0 },
    remarks: String,
    reffSeries: String,
    reffPurchaseNo: String,
    odrSeries: String,
    vouchNo: String,
    reffPurchaseDate: Date,
    other: String
}, { timestamps: true });

export default mongoose.model('Voucher', voucherSchema);
