import express from "express";
import { getOutstandingReport, getStations, getGroups } from "../controllers/outstanding.controller.js";

const router = express.Router();

// POST /outstanding/report - Get outstanding report with filters
router.post("/report", getOutstandingReport);

// GET /outstanding/stations - Get all unique stations
router.get("/stations", getStations);

// GET /outstanding/groups - Get all unique groups
router.get("/groups", getGroups);

export default router;
