import express from "express";
import { saveLensLocationStock, getLensLocationStock, checkStockAvailability } from "../controllers/LensLocationStock.controller.js";
import authMiddleware from "../middlewares/AuthMiddleware.js";

const router = express.Router();

router.post("/save", authMiddleware, saveLensLocationStock);
router.post("/fetch", authMiddleware, getLensLocationStock);
router.post("/checkStock", authMiddleware, checkStockAvailability);

export default router;
