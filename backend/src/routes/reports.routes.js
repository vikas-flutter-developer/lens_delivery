import express from 'express';
import { getLensStockReport, getItemStockSummaryReport, getPartyWiseItemReport, getLensMovementReport, getDayBookReport, getCashBankBookReport, getBankAccounts, getProfitAndLossReport, getParentGroups, getProfitAndLossAccountReport, getTransactionSummaryReport, getTransactionDetailReport, getSaleSummaryFormatReport, getBalanceSheetReport, getCollectionReport, getSaleItemGroupWiseReport, getCustomerAnalysisReport, getPowerMovementReport, getBankVerificationTransactions, getSaleReturnRatioReport, saveSaleTarget, getSaleTargetReport, getPartyTargetHistory, getCancelledOrderRatioReport, getOrderToChallanTimeReport, saveCollectionTarget, getCollectionTargetReport, getCollectionTargetHistory, getCustomerItemSalesReport, getSalesGrowthComparisonReport } from '../controllers/reports.controller.js';



import authMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();

router.post('/lensstock', authMiddleware, getLensStockReport);
router.post('/itemstocksummary', authMiddleware, getItemStockSummaryReport);
router.post('/partywiseitem', authMiddleware, getPartyWiseItemReport);
router.post('/lensmovement', authMiddleware, getLensMovementReport);
router.post('/daybook', authMiddleware, getDayBookReport);
router.post('/cashbankbook', authMiddleware, getCashBankBookReport);
router.post('/profitloss', authMiddleware, getProfitAndLossReport);
router.get('/bankaccounts', authMiddleware, getBankAccounts);
router.get('/parentgroups', authMiddleware, getParentGroups);
router.post('/profitlossaccount', authMiddleware, getProfitAndLossAccountReport);
router.post('/transactionsummary', authMiddleware, getTransactionSummaryReport);
router.post('/transactiondetail', authMiddleware, getTransactionDetailReport);
router.post('/salesummaryformat', authMiddleware, getSaleSummaryFormatReport);
router.post('/balancesheet', authMiddleware, getBalanceSheetReport);
router.post('/collection', authMiddleware, getCollectionReport);
router.post('/saleitemgroupwise', authMiddleware, getSaleItemGroupWiseReport);
router.post('/customeranalysis', authMiddleware, getCustomerAnalysisReport);
router.post('/powermovement', authMiddleware, getPowerMovementReport);
router.post('/bank-verification', authMiddleware, getBankVerificationTransactions);
router.post('/sale-return-ratio', authMiddleware, getSaleReturnRatioReport);
router.post('/sale-target/save', authMiddleware, saveSaleTarget);
router.post('/sale-target/report', authMiddleware, getSaleTargetReport);
router.get('/sale-target/history/:partyName', authMiddleware, getPartyTargetHistory);
router.post('/cancelled-order-ratio', authMiddleware, getCancelledOrderRatioReport);
router.post('/order-to-challan-time', authMiddleware, getOrderToChallanTimeReport);

// Collection Target routes
router.post('/collection-target/save', authMiddleware, saveCollectionTarget);
router.post('/collection-target/report', authMiddleware, getCollectionTargetReport);
router.get('/collection-target/history/:partyName/:targetType', authMiddleware, getCollectionTargetHistory);

// Customer Item Sales Report
router.post('/customer-item-sales', authMiddleware, getCustomerItemSalesReport);




router.post('/salesgrowth', authMiddleware, getSalesGrowthComparisonReport);

export default router;

