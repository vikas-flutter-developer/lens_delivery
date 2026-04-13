import mongoose from 'mongoose';
const { Schema } = mongoose;

const PaymentSchema = new Schema({
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
    billingCycle: { type: String, enum: ['monthly', 'quarterly', 'yearly'], required: true },
    amount: { type: Number, required: true },
    gstAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    paymentDate: { type: Date, default: Date.now },
    expiryDate: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'paid' },
    transactionId: { type: String, unique: true },
    paymentMethod: { type: String, enum: ['manual', 'razorpay', 'stripe', 'other'], default: 'manual' },
    
    // Invoice specific
    invoiceNumber: { type: String, unique: true },
    billingDetails: {
        name: String,
        address: String,
        email: String,
        phoneNumber: String
    },
    notes: { type: String },
    isRefunded: { type: Boolean, default: false }
}, { timestamps: true });

const Payment = mongoose.model("Payment", PaymentSchema);
export default Payment;
