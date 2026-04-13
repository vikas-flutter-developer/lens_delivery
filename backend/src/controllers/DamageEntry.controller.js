import DamageEntry from '../models/DamageEntry.js';

// Get next auto-increment bill number
const getNextBillNo = async (billSeries = 'DMG') => {
    const last = await DamageEntry.findOne({ billSeries }).sort({ createdAt: -1 });
    if (!last || !last.billNo) return '1';
    const num = parseInt(last.billNo, 10);
    return isNaN(num) ? '1' : String(num + 1);
};

export const createDamageEntry = async (req, res) => {
    try {
        const data = req.body || {};
        const items = (data.items || []).map(item => ({
            code: item.code || '',
            itemName: item.itemName || '',
            partyName: item.partyName || '',
            orderNo: item.orderNo || '',
            eye: item.eye || '',
            sph: Number(item.sph) || 0,
            cyl: Number(item.cyl) || 0,
            axis: Number(item.axis) || 0,
            add: Number(item.add) || 0,
            qty: Number(item.qty) || 0,
            price: Number(item.price) || 0,
            totalAmt: Number(item.totalAmt) || 0,
            combinationId: item.combinationId || '',
        }));

        if (!items.length) {
            return res.status(400).json({ success: false, message: 'At least one item is required' });
        }

        const totalQty = items.reduce((s, it) => s + it.qty, 0);
        const totalAmt = items.reduce((s, it) => s + it.totalAmt, 0);

        const billNo = data.billNo || await getNextBillNo(data.billSeries || 'DMG');

        const entry = new DamageEntry({
            billSeries: data.billSeries || 'DMG',
            billNo,
            date: data.date ? new Date(data.date) : new Date(),
            type: data.type || 'Damage',
            godown: data.godown || 'HO',
            remark: data.remark || '',
            items,
            totalQty,
            totalAmt,
            companyId: req.user?.companyId || null,
        });

        const saved = await entry.save();
        return res.status(201).json({ success: true, message: 'Damage entry created successfully', data: saved });
    } catch (err) {
        console.error('createDamageEntry error:', err);
        return res.status(500).json({ success: false, message: 'Failed to create damage entry', error: err.message });
    }
};

export const getAllDamageEntries = async (req, res) => {
    try {
        const entries = await DamageEntry.find({}).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: entries });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch entries', error: err.message });
    }
};

export const getDamageEntry = async (req, res) => {
    try {
        const entry = await DamageEntry.findById(req.params.id);
        if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
        return res.status(200).json({ success: true, data: entry });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch entry', error: err.message });
    }
};

export const updateDamageEntry = async (req, res) => {
    try {
        const data = req.body || {};
        const items = (data.items || []).map(item => ({
            code: item.code || '',
            itemName: item.itemName || '',
            partyName: item.partyName || '',
            orderNo: item.orderNo || '',
            eye: item.eye || '',
            sph: Number(item.sph) || 0,
            cyl: Number(item.cyl) || 0,
            axis: Number(item.axis) || 0,
            add: Number(item.add) || 0,
            qty: Number(item.qty) || 0,
            price: Number(item.price) || 0,
            totalAmt: Number(item.totalAmt) || 0,
            combinationId: item.combinationId || '',
        }));

        const totalQty = items.reduce((s, it) => s + it.qty, 0);
        const totalAmt = items.reduce((s, it) => s + it.totalAmt, 0);

        const updated = await DamageEntry.findByIdAndUpdate(
            req.params.id,
            {
                billSeries: data.billSeries || 'DMG',
                billNo: data.billNo,
                date: data.date ? new Date(data.date) : new Date(),
                type: data.type || 'Damage',
                godown: data.godown || 'HO',
                remark: data.remark || '',
                items,
                totalQty,
                totalAmt,
            },
            { new: true }
        );

        if (!updated) return res.status(404).json({ success: false, message: 'Entry not found' });
        return res.status(200).json({ success: true, message: 'Entry updated successfully', data: updated });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to update entry', error: err.message });
    }
};

export const deleteDamageEntry = async (req, res) => {
    try {
        const deleted = await DamageEntry.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Entry not found' });
        return res.status(200).json({ success: true, message: 'Entry deleted successfully' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to delete entry', error: err.message });
    }
};

export const getNextDamageBillNo = async (req, res) => {
    try {
        const series = req.query.series || 'DMG';
        const nextNo = await getNextBillNo(series);
        return res.status(200).json({ success: true, nextBillNo: nextNo });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to get next bill no', error: err.message });
    }
};
