import express from 'express';
import { createVoucher, getVouchers, getVoucherById, updateVoucher, deleteVoucher, getNextBillNo } from '../controllers/Voucher.controller.js';

const router = express.Router();

router.post('/', createVoucher);
router.get('/', getVouchers);
router.get('/nextBillNo', getNextBillNo);
router.get('/:id', getVoucherById);
router.put('/:id', updateVoucher);
router.delete('/:id', deleteVoucher);

export default router;
