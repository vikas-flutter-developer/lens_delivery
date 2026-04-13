import mongoose from 'mongoose';
const { Schema } = mongoose;

const CompanySchema = new Schema({
    name: { type: String, required: true },
    address: { type: String, default: "" },
    contactPerson: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
    email: { type: String, default: "" },
    loginPassword: { type: String, default: "" }, // Hashed password for company-level login
    isActive: { type: Boolean, default: true },

    // SaaS Subscription
    subscriptionStatus: { 
        type: String, 
        enum: ['trial', 'active', 'expired', 'suspended'], 
        default: 'trial' 
    },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    billingCycle: { 
        type: String, 
        enum: ['monthly', 'quarterly', 'yearly'], 
        default: 'monthly' 
    },
    subscriptionStartDate: { type: Date, default: Date.now },
    planExpiryDate: { type: Date },
    gracePeriodEndDate: { type: Date },
    isTrial: { type: Boolean, default: true },

    // WhatsApp Configuration
    whatsapp_access_token: { type: String, default: "" },
    whatsapp_phone_number_id: { type: String, default: "" },
    whatsapp_business_number: { type: String, default: "" },
    whatsapp_enabled: { type: Boolean, default: false },

    // Branding & Settings
    settings: {
        logo: { type: String, default: "" },
        brandingName: { type: String, default: "" },
        themeColor: { type: String, default: "#000000" },
    },

    // Auto Invoice Configuration
    autoInvoiceEnabled: { type: Boolean, default: false },
    invoiceDates: { type: [Number], default: [] }, // e.g. [15, 30]

}, { timestamps: true });

const Company = mongoose.model("Company", CompanySchema);
export default Company;
