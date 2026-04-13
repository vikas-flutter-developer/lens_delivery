import ApiClient from "../ApiClient";

// ── Revenue Tab ──────────────────────────────────────────────────────────────
export const getRevenueSummary = async () => {
  const res = await ApiClient.get("/analytics/revenue-summary", { silent: true });
  return res.data;
};
export const getRevenueTrend = async () => {
  const res = await ApiClient.get("/analytics/revenue-trend", { silent: true });
  return res.data;
};
export const getTopCustomers = async () => {
  const res = await ApiClient.get("/analytics/top-customers", { silent: true });
  return res.data;
};
export const getOrdersByDay = async () => {
  const res = await ApiClient.get("/analytics/orders-by-day", { silent: true });
  return res.data;
};
export const getAvgOrderValue = async () => {
  const res = await ApiClient.get("/analytics/avg-order-value", { silent: true });
  return res.data;
};

// ── Staff Tab ────────────────────────────────────────────────────────────────
export const getStaffSummary = async () => {
  const res = await ApiClient.get("/analytics/staff-summary", { silent: true });
  return res.data;
};
export const getStaffRevenue = async () => {
  const res = await ApiClient.get("/analytics/staff-revenue", { silent: true });
  return res.data;
};
export const getStaffPerformance = async () => {
  const res = await ApiClient.get("/analytics/staff-performance", { silent: true });
  return res.data;
};
export const getStaffCollectionEfficiency = async () => {
  const res = await ApiClient.get("/analytics/staff-collection-efficiency", { silent: true });
  return res.data;
};

// ── Cash Flow Tab ────────────────────────────────────────────────────────────
export const getCashFlowSummary = async () => {
  const res = await ApiClient.get("/analytics/cashflow-summary", { silent: true });
  return res.data;
};
export const getReceivablesAging = async () => {
  const res = await ApiClient.get("/analytics/receivables-aging", { silent: true });
  return res.data;
};
export const getDsoTrend = async () => {
  const res = await ApiClient.get("/analytics/dso-trend", { silent: true });
  return res.data;
};
export const getCashFlowForecast = async () => {
  const res = await ApiClient.get("/analytics/cashflow-forecast", { silent: true });
  return res.data;
};

// ── AI Insights Tab ──────────────────────────────────────────────────────────
export const getAIInsights = async () => {
  const res = await ApiClient.get("/analytics/ai-insights", { silent: true });
  return res.data;
};

// ── Customer Analysis Tab ────────────────────────────────────────────────────
export const getCustomerSegmentation = async () => {
  const res = await ApiClient.get("/analytics/customer-segmentation", { silent: true });
  return res.data;
};
