import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import {
    addRxPurchaseOrder,
    getAllRxPurchaseOrder,
    getRxPurchaseOrder,
    editRxPurchaseOrder,
    removeRxPurchaseOrder,
    createRxPurchaseInvoiceFromOrder,
    updateRxPurchaseOrderStatus,
    getNextBillNumberForRxPurchaseOrder,
    createRxPurchaseChallan
} from '../controllers/RxPurchaseOrder.controller.js'

const router = express.Router();

router.post('/createRxPurchaseOrder', authMiddleware, addRxPurchaseOrder);
router.post('/getNextBillNumber', authMiddleware, getNextBillNumberForRxPurchaseOrder);
router.post('/getRxPurchaseOrder', authMiddleware, getRxPurchaseOrder);
router.get('/getAllRxPurchaseOrder', authMiddleware, getAllRxPurchaseOrder);
router.put('/editRxPurchaseOrder/:id', authMiddleware, editRxPurchaseOrder);
router.patch('/updateStatus/:id', authMiddleware, updateRxPurchaseOrderStatus);
router.delete('/deleteRxPurchaseOrder/:id', authMiddleware, removeRxPurchaseOrder);
router.post('/createRxInvoice', authMiddleware, createRxPurchaseInvoiceFromOrder);
router.post('/createRxPurchaseChallan', authMiddleware, createRxPurchaseChallan);
export default router;
