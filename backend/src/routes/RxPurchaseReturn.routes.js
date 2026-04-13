import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { addRxPurchaseReturn, getRxPurchaseReturn, getAllRxPurchaseReturn, editRxPurchaseReturn, removeRxPurchaseReturn, getNextBillNumber, updateRxPurchaseReturnFields } from '../controllers/RxPurchaseReturn.controller.js'
const router = express.Router();

router.post('/createRxPurchaseReturn', authMiddleware, addRxPurchaseReturn);
router.post('/getNextBillNumber', authMiddleware, getNextBillNumber);
router.post('/getRxPurchaseReturn', authMiddleware, getRxPurchaseReturn);
router.get('/getAllRxPurchaseReturn', authMiddleware, getAllRxPurchaseReturn);
router.put('/editRxPurchaseReturn/:id', authMiddleware, editRxPurchaseReturn);
router.delete('/deleteRxPurchaseReturn/:id', authMiddleware, removeRxPurchaseReturn);
router.patch('/updateRxPurchaseReturnFields/:id', authMiddleware, updateRxPurchaseReturnFields);
export default router;