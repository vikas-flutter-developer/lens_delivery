import mongoose from "mongoose";
import Group from "./Group.js";
const { Schema } = mongoose;

const ProductSchema = new Schema({
  itemName: { type: String, required: true, unique: true },
  vendorItemName: { type: String, default: "" },
  billItemName: { type: String, default: "" },
  TaxCategory: { type: String, default: "" },
  alias: String,
  printName: String,
  groupName: String,
  unit: String,
  altUnit: String,
  description: String,
  taxSetting: String,
  openingStockQty: Number,
  openingStockValue: Number,
  purchasePrice: Number,
  saleProfit: Number,
  salePrice: Number,
  mrpPrice: Number,
  saleDiscount: Number,
  purchaseDiscount: Number,
  minSalePrice: Number,
  hsnCode: String,
  barcode: String,
  stockable: Boolean,
  godown: String,
  loyaltyPoints: Number,
  refAmn: Number,
  refAmntIndia: Number,
  forLensProduct: Boolean,
  typeOfsupply: String,
  location: String,
  boxNo: String,
  alertQty: { type: Number, default: 0 },
  minStock: { type: Number, default: 0 },
  maxStock: { type: Number, default: 0 },
  minReorderQty: { type: Number, default: 0 },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
}, { timestamps: true });

export default mongoose.model("Item", ProductSchema);
