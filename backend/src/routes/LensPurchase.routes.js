import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { addLensPurchase, getLensPurchase, getAllLensPurchase, editLensPurchase, removeLensPurchase, patchLensPurchaseDcId } from '../controllers/LensPurchase.controller.js'
const router = express.Router();

router.post('/createLensPurchase', authMiddleware, addLensPurchase);
router.post('/getLensPurchase', authMiddleware, getLensPurchase);
router.get('/getAllLensPurchase', authMiddleware, getAllLensPurchase);
router.put('/editLensPurchase/:id', authMiddleware, editLensPurchase);
router.patch('/patchDcId/:id', authMiddleware, patchLensPurchaseDcId);
router.delete('/deleteLensPurchase/:id', authMiddleware, removeLensPurchase);
export default router;