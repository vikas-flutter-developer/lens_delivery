import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { addRxPurchase, getRxPurchase, getAllRxPurchase, editRxPurchase, removeRxPurchase, getAllVendors, getNextBillNumberForRxPurchase, patchRxPurchaseDcId } from '../controllers/RxPurchase.controller.js'
const router = express.Router();

router.post('/createRxPurchase', authMiddleware, addRxPurchase);
router.post('/getNextBillNumber', authMiddleware, getNextBillNumberForRxPurchase);
router.post('/getRxPurchase', authMiddleware, getRxPurchase);
router.get('/getAllRxPurchase', authMiddleware, getAllRxPurchase);
router.get('/getAllVendors', authMiddleware, getAllVendors);
router.put('/editRxPurchase/:id', authMiddleware, editRxPurchase);
router.delete('/deleteRxPurchase/:id', authMiddleware, removeRxPurchase);
router.patch('/patchDcId/:id', authMiddleware, patchRxPurchaseDcId);
export default router;