import mongoose from 'mongoose';
const { Schema } = mongoose;

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    unique: true,
    required: true,
    lowercase: true,
    trim: true,
  },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["admin", "manager", "employee", "super_admin", "delivery_person"],
    default: "employee",
  },
  roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  isActive: { type: Boolean, default: true },
  isImpersonated: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  lastLogin: Date,
  loginHistory: [Date],
  resetPasswordOTP: { type: String },
  resetPasswordExpires: { type: Date },
});

export default mongoose.model("User", UserSchema);