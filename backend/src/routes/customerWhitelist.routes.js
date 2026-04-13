import express from "express";
import {
  getWhitelist,
  addToWhitelist,
  removeFromWhitelist,
} from "../controllers/delivery.controller.js";
import authMiddleware from "../middlewares/AuthMiddleware.js";

const router = express.Router();

/**
 * GET  /api/customers/whitelist
 * Returns all customers with isOtpWhitelisted = true.
 */
router.get("/whitelist", authMiddleware, getWhitelist);

/**
 * POST /api/customers/whitelist
 * Adds a customer to the OTP whitelist.
 * Body: { customerId }
 */
router.post("/whitelist", authMiddleware, addToWhitelist);

/**
 * DELETE /api/customers/whitelist/:customerId
 * Removes a customer from the OTP whitelist.
 */
router.delete("/whitelist/:customerId", authMiddleware, removeFromWhitelist);

export default router;
