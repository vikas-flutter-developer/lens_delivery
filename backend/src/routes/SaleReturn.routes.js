import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { addLensSaleReturn, getLensSaleReturn, getAllLensSaleReturn, editLensSaleReturn, removeLensSaleReturn, getNextBillNumber, updateReturnQuantities } from '../controllers/SaleReturn.controller.js'
const router = express.Router();

router.post('/createLensSaleReturn', authMiddleware, addLensSaleReturn);
router.post('/getNextBillNumber', authMiddleware, getNextBillNumber);
router.post('/getLensSaleReturn', authMiddleware, getLensSaleReturn);
router.get('/getAllLensSaleReturn', authMiddleware, getAllLensSaleReturn);
router.put('/editLensSaleReturn/:id', authMiddleware, editLensSaleReturn);
router.patch('/updateReturnQuantities/:id', authMiddleware, updateReturnQuantities);
router.delete('/deleteLensSaleReturn/:id', authMiddleware, removeLensSaleReturn);
export default router;