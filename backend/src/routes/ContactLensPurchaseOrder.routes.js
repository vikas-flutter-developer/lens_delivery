import express from "express";
import authMiddleware from "../middlewares/AuthMiddleware.js";
import {
    getAllContactLensPurchaseOrder,
    removeContactLensPurchaseOrder,
    updateContactLensPurchaseOrderStatus,
    updateContactLensPurchaseOrderBookedBy,
    addContactLensPurchaseOrder,
    getContactLensPurchaseOrder,
    editContactLensPurchaseOrder,
    getNextBillNo,
    getNextPurchaseChallanBillNo,
    updateContactLensPurchaseOrderVendor,
    createContactLensPurchaseChallan
} from "../controllers/ContactLensPurchaseOrder.controller.js";

const router = express.Router();

router.get("/getall", authMiddleware, getAllContactLensPurchaseOrder);
router.get("/get/:id", authMiddleware, getContactLensPurchaseOrder);
router.get("/nextBillNo/:partyAccount", authMiddleware, getNextBillNo);
router.get("/nextChallanBillNo", authMiddleware, getNextPurchaseChallanBillNo);
router.post("/add", authMiddleware, addContactLensPurchaseOrder);
router.put("/edit/:id", authMiddleware, editContactLensPurchaseOrder);
router.delete("/delete/:id", authMiddleware, removeContactLensPurchaseOrder);
router.put("/status/:id", authMiddleware, updateContactLensPurchaseOrderStatus);
router.put("/bookedby/:id", authMiddleware, updateContactLensPurchaseOrderBookedBy);
router.put("/vendor/:id", authMiddleware, updateContactLensPurchaseOrderVendor);
router.post("/createChallan", authMiddleware, createContactLensPurchaseChallan);

export default router;
