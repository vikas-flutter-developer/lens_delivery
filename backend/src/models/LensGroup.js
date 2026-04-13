import mongoose from "mongoose";

const SaleEntrySchema = new mongoose.Schema({
  qty: { type: Number, required: true },
  salePrice: { type: Number, required: true },
  soldAt: { type: Date, default: Date.now },
  billNo: String,
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "Buyer" }
});


const CombinationSchema = new mongoose.Schema({
  sph: Number,
  cyl: Number,
  axis: Number,
  eye: String,
  barcode: String,
  boxNo: String,
  alertQty: Number,
  pPrice: Number,
  sPrice: Number,
  initStock: Number,
  totalSoldQty: { type: Number, default: 0 },
  totalSaleAmount: { type: Number, default: 0 },
  locations: [{
    godown: String,
    rack: String,
    box: String
  }],
  locationQty: String,
  isVerified: { type: Boolean, default: false },
  lastVerifiedDate: { type: Date },
  verifiedQty: { type: Number }
});


const AddGroupSchema = new mongoose.Schema({
  addValue: Number,
  combinations: [CombinationSchema]
});

const LensGroupSchema = new mongoose.Schema({
  groupName: { type: String, required: true },
  productName: { type: String, required: true, unique: true },
  vendorItemName: { type: String, default: "" },
  billItemName: { type: String, default: "" },
  visionType: {
    type: String,
    enum: ["single", "bifocal"],
    required: true
  },

  sphMin: Number,
  sphMax: Number,
  sphStep: Number,

  cylMin: Number,
  cylMax: Number,
  cylStep: Number,

  addMin: Number,
  addMax: Number,
  addStep: Number,

  axis: Number,
  eye: String,

  purchasePrice: { type: Number, default: 0 },

  salePrice: {
    default: { type: Number, default: 0 },
  },
  isPriceUpdated: { type: Boolean, default: false },

  addGroups: [AddGroupSchema],
  powerGroups: [{
    sphMin: Number,
    sphMax: Number,
    sphStep: { type: Number, default: 0.25 },
    cylMin: Number,
    cylMax: Number,
    cylStep: { type: Number, default: 0.25 },
    addMin: Number,
    addMax: Number,
    addStep: { type: Number, default: 0.25 },
    axis: Number,
    eye: String,
    label: String,
    purchasePrice: { type: Number, default: 0 },
    salePrice: { type: Number, default: 0 }
  }],
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
}, {
  timestamps: true
});

const LensGroup = mongoose.model("LensGroup", LensGroupSchema);
export default LensGroup;
