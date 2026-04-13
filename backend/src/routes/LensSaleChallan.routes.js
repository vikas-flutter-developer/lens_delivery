import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { addLensSaleChallan, getLensSaleChallan, getAllLensSaleChallan, editLensSaleChallan, removeLensSaleChallan, createLensInvoice, createChallanFromInvoice, updateSaleChallanStatus, updateDeliveryPerson, updateItemStatus, sendChallanWhatsAppReminder, updateItemRemark, updateCancelReason } from '../controllers/LensSaleChallan.js'
const router = express.Router();

router.post('/createLensSaleChallan', authMiddleware, addLensSaleChallan);
router.post('/getLensSaleChallan', authMiddleware, getLensSaleChallan);
router.post('/createLensInvoice', authMiddleware, createLensInvoice);
router.post('/createChallanFromInvoice', authMiddleware, createChallanFromInvoice);
router.get('/getAllLensSaleChallan', authMiddleware, getAllLensSaleChallan);
router.put('/editLensSaleChallan/:id', authMiddleware, editLensSaleChallan);
router.patch('/updateStatus/:id', authMiddleware, updateSaleChallanStatus);
router.patch('/updateDeliveryPerson/:id', authMiddleware, updateDeliveryPerson);
router.patch('/updateItemStatus/:id', authMiddleware, updateItemStatus);
router.post('/sendWhatsAppReminder/:id', authMiddleware, sendChallanWhatsAppReminder);
router.delete('/deleteLensSaleChallan/:id', authMiddleware, removeLensSaleChallan);
router.patch('/updateItemRemark/:id', authMiddleware, updateItemRemark);
router.patch('/updateCancelReason/:id', authMiddleware, updateCancelReason);
export default router;
