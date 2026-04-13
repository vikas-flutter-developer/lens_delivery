import express from "express";
import { getReorderReport } from "../controllers/inventory.controller.js";

const router = express.Router();

router.post("/reorder-report", getReorderReport);

export default router;
