import mongoose from "mongoose";

const DeletedLogSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ["item", "group", "transaction", "master", "account", "accountGroup", "vendor"],
    },
    name: {
        type: String,
        required: true,
    },
    groupName: {
        type: String,
    },
    originalData: {
        type: Object,
        required: true,
    },
    deletedDate: {
        type: Date,
        default: Date.now,
    },
    deletedBy: {
        type: String,
        default: "Admin",
    },
}, { timestamps: true });

export default mongoose.model("DeletedLog", DeletedLogSchema);
