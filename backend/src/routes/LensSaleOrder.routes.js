import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import {
  addLensSaleOrder,
  getLensSaleOrder,
  getAllLensSaleOrder,
  editLensSaleOrder,
  removeLensSaleOrder,
  createLensInvoice,
  createLensChallan,
  updateSaleOrderStatus,
  updateSaleOrderBookedBy,
  getNextBillNumberForLensSaleOrder,
  updateOrderQuantities,
  updateSaleOrderVendor,
  updateItemStatus,
  recalculateOrderStatus,
  syncOrderAcrossModules,
  updateOrderPlacementStatus,
  updateItemOrderNo,
  updateSaleOrderRefNo,
  updateItemRemark,
  updateCancelReason,
  validateAccountLimits,
} from '../controllers/LensSaleOrder.controller.js'
const router = express.Router();

router.post('/createLensSaleOrder', authMiddleware, addLensSaleOrder);
router.post('/getLensSaleOrder', authMiddleware, getLensSaleOrder);
router.post('/getNextBillNumber', authMiddleware, getNextBillNumberForLensSaleOrder);
router.post('/createLensInvoice', authMiddleware, createLensInvoice);
router.post('/createLensChallan', authMiddleware, createLensChallan);
router.get('/getAllLensSaleOrder', authMiddleware, getAllLensSaleOrder);
router.put('/editLensSaleOrder/:id', authMiddleware, editLensSaleOrder);
router.patch('/updateStatus/:id', authMiddleware, updateSaleOrderStatus);
router.patch('/updateBookedBy/:id', authMiddleware, updateSaleOrderBookedBy);
router.patch('/updateQuantities/:id', authMiddleware, updateOrderQuantities);
router.patch('/updateVendor/:id', authMiddleware, updateSaleOrderVendor);
router.patch('/updateItemStatus/:id', authMiddleware, updateItemStatus);
router.patch('/updateItemOrderNo/:id', authMiddleware, updateItemOrderNo);
router.patch('/updateOrderPlacementStatus/:id', authMiddleware, updateOrderPlacementStatus);
router.patch('/updateRefNo/:id', authMiddleware, updateSaleOrderRefNo);
router.post('/recalculateOrderStatus', authMiddleware, recalculateOrderStatus);
router.post('/syncOrderAcrossModules', authMiddleware, syncOrderAcrossModules);
router.delete('/deleteLensSaleOrder/:id', authMiddleware, removeLensSaleOrder);
router.patch('/updateItemRemark/:id', authMiddleware, updateItemRemark);
router.patch('/updateCancelReason/:id', authMiddleware, updateCancelReason);
router.post('/validateAccountLimits', authMiddleware, validateAccountLimits);
export default router;