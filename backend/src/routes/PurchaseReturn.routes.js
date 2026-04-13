import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { addLensPurchaseReturn, getLensPurchaseReturn, getAllLensPurchaseReturn, editLensPurchaseReturn, removeLensPurchaseReturn, getNextBillNumber, updateReturnQuantities } from '../controllers/PurchaseReturn.controller.js'
const router = express.Router();

router.post('/createLensPurchaseReturn', authMiddleware, addLensPurchaseReturn);
router.post('/getNextBillNumber', authMiddleware, getNextBillNumber);
router.post('/getLensPurchaseReturn', authMiddleware, getLensPurchaseReturn);
router.get('/getAllLensPurchaseReturn', authMiddleware, getAllLensPurchaseReturn);
router.put('/editLensPurchaseReturn/:id', authMiddleware, editLensPurchaseReturn);
router.patch('/updateReturnQuantities/:id', authMiddleware, updateReturnQuantities);
router.delete('/deleteLensPurchaseReturn/:id', authMiddleware, removeLensPurchaseReturn);
export default router;