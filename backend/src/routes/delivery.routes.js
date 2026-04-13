import express from "express";
import {
  startDelivery,
  completeDelivery,
  getDeliveryOtp,
  recordArrival,
  confirmDelivery, // legacy — kept for backward compatibility
  getAssignedOrders,
  getDeliveryHistory,
  getDeliveryStats,
} from "../controllers/delivery.controller.js";
import authMiddleware from "../middlewares/AuthMiddleware.js";
import { isDeliveryPerson } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// ─── OTP Delivery Workflow ────────────────────────────────────────────────

/**
 * POST /api/delivery/start
 * Delivery person scans QR code → sets dispatchTime, generates OTP.
 * Body: { qrData, deliveryPersonId, orderType? }
 */
router.post("/start", authMiddleware, isDeliveryPerson, startDelivery);

/** POST /api/delivery/arrive - reach location */
router.post("/arrive", authMiddleware, isDeliveryPerson, recordArrival);

/**
 * POST /api/delivery/complete
 * Delivery person submits OTP at destination → marks order as Delivered.
 * Body: { orderId, deliveryPersonId, otp?, orderType? }
 */
router.post("/complete", authMiddleware, isDeliveryPerson, completeDelivery);

/**
 * GET /api/delivery/order/:orderId/otp
 * Retail app fetches OTP to display to the customer.
 * Query: ?orderType=challan|lens|rx  (optional)
 */
router.get("/order/:orderId/otp", authMiddleware, getDeliveryOtp);

// ─── Legacy ───────────────────────────────────────────────────────────────

/** POST /api/delivery/confirm  (original endpoint — backward compat) */
router.post("/confirm", authMiddleware, confirmDelivery);

/**
 * GET /api/delivery/assigned
 * Fetch pending orders for the logged-in delivery person.
 */
router.get("/assigned", authMiddleware, isDeliveryPerson, getAssignedOrders);

/**
 * GET /api/delivery/history
 * Fetch completed delivery history for the delivery person.
 */
router.get("/history", authMiddleware, isDeliveryPerson, getDeliveryHistory);

/**
 * GET /api/delivery/stats
 * Aggregates statistics for the logged-in delivery person.
 */
router.get("/stats", authMiddleware, isDeliveryPerson, getDeliveryStats);

export default router;
