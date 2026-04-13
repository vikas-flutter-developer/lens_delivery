import mongoose from "mongoose";

const VendorSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    address: String,
    gstNo: String,
    remark: String,
    tags: [String]
});

export default mongoose.model("Vendor", VendorSchema);
