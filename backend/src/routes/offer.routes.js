import express from "express";
import { getOffersByGroup, bulkUpsertOffers, getOfferForProduct } from "../controllers/offer.controller.js";

const router = express.Router();

router.get("/getByGroup", getOffersByGroup);
router.post("/bulkUpsert", bulkUpsertOffers);
router.get("/getOfferForProduct", getOfferForProduct);

export default router;
