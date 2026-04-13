import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { addRxSale, getRxSale, getAllRxSale, editRxSale, removeRxSale, getAllVendors, updateRxSaleStatus, getNextBillNumberForRxSale, updateItemRemark, updateDeliveryPerson } from '../controllers/RxSale.controller.js'
const router = express.Router();

router.post('/createRxSale', authMiddleware, addRxSale);
router.post('/getNextBillNumber', authMiddleware, getNextBillNumberForRxSale);
router.post('/getRxSale', authMiddleware, getRxSale);
router.get('/getAllRxSale', authMiddleware, getAllRxSale);
router.get('/getAllVendors', authMiddleware, getAllVendors);
router.put('/editRxSale/:id', authMiddleware, editRxSale);
router.patch('/updateStatus/:id', authMiddleware, updateRxSaleStatus);
router.delete('/deleteRxSale/:id', authMiddleware, removeRxSale);
router.patch('/updateItemRemark/:id', authMiddleware, updateItemRemark);
router.patch('/updateDeliveryPerson/:id', authMiddleware, updateDeliveryPerson);
export default router;