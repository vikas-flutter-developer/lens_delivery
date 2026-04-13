import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { addLensSale, getLensSale, getAllLensSale, editLensSale, removeLensSale, updateSaleInvoiceStatus, updateItemStatus, updateItemRemark, updateDeliveryPerson } from '../controllers/LensSale.controller.js'
const router = express.Router();

router.post('/createLensSale', authMiddleware, addLensSale);
router.post('/getLensSale', authMiddleware, getLensSale);
router.get('/getAllLensSale', authMiddleware, getAllLensSale);
router.put('/editLensSale/:id', authMiddleware, editLensSale);
router.patch('/updateStatus/:id', authMiddleware, updateSaleInvoiceStatus);
router.patch('/updateItemStatus/:id', authMiddleware, updateItemStatus);
router.delete('/deleteLensSale/:id', authMiddleware, removeLensSale);
router.patch('/updateItemRemark/:id', authMiddleware, updateItemRemark);
router.patch('/updateDeliveryPerson/:id', authMiddleware, updateDeliveryPerson);
export default router;