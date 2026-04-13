import express from "express";
import {
    upsertAccountWisePrice,
    getAccountWisePrices,
    bulkUpsertAccountWisePrices,
} from "../controllers/accountWisePrice.controller.js";

const router = express.Router();

router.post("/upsert", upsertAccountWisePrice);
router.get("/getByAccount", getAccountWisePrices);
router.post("/bulkUpsert", bulkUpsertAccountWisePrices);

export default router;
