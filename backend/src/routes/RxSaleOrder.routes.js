import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import {
  addRxSaleOrder,
  getAllRxSaleOrder,
  getRxSaleOrder,
  editRxSaleOrder,
  removeRxSaleOrder,
  createRxInvoiceFromOrder,
  getNextBillNumberForRxSaleOrder,
  updateRxSaleOrderStatus,
  updateRxSaleOrderBookedBy,
  updateRxSaleOrderVendor,
  createRxChallan,
  updateRxItemStatus,
  updateOrderPlacementStatus,
  updateItemOrderNo,
  updateItemRemark,
  updateRxSaleOrderRefNo,
  updateCancelReason,
  validateAccountLimits,
} from '../controllers/RxSaleOrder.controller.js'

const router = express.Router();

router.post('/createRxSaleOrder', authMiddleware, addRxSaleOrder);
router.post('/getRxSaleOrder', authMiddleware, getRxSaleOrder);
router.get('/getAllRxSaleOrder', authMiddleware, getAllRxSaleOrder);
router.put('/editRxSaleOrder/:id', authMiddleware, editRxSaleOrder);
router.patch('/updateStatus/:id', authMiddleware, updateRxSaleOrderStatus);
router.patch('/updateBookedBy/:id', authMiddleware, updateRxSaleOrderBookedBy);
router.patch('/updateVendor/:id', authMiddleware, updateRxSaleOrderVendor);
router.delete('/deleteRxSaleOrder/:id', authMiddleware, removeRxSaleOrder);
router.post('/createRxInvoice', authMiddleware, createRxInvoiceFromOrder);
router.post('/createRxChallan', authMiddleware, createRxChallan);
router.post('/getNextBillNumber', authMiddleware, getNextBillNumberForRxSaleOrder);
router.patch('/updateItemStatus/:id', authMiddleware, updateRxItemStatus);
router.patch('/updateItemOrderNo/:id', authMiddleware, updateItemOrderNo);
router.patch('/updateItemRemark/:id', authMiddleware, updateItemRemark);
router.patch('/updateOrderPlacementStatus/:id', authMiddleware, updateOrderPlacementStatus);
router.patch('/updateRefNo/:id', authMiddleware, updateRxSaleOrderRefNo);
router.patch('/updateCancelReason/:id', authMiddleware, updateCancelReason);
router.post('/validateAccountLimits', authMiddleware, validateAccountLimits);

export default router;
