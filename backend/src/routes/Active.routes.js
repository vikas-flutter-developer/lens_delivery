import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { getTopProducts} from "../controllers/Active.controller.js"
const router = express.Router();
router.get('/topProducts', authMiddleware, getTopProducts);
export default router;