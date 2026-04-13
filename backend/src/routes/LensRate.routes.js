import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { editLensRate, syncAllLensesToItems } from '../controllers/lensRate.controller.js'
const router = express.Router();
router.put('/editLensRate', authMiddleware, editLensRate)
router.post('/syncAll', authMiddleware, syncAllLensesToItems)
export default router;