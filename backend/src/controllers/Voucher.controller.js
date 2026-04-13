import Voucher from '../models/Voucher.model.js';

export const createVoucher = async (req, res) => {
    try {
        const voucher = new Voucher(req.body);
        await voucher.save();
        res.status(201).json({ success: true, data: voucher, message: 'Voucher created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getVouchers = async (req, res) => {
    try {
        const vouchers = await Voucher.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: vouchers });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getVoucherById = async (req, res) => {
    try {
        const voucher = await Voucher.findById(req.params.id);
        if (!voucher) return res.status(404).json({ success: false, message: 'Voucher not found' });
        res.status(200).json({ success: true, data: voucher });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateVoucher = async (req, res) => {
    try {
        const voucher = await Voucher.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!voucher) return res.status(404).json({ success: false, message: 'Voucher not found' });
        res.status(200).json({ success: true, data: voucher, message: 'Voucher updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteVoucher = async (req, res) => {
    try {
        const voucher = await Voucher.findByIdAndDelete(req.params.id);
        if (!voucher) return res.status(404).json({ success: false, message: 'Voucher not found' });
        res.status(200).json({ success: true, message: 'Voucher deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getNextBillNo = async (req, res) => {
    try {
        const { recordType, billSeries } = req.query;
        // Find highest billNo for this series
        const lastVoucher = await Voucher.findOne({ recordType, billSeries }).sort({ createdAt: -1 });
        let nextBillNo = 1;
        if (lastVoucher && !isNaN(Number(lastVoucher.billNo))) {
            nextBillNo = Number(lastVoucher.billNo) + 1;
        }
        res.status(200).json({ success: true, nextBillNo });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
