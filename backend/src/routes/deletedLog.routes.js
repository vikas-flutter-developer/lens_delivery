import express from "express";
import { getDeletedLogs, restoreDeletedData, deleteLogPermanently } from "../controllers/deletedLog.controller.js";

const router = express.Router();

router.post("/get", getDeletedLogs);
router.post("/restore", restoreDeletedData);
router.post("/delete-permanent", deleteLogPermanently);

export default router;
