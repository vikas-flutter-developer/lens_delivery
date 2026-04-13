import express from 'express';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import {
  getRevenueSummary,
  getRevenueTrend,
  getTopCustomers,
  getOrdersByDay,
  getAvgOrderValue,
  getStaffSummary,
  getStaffRevenue,
  getStaffPerformance,
  getStaffCollectionEfficiency,
  getCashFlowSummary,
  getReceivablesAging,
  getDsoTrend,
  getCashFlowForecast,
  getAIInsights,
  getCustomerSegmentation
} from '../controllers/analytics.controller.js';

const router = express.Router();

// Revenue Tab
router.get('/revenue-summary',            authMiddleware, getRevenueSummary);
router.get('/revenue-trend',              authMiddleware, getRevenueTrend);
router.get('/top-customers',              authMiddleware, getTopCustomers);
router.get('/orders-by-day',              authMiddleware, getOrdersByDay);
router.get('/avg-order-value',            authMiddleware, getAvgOrderValue);

// Staff Tab
router.get('/staff-summary',             authMiddleware, getStaffSummary);
router.get('/staff-revenue',             authMiddleware, getStaffRevenue);
router.get('/staff-performance',         authMiddleware, getStaffPerformance);
router.get('/staff-collection-efficiency', authMiddleware, getStaffCollectionEfficiency);

// Cash Flow Tab
router.get('/cashflow-summary',          authMiddleware, getCashFlowSummary);
router.get('/receivables-aging',         authMiddleware, getReceivablesAging);
router.get('/dso-trend',                 authMiddleware, getDsoTrend);
router.get('/cashflow-forecast',         authMiddleware, getCashFlowForecast);

// AI Insights Tab
router.get('/ai-insights',               authMiddleware, getAIInsights);

// Customer Analysis Tab
router.get('/customer-segmentation',     authMiddleware, getCustomerSegmentation);

export default router;
