import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { updateOrderStatus, getOrderStatusSummary } from '../controllers/mobileOrder.controller.js';

const router = express.Router();

// Get dashboard status summary
router.get('/status-summary', authMiddleware, getOrderStatusSummary);

// Update order status
router.patch('/:orderId/status', authMiddleware, updateOrderStatus);

export default router;
