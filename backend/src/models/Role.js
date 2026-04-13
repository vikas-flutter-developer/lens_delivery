import mongoose from 'mongoose';
const { Schema } = mongoose;

const RoleSchema = new Schema({
    name: { type: String, required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    permissions: [{
        module: { type: String, required: true },
        view: { type: Boolean, default: false },
        add: { type: Boolean, default: false },
        edit: { type: Boolean, default: false },
        delete: { type: Boolean, default: false },
    }],
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Ensure role name is unique within a company
RoleSchema.index({ name: 1, companyId: 1 }, { unique: true });

const Role = mongoose.model("Role", RoleSchema);
export default Role;
