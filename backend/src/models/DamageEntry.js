import mongoose from 'mongoose';

const damageItemSchema = new mongoose.Schema({
    code: { type: String, default: '' },
    itemName: { type: String, default: '' },
    partyName: { type: String, default: '' },
    orderNo: { type: String, default: '' },
    eye: { type: String, default: '' },
    sph: { type: Number, default: 0 },
    cyl: { type: Number, default: 0 },
    axis: { type: Number, default: 0 },
    add: { type: Number, default: 0 },
    qty: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    totalAmt: { type: Number, default: 0 },
    combinationId: { type: String, default: '' },
});

const damageEntrySchema = new mongoose.Schema(
    {
        billSeries: { type: String, default: 'DMG' },
        billNo: { type: String, default: '' },
        date: { type: Date, default: Date.now },
        type: { type: String, default: 'Damage', enum: ['Damage', 'Shrinkage'] },
        godown: { type: String, default: 'HO' },
        remark: { type: String, default: '' },
        items: [damageItemSchema],
        totalQty: { type: Number, default: 0 },
        totalAmt: { type: Number, default: 0 },
        companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    },
    { timestamps: true }
);

const DamageEntry = mongoose.model('DamageEntry', damageEntrySchema);
export default DamageEntry;
