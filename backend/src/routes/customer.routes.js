import express from "express";
import customerAuthMiddleware from "../middlewares/customerAuthMiddleware.js";
import {
  customerLogin,
  registerCustomer,
  getCustomerProfile,
  updateCustomerPassword,
} from "../controllers/customerAuth.controller.js";
import {
  getCustomerLedger,
  getCustomerBalance,
} from "../controllers/customerLedger.controller.js";

const router = express.Router();

/**
 * Customer Authentication Routes
 */

// Customer Login
router.post("/login", customerLogin);

// Customer Registration
router.post("/register", registerCustomer);

/**
 * Protected Customer Routes (require authentication)
 */

// Get Customer Profile
router.get("/profile", customerAuthMiddleware, getCustomerProfile);

// Update Customer Password
router.put("/change-password", customerAuthMiddleware, updateCustomerPassword);

/**
 * Customer Ledger Routes
 */

// Get Customer Ledger (with optional date filters)
router.post("/ledger", customerAuthMiddleware, getCustomerLedger);
router.get("/ledger", customerAuthMiddleware, getCustomerLedger);

// Get Customer Balance
router.get("/balance", customerAuthMiddleware, getCustomerBalance);

export default router;
