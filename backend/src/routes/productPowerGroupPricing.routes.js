import express from "express";
import authMiddleware from "../middlewares/AuthMiddleware.js";
import {
    upsertPowerGroupPricing,
    getPowerGroupPricing
} from "../controllers/productPowerGroupPricing.controller.js";

const router = express.Router();

router.post("/upsert", authMiddleware, upsertPowerGroupPricing);
router.get("/get", authMiddleware, getPowerGroupPricing);

export default router;
