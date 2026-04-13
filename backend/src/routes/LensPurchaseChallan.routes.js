import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { addLensPurchaseChallan, getLensPurchaseChallan, getAllLensPurchaseChallan, editLensPurchaseChallan, removeLensPurchaseChallan, createLensPurchaseInvoice, createChallanFromInvoice, updatePurchaseChallanStatus, updatePurchaseChallanItemStatus, patchLensPurchaseChallanDcId, updateCancelReason } from '../controllers/LensPurchaseChallan.controller.js'
const router = express.Router();

router.post('/createLensPurchaseChallan', authMiddleware, addLensPurchaseChallan);
router.post('/getLensPurchaseChallan', authMiddleware, getLensPurchaseChallan);
router.post('/createLensInvoice', authMiddleware, createLensPurchaseInvoice);
router.post('/createChallanFromInvoice', authMiddleware, createChallanFromInvoice);
router.get('/getAllLensPurchaseChallan', authMiddleware, getAllLensPurchaseChallan);
router.put('/editLensPurchaseChallan/:id', authMiddleware, editLensPurchaseChallan);
router.patch('/updateStatus/:id', authMiddleware, updatePurchaseChallanStatus);
router.patch('/patchDcId/:id', authMiddleware, patchLensPurchaseChallanDcId);
router.post('/updateItemStatus', authMiddleware, updatePurchaseChallanItemStatus);
router.delete('/deleteLensPurchaseChallan/:id', authMiddleware, removeLensPurchaseChallan);
router.patch('/updateCancelReason/:id', authMiddleware, updateCancelReason);
export default router;