import express from "express";
import authMiddleware from "../middlewares/AuthMiddleware.js";
import {
  getAllContactLensSaleOrder,
  removeContactLensSaleOrder,
  updateContactLensSaleOrderStatus,
  updateContactLensSaleOrderBookedBy,
  addContactLensSaleOrder,
  getContactLensSaleOrder,
  editContactLensSaleOrder,
  getNextBillNo,
  updateContactLensSaleOrderVendor,
  createContactLensChallan,
  updateContactLensItemStatus,
  updateOrderPlacementStatus,
  updateItemOrderNo,
  updateContactLensSaleOrderRefNo,
  updateItemRemark,
  validateAccountLimits,
} from "../controllers/ContactLensSaleOrder.controller.js";

const router = express.Router();

router.get("/getall", authMiddleware, getAllContactLensSaleOrder);
router.get("/get/:id", authMiddleware, getContactLensSaleOrder);
router.get("/nextBillNo/:partyAccount", authMiddleware, getNextBillNo);
router.post("/add", authMiddleware, addContactLensSaleOrder);
router.put("/edit/:id", authMiddleware, editContactLensSaleOrder);
router.delete("/delete/:id", authMiddleware, removeContactLensSaleOrder);
router.put("/status/:id", authMiddleware, updateContactLensSaleOrderStatus);
router.put("/bookedby/:id", authMiddleware, updateContactLensSaleOrderBookedBy);
router.put("/vendor/:id", authMiddleware, updateContactLensSaleOrderVendor);
router.post("/createChallan", authMiddleware, createContactLensChallan);
router.patch("/updateItemStatus/:id", authMiddleware, updateContactLensItemStatus);
router.patch("/updateItemOrderNo/:id", authMiddleware, updateItemOrderNo);
router.patch("/updateOrderPlacementStatus/:id", authMiddleware, updateOrderPlacementStatus);
router.patch("/updateRefNo/:id", authMiddleware, updateContactLensSaleOrderRefNo);
router.patch("/updateItemRemark/:id", authMiddleware, updateItemRemark);
router.post("/validateAccountLimits", authMiddleware, validateAccountLimits);

export default router;
