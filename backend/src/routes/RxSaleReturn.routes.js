import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { addRxSaleReturn, getRxSaleReturn, getAllRxSaleReturn, editRxSaleReturn, removeRxSaleReturn, getNextBillNumber } from '../controllers/RxSaleReturn.controller.js'
const router = express.Router();

router.post('/createRxSaleReturn', authMiddleware, addRxSaleReturn);
router.post('/getNextBillNumber', authMiddleware, getNextBillNumber);
router.post('/getRxSaleReturn', authMiddleware, getRxSaleReturn);
router.get('/getAllRxSaleReturn', authMiddleware, getAllRxSaleReturn);
router.put('/editRxSaleReturn/:id', authMiddleware, editRxSaleReturn);
router.delete('/deleteRxSaleReturn/:id', authMiddleware, removeRxSaleReturn);
export default router;