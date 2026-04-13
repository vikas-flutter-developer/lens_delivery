import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { addLensPurchaseOrder, getLensPurchaseOrder, getAllLensPurchaseOrder, editLensPurchaseOrder, removeLensPurchaseOrder, createLensPurchaseInvoice, createLensPurchaseChallan, updatePurchaseOrderStatus, updateOrderQuantities, updatePurchaseItemStatus, updateItemQty, updatePurchaseOrderItemsQty, updateCancelReason } from '../controllers/LensPurchaseOrder.controller.js'
const router = express.Router();

router.post('/createLensPurchaseOrder', authMiddleware, addLensPurchaseOrder);
router.post('/getLensPurchaseOrder', authMiddleware, getLensPurchaseOrder);
router.post('/createLensInvoice', authMiddleware, createLensPurchaseInvoice);
router.post('/createLensChallan', authMiddleware, createLensPurchaseChallan);
router.get('/getAllLensPurchaseOrder', authMiddleware, getAllLensPurchaseOrder);
router.put('/editLensPurchaseOrder/:id', authMiddleware, editLensPurchaseOrder);
router.patch('/updateStatus/:id', authMiddleware, updatePurchaseOrderStatus);
router.patch('/updateQuantities/:id', authMiddleware, updateOrderQuantities);
router.patch('/updateOrderItemsQty', authMiddleware, updatePurchaseOrderItemsQty);
router.patch('/updateCancelReason/:id', authMiddleware, updateCancelReason);
router.post('/updateItemStatus', authMiddleware, updatePurchaseItemStatus);
router.patch('/updateItemQty', authMiddleware, updateItemQty);
router.delete('/deleteLensPurchaseOrder/:id', authMiddleware, removeLensPurchaseOrder);
export default router;