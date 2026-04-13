import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { getAccountLedger, reconcileLedgerTransactions } from '../controllers/ledger.controller.js'

const router = express.Router();

router.post("/account-ledger", getAccountLedger);
router.post("/reconcile-transactions", reconcileLedgerTransactions);

export default router;