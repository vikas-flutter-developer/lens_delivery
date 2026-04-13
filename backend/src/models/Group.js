import mongoose from "mongoose";
const { Schema } = mongoose;

const GroupSchema = new Schema({
    groupName: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
}, { timestamps: true })

export default mongoose.model("Group", GroupSchema);