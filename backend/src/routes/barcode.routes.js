import express from "express";
import { body, param } from "express-validator";
import { saveBarcodeData, bulkSaveBarcodeData, getBarcodeData } from "../controllers/barcode.controller.js";
import authMiddleware from "../middlewares/AuthMiddleware.js";

const router = express.Router();

/**
 * @route   POST /api/barcodes
 * @desc    Save single scanned barcode data
 * @access  Protected
 */
router.post(
    "/",
    authMiddleware,
    [
        body("barcode").notEmpty().withMessage("Barcode is required"),
        body("productId").isMongoId().withMessage("Valid Product ID is required"),
        body("sph").optional().isNumeric().withMessage("SPH must be a number"),
        body("cyl").optional().isNumeric().withMessage("CYL must be a number"),
        body("axis").optional().isNumeric().withMessage("AXIS must be a number"),
        body("add").optional().isNumeric().withMessage("ADD must be a number"),
    ],
    saveBarcodeData
);

/**
 * @route   POST /api/barcodes/bulk
 * @desc    Save multiple scanned barcodes
 * @access  Protected
 */
router.post(
    "/bulk",
    authMiddleware,
    [
        body("scans").isArray().withMessage("Scans must be an array of objects"),
        body("scans.*.barcode").notEmpty().withMessage("Each scan must have a barcode"),
        body("scans.*.productId").isMongoId().withMessage("Each scan must have a valid MongoId as productId"),
    ],
    bulkSaveBarcodeData
);

/**
 * @route   GET /api/barcodes/:barcode
 * @desc    Fetch lens data by barcode number (Intelligent search)
 * @access  Protected
 */
router.get(
    "/:barcode",
    authMiddleware,
    [
        param("barcode").notEmpty().withMessage("Barcode number is required"),
    ],
    getBarcodeData
);

export default router;
