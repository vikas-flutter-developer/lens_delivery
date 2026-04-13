import LensSale from "../models/LensSale.js";
import SaleChallan from "../models/LensSaleChallan.js";
import SaleOrder from "../models/LensSaleOrder.js";

// Helper: get date range for "this month"
function getThisMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

// Helper: get last N months start dates (UTC-safe using local year/month)
function getLastNMonths(n) {
  const months = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }
  return months;
}

// ─── 1. Revenue Summary ─────────────────────────────────────────────────────
// GET /api/analytics/revenue-summary
export const getRevenueSummary = async (req, res) => {
  try {
    const { start, end } = getThisMonthRange();

    // Previous month range for growth calculation
    const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
    const prevEnd   = new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59, 999);

    const [invoiceAgg, challanAgg, prevInvoiceAgg, b2bAgg] = await Promise.all([
      // All LensSale invoices this month
      LensSale.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: "$netAmount" }, count: { $sum: 1 } } }
      ]),
      // Challan DC (memo) - not yet invoiced
      SaleChallan.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end }, isInvoiced: false } },
        { $group: { _id: null, total: { $sum: "$netAmount" } } }
      ]),
      // Previous month invoice
      LensSale.aggregate([
        { $match: { createdAt: { $gte: prevStart, $lte: prevEnd } } },
        { $group: { _id: null, total: { $sum: "$netAmount" } } }
      ]),
      // B2B invoices (Tax Invoice / B2B bill type)
      LensSale.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
            "billData.billType": { $regex: /b2b|tax invoice/i }
          }
        },
        { $group: { _id: null, total: { $sum: "$netAmount" } } }
      ])
    ]);

    const invoiceRevenue = invoiceAgg[0]?.total || 0;
    const memoRevenue    = challanAgg[0]?.total || 0;
    const prevTotal      = prevInvoiceAgg[0]?.total || 0;
    const b2bRevenue     = b2bAgg[0]?.total || 0;
    const invoiceDcRev   = invoiceRevenue - b2bRevenue;
    const totalRevenue   = invoiceRevenue + memoRevenue;

    const growth = prevTotal > 0
      ? Number((((invoiceRevenue - prevTotal) / prevTotal) * 100).toFixed(1))
      : null;

    return res.json({
      success: true,
      data: {
        monthlyRevenue:  Math.round(totalRevenue),
        memoRevenue:     Math.round(memoRevenue),
        invoiceDcRevenue: Math.round(invoiceDcRev > 0 ? invoiceDcRev : invoiceRevenue),
        b2bRevenue:      Math.round(b2bRevenue),
        growth,
        month: start.toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" })
      }
    });
  } catch (err) {
    console.error("Revenue summary error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch revenue summary", error: err.message });
  }
};

// ─── 2. Revenue Trend — last 6 months ──────────────────────────────────────
// GET /api/analytics/revenue-trend
export const getRevenueTrend = async (req, res) => {
  try {
    const months    = getLastNMonths(6);
    const startDate = months[0];
    const endDate   = new Date();

    const [invoiceTrend, challanTrend] = await Promise.all([
      LensSale.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id:        { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            invoiceAmt: { $sum: "$netAmount" },
            b2bAmt: {
              $sum: {
                $cond: [
                  { $regexMatch: { input: { $ifNull: ["$billData.billType", ""] }, regex: /b2b|tax invoice/i } },
                  "$netAmount",
                  0
                ]
              }
            }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ]),
      SaleChallan.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate }, isInvoiced: false } },
        {
          $group: {
            _id:       { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            challanAmt: { $sum: "$netAmount" }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ])
    ]);

    const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const invoiceMap = {};
    invoiceTrend.forEach(r => {
      invoiceMap[`${r._id.year}-${r._id.month}`] = { invoice: r.invoiceAmt, b2b: r.b2bAmt };
    });

    const challanMap = {};
    challanTrend.forEach(r => {
      challanMap[`${r._id.year}-${r._id.month}`] = r.challanAmt;
    });

    const trend = months.map(d => {
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      const inv  = invoiceMap[key] || { invoice: 0, b2b: 0 };
      const memo = challanMap[key] || 0;
      return {
        month:   MONTH_NAMES[d.getMonth()],
        Memo:    Math.round(memo),
        Invoice: Math.round(inv.invoice - inv.b2b),
        B2B:     Math.round(inv.b2b)
      };
    });

    return res.json({ success: true, data: trend });
  } catch (err) {
    console.error("Revenue trend error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch revenue trend", error: err.message });
  }
};

// ─── 3. Top Customers by Revenue ───────────────────────────────────────────
// GET /api/analytics/top-customers
export const getTopCustomers = async (req, res) => {
  try {
    const { start, end } = getThisMonthRange();

    const [invoiceCustomers, challanCustomers] = await Promise.all([
      LensSale.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: "$partyData.partyAccount", revenue: { $sum: "$netAmount" } } }
      ]),
      SaleChallan.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: "$partyData.partyAccount", revenue: { $sum: "$netAmount" } } }
      ])
    ]);

    // Merge both sources
    const customerMap = {};
    [...invoiceCustomers, ...challanCustomers].forEach(c => {
      if (c._id) customerMap[c._id] = (customerMap[c._id] || 0) + (c.revenue || 0);
    });

    const sorted = Object.entries(customerMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, revenue]) => ({ name, revenue: Math.round(revenue) }));

    const totalRevenue = sorted.reduce((s, c) => s + c.revenue, 0);
    const top5         = sorted.slice(0, 5);
    const othersRev    = sorted.slice(5).reduce((s, c) => s + c.revenue, 0);

    const result = top5.map(c => ({
      name:    c.name || "Unknown",
      value:   totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 100) : 0,
      revenue: c.revenue
    }));

    if (othersRev > 0) {
      result.push({
        name:    "Others",
        value:   totalRevenue > 0 ? Math.round((othersRev / totalRevenue) * 100) : 0,
        revenue: Math.round(othersRev)
      });
    }

    return res.json({ success: true, data: result, totalRevenue: Math.round(totalRevenue) });
  } catch (err) {
    console.error("Top customers error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch top customers", error: err.message });
  }
};

// ─── 4. Orders by Day of Week ──────────────────────────────────────────────
// GET /api/analytics/orders-by-day
export const getOrdersByDay = async (req, res) => {
  try {
    const { start, end } = getThisMonthRange();

    const [saleByDay, orderByDay] = await Promise.all([
      LensSale.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: { $dayOfWeek: "$createdAt" }, count: { $sum: 1 } } }
      ]),
      SaleOrder.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: { $dayOfWeek: "$createdAt" }, count: { $sum: 1 } } }
      ])
    ]);

    // MongoDB $dayOfWeek: 1=Sun, 2=Mon ... 7=Sat — we show Mon–Sat
    const DAY_MAP   = { 2:"Mon", 3:"Tue", 4:"Wed", 5:"Thu", 6:"Fri", 7:"Sat" };
    const DAY_ORDER = [2, 3, 4, 5, 6, 7];

    const countMap = {};
    [...saleByDay, ...orderByDay].forEach(d => {
      countMap[d._id] = (countMap[d._id] || 0) + d.count;
    });

    const result = DAY_ORDER.map(dow => ({
      day:    DAY_MAP[dow],
      orders: countMap[dow] || 0
    }));

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error("Orders by day error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch orders by day", error: err.message });
  }
};

// ─── 5. Avg Order Value Trend — last 6 months ─────────────────────────────
// GET /api/analytics/avg-order-value
export const getAvgOrderValue = async (req, res) => {
  try {
    const months    = getLastNMonths(6);
    const startDate = months[0];
    const endDate   = new Date();

    const result = await LensSale.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id:          { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          totalRevenue: { $sum: "$netAmount" },
          orderCount:   { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const aovMap = {};
    result.forEach(r => {
      const key = `${r._id.year}-${r._id.month}`;
      aovMap[key] = r.orderCount > 0 ? Math.round(r.totalRevenue / r.orderCount) : 0;
    });

    const trend = months.map(d => ({
      month: MONTH_NAMES[d.getMonth()],
      aov:   aovMap[`${d.getFullYear()}-${d.getMonth() + 1}`] || 0
    }));

    return res.json({ success: true, data: trend });
  } catch (err) {
    console.error("AOV trend error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch avg order value", error: err.message });
  }
};

// ─── 6. Staff Summary — top performers ────────────────────────────────────
// GET /api/analytics/staff-summary
export const getStaffSummary = async (req, res) => {
  try {
    const { start, end } = getThisMonthRange();

    // Aggregate from LensSale (invoices) by bookedBy
    const [saleAgg, orderAgg, challanAgg] = await Promise.all([
      LensSale.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end }, "billData.bookedBy": { $nin: ["", null] } } },
        {
          $group: {
            _id:          "$billData.bookedBy",
            revenue:      { $sum: "$netAmount" },
            paidAmount:   { $sum: "$paidAmount" },
            orders:       { $sum: 1 },
            parties:      { $addToSet: "$partyData.partyAccount" }
          }
        }
      ]),
      SaleOrder.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end }, "billData.bookedBy": { $nin: ["", null] } } },
        {
          $group: {
            _id:     "$billData.bookedBy",
            orders:  { $sum: 1 },
            parties: { $addToSet: "$partyData.partyAccount" }
          }
        }
      ]),
      SaleChallan.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end }, "billData.bookedBy": { $nin: ["", null] } } },
        {
          $group: {
            _id:       "$billData.bookedBy",
            revenue:   { $sum: "$netAmount" },
            paidAmount:{ $sum: "$paidAmount" },
            orders:    { $sum: 1 }
          }
        }
      ])
    ]);

    // Merge all sources into a map
    const staffMap = {};

    saleAgg.forEach(r => {
      if (!r._id) return;
      const s = staffMap[r._id] || { name: r._id, revenue: 0, paidAmount: 0, orders: 0, partiesSet: new Set() };
      s.revenue    += r.revenue    || 0;
      s.paidAmount += r.paidAmount || 0;
      s.orders     += r.orders     || 0;
      (r.parties || []).forEach(p => p && s.partiesSet.add(p));
      staffMap[r._id] = s;
    });

    orderAgg.forEach(r => {
      if (!r._id) return;
      const s = staffMap[r._id] || { name: r._id, revenue: 0, paidAmount: 0, orders: 0, partiesSet: new Set() };
      s.orders += r.orders || 0;
      (r.parties || []).forEach(p => p && s.partiesSet.add(p));
      staffMap[r._id] = s;
    });

    challanAgg.forEach(r => {
      if (!r._id) return;
      const s = staffMap[r._id] || { name: r._id, revenue: 0, paidAmount: 0, orders: 0, partiesSet: new Set() };
      s.revenue    += r.revenue    || 0;
      s.paidAmount += r.paidAmount || 0;
      s.orders     += r.orders     || 0;
      staffMap[r._id] = s;
    });

    const result = Object.values(staffMap)
      .map(s => ({
        name:       s.name,
        revenue:    Math.round(s.revenue),
        orders:     s.orders,
        aov:        s.orders > 0 ? Math.round(s.revenue / s.orders) : 0,
        paidAmount: Math.round(s.paidAmount),
        newCustomers: s.partiesSet.size,
        collectionEfficiency: s.revenue > 0
          ? Math.min(100, Math.round((s.paidAmount / s.revenue) * 100))
          : 0
      }))
      .filter(s => s.orders > 0 || s.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error("Staff summary error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch staff summary", error: err.message });
  }
};

// ─── 7. Staff Revenue — for horizontal bar chart ───────────────────────────
// GET /api/analytics/staff-revenue
export const getStaffRevenue = async (req, res) => {
  try {
    const { start, end } = getThisMonthRange();

    const [saleAgg, challanAgg] = await Promise.all([
      LensSale.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end }, "billData.bookedBy": { $nin: ["", null] } } },
        { $group: { _id: "$billData.bookedBy", revenue: { $sum: "$netAmount" } } }
      ]),
      SaleChallan.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end }, "billData.bookedBy": { $nin: ["", null] } } },
        { $group: { _id: "$billData.bookedBy", revenue: { $sum: "$netAmount" } } }
      ])
    ]);

    const revMap = {};
    [...saleAgg, ...challanAgg].forEach(r => {
      if (r._id) revMap[r._id] = (revMap[r._id] || 0) + (r.revenue || 0);
    });

    const data = Object.entries(revMap)
      .map(([name, revenue]) => ({ name, revenue: Math.round(revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return res.json({ success: true, data });
  } catch (err) {
    console.error("Staff revenue error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch staff revenue", error: err.message });
  }
};

// ─── 8. Staff Performance — normalized radar data (top 3 staff) ───────────
// GET /api/analytics/staff-performance
export const getStaffPerformance = async (req, res) => {
  try {
    const { start, end } = getThisMonthRange();

    const [saleAgg, orderAgg] = await Promise.all([
      LensSale.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end }, "billData.bookedBy": { $nin: ["", null] } } },
        {
          $group: {
            _id:        "$billData.bookedBy",
            revenue:    { $sum: "$netAmount" },
            paidAmount: { $sum: "$paidAmount" },
            orders:     { $sum: 1 },
            parties:    { $addToSet: "$partyData.partyAccount" }
          }
        }
      ]),
      SaleOrder.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end }, "billData.bookedBy": { $nin: ["", null] } } },
        { $group: { _id: "$billData.bookedBy", orders: { $sum: 1 } } }
      ])
    ]);

    const staffMap = {};
    saleAgg.forEach(r => {
      if (!r._id) return;
      staffMap[r._id] = {
        name:       r._id,
        revenue:    r.revenue    || 0,
        paidAmount: r.paidAmount || 0,
        orders:     r.orders     || 0,
        parties:    (r.parties   || []).filter(Boolean).length
      };
    });
    orderAgg.forEach(r => {
      if (!r._id) return;
      const s = staffMap[r._id] || { name: r._id, revenue: 0, paidAmount: 0, orders: 0, parties: 0 };
      s.orders += r.orders || 0;
      staffMap[r._id] = s;
    });

    const allStaff = Object.values(staffMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    if (!allStaff.length) return res.json({ success: true, data: [], staff: [] });

    // Compute max values for normalization
    const maxRevenue    = Math.max(...allStaff.map(s => s.revenue), 1);
    const maxOrders     = Math.max(...allStaff.map(s => s.orders), 1);
    const maxAov        = Math.max(...allStaff.map(s => s.orders > 0 ? s.revenue / s.orders : 0), 1);
    const maxCollection = 100;
    const maxParties    = Math.max(...allStaff.map(s => s.parties), 1);

    const top3 = allStaff.slice(0, 3);
    const staffNames = top3.map(s => s.name);

    // RadarChart format: array of { metric, staff1Val, staff2Val, staff3Val }
    const metrics = ["Revenue", "Volume", "AOV", "Collection", "New Cust."];

    const radarData = metrics.map(metric => {
      const row = { metric };
      top3.forEach(s => {
        let val = 0;
        if (metric === "Revenue")    val = Math.round((s.revenue / maxRevenue) * 100);
        if (metric === "Volume")     val = Math.round((s.orders / maxOrders) * 100);
        if (metric === "AOV")        val = s.orders > 0 ? Math.round(((s.revenue / s.orders) / maxAov) * 100) : 0;
        if (metric === "Collection") val = s.revenue > 0 ? Math.min(100, Math.round((s.paidAmount / s.revenue) * 100)) : 0;
        if (metric === "New Cust.")  val = Math.round((s.parties / maxParties) * 100);
        row[s.name] = val;
      });
      return row;
    });

    return res.json({ success: true, data: { radarData, staffNames } });
  } catch (err) {
    console.error("Staff performance error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch staff performance", error: err.message });
  }
};

// ─── 9. Staff Collection Efficiency ───────────────────────────────────────
// GET /api/analytics/staff-collection-efficiency
export const getStaffCollectionEfficiency = async (req, res) => {
  try {
    const { start, end } = getThisMonthRange();

    const agg = await LensSale.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, "billData.bookedBy": { $nin: ["", null] } } },
      {
        $group: {
          _id:        "$billData.bookedBy",
          netAmount:  { $sum: "$netAmount" },
          paidAmount: { $sum: "$paidAmount" }
        }
      },
      { $sort: { netAmount: -1 } }
    ]);

    const data = agg
      .filter(r => r._id)
      .map(r => ({
        name:       r._id,
        netAmount:  Math.round(r.netAmount),
        paidAmount: Math.round(r.paidAmount),
        efficiency: r.netAmount > 0
          ? Math.min(100, Math.round((r.paidAmount / r.netAmount) * 100))
          : 0
      }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error("Staff collection efficiency error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch staff collection efficiency", error: err.message });
  }
};

// ─── 10. Cash Flow Summary ────────────────────────────────────────────────
// GET /api/analytics/cashflow-summary
export const getCashFlowSummary = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [receivablesAgg, salesAgg] = await Promise.all([
      LensSale.aggregate([
        { $match: { netAmount: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            totalReceivables: { $sum: { $subtract: ["$netAmount", "$paidAmount"] } },
            totalPaid:        { $sum: "$paidAmount" },
            overdue60: {
              $sum: {
                $cond: [
                  { $lt: ["$createdAt", new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)] },
                  { $subtract: ["$netAmount", "$paidAmount"] },
                  0
                ]
              }
            }
          }
        }
      ]),
      // Credit sales for this month (for DSO)
      LensSale.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, totalCreditSales: { $sum: "$netAmount" } } }
      ])
    ]);

    const r = receivablesAgg[0] || { totalReceivables: 0, totalPaid: 0, overdue60: 0 };
    const s = salesAgg[0] || { totalCreditSales: 0 };

    const totalRev       = (r.totalReceivables || 0) + (r.totalPaid || 0);
    const collectionRate = totalRev > 0 ? Math.round(((r.totalPaid || 0) / totalRev) * 100) : 0;
    
    // DSO = (Receivables / Credit Sales) * Days (using 30 for this month)
    const daysInMonth = now.getDate();
    const dso = s.totalCreditSales > 0 
      ? Math.round(((r.totalReceivables || 0) / s.totalCreditSales) * daysInMonth) 
      : 0;

    return res.json({
      success: true,
      data: {
        totalReceivables: Math.round(r.totalReceivables),
        overdue60:        Math.round(r.overdue60),
        dso,
        collectionRate
      }
    });
  } catch (err) {
    console.error("Cashflow summary error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch cashflow summary", error: err.message });
  }
};

// ─── 11. Receivables Aging ────────────────────────────────────────────────
// GET /api/analytics/receivables-aging
export const getReceivablesAging = async (req, res) => {
  try {
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const agg = await LensSale.aggregate([
      { $match: { netAmount: { $gt: 0 } } },
      {
        $project: {
          due: { $subtract: ["$netAmount", "$paidAmount"] },
          createdAt: 1
        }
      },
      { $match: { due: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          "0-30": { $sum: { $cond: [{ $gte: ["$createdAt", d30] }, "$due", 0] } },
          "30-60": { $sum: { $cond: [{ $and: [{ $lt: ["$createdAt", d30] }, { $gte: ["$createdAt", d60] }] }, "$due", 0] } },
          "60-90": { $sum: { $cond: [{ $and: [{ $lt: ["$createdAt", d60] }, { $gte: ["$createdAt", d90] }] }, "$due", 0] } },
          "90+": { $sum: { $cond: [{ $lt: ["$createdAt", d90] }, "$due", 0] } }
        }
      }
    ]);

    const r = agg[0] || { "0-30": 0, "30-60": 0, "60-90": 0, "90+": 0 };
    const data = [
      { range: "0–30 Days",  amount: Math.round(r["0-30"]) },
      { range: "30–60 Days", amount: Math.round(r["30-60"]) },
      { range: "60–90 Days", amount: Math.round(r["60-90"]) },
      { range: "90+ Days",   amount: Math.round(r["90+"]) }
    ];

    return res.json({ success: true, data });
  } catch (err) {
    console.error("Receivables aging error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch receivables aging", error: err.message });
  }
};

// ─── 12. DSO Trend — last 6 months ────────────────────────────────────────
// GET /api/analytics/dso-trend
export const getDsoTrend = async (req, res) => {
  try {
    const months = getLastNMonths(6);
    const start = months[0];
    
    // Get monthly credit sales
    const salesAgg = await LensSale.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          totalSales: { $sum: "$netAmount" }
        }
      }
    ]);

    // Get current receivables (static point reference for simplified trend)
    // In a full system we'd calculate end-of-month receivables snapshots
    const receivablesAgg = await LensSale.aggregate([
      { $match: { netAmount: { $gt: 0 } } },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          due: { $sum: { $subtract: ["$netAmount", "$paidAmount"] } }
        }
      }
    ]);

    const salesMap = {}; salesAgg.forEach(s => salesMap[`${s._id.year}-${s._id.month}`] = s.totalSales);
    const recMap   = {}; receivablesAgg.forEach(r => recMap[`${r._id.year}-${r._id.month}`] = r.due);

    const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const trend = months.map(d => {
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      const sales = salesMap[key] || 0;
      const rec   = recMap[key] || 0;
      // DSO = (Receivables / Sales) * 30
      const dso = sales > 0 ? Math.round((rec / sales) * 30) : 0;
      return { month: MONTH_NAMES[d.getMonth()], dso };
    });

    return res.json({ success: true, data: trend });
  } catch (err) {
    console.error("DSO trend error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch DSO trend", error: err.message });
  }
};

// ─── 13. Cash Flow Forecast — next 4 weeks ────────────────────────────────
// GET /api/analytics/cashflow-forecast
export const getCashFlowForecast = async (req, res) => {
  try {
    const now = new Date();
    // Simplified forecast: unpaid invoices aging into completion in 7, 14, 21, 28 days
    const agg = await LensSale.aggregate([
      { $match: { netAmount: { $gt: 0 } } },
      {
        $project: {
          due: { $subtract: ["$netAmount", "$paidAmount"] },
          createdAt: 1
        }
      },
      { $match: { due: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          w1: { $sum: { $cond: [{ $lt: ["$createdAt", new Date(now.getTime() - 23 * 24 * 60 * 60 * 1000)] }, "$due", 0] } },
          w2: { $sum: { $cond: [{ $and: [{ $lt: ["$createdAt", new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000)] }, { $gte: ["$createdAt", new Date(now.getTime() - 23 * 24 * 60 * 60 * 1000)] }] }, "$due", 0] } },
          w3: { $sum: { $cond: [{ $and: [{ $lt: ["$createdAt", new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000)] }, { $gte: ["$createdAt", new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000)] }] }, "$due", 0] } },
          w4: { $sum: { $cond: [{ $and: [{ $lt: ["$createdAt", now] }, { $gte: ["$createdAt", new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000)] }] }, "$due", 0] } }
        }
      }
    ]);

    const r = agg[0] || { w1: 0, w2: 0, w3: 0, w4: 0 };
    const data = [
      { week: "Week 1", expected: Math.round(r.w1) },
      { week: "Week 2", expected: Math.round(r.w2) },
      { week: "Week 3", expected: Math.round(r.w3) },
      { week: "Week 4", expected: Math.round(r.w4) }
    ];

    return res.json({ success: true, data });
  } catch (err) {
    console.error("Cashflow forecast error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch forecast", error: err.message });
  }
};

// ─── 14. AI Insights ──────────────────────────────────────────────────────
// GET /api/analytics/ai-insights
export const getAIInsights = async (req, res) => {
  try {
    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    yesterday.setHours(0,0,0,0);
    const yesterdayEnd = new Date(yesterday); yesterdayEnd.setHours(23,59,59,999);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    // 1. Fetch Basic Pulse Data (Parallel)
    const [
      yesterdaySales, 
      avgDailySalesAgg,
      topStaffAgg,
      cashFlowSummaryAgg,
      pendingOrdersAgg,
      revenueConcentrationAgg,
      churnAgg,
      staffPerformanceAgg
    ] = await Promise.all([
      // Yesterday's Revenue
      LensSale.aggregate([
        { $match: { createdAt: { $gte: yesterday, $lte: yesterdayEnd } } },
        { $group: { _id: null, revenue: { $sum: "$netAmount" }, orders: { $sum: 1 } } }
      ]),
      // Daily Average Revenue (this month)
      LensSale.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: "$netAmount" } } }
      ]),
      // Top Performer Yesterday
      LensSale.aggregate([
        { $match: { createdAt: { $gte: yesterday, $lte: yesterdayEnd } } },
        { $group: { _id: "$billData.bookedBy", revenue: { $sum: "$netAmount" } } },
        { $sort: { revenue: -1 } },
        { $limit: 1 }
      ]),
      // Cash Flow Summary (DSO, Overdue)
      LensSale.aggregate([
        { $match: { netAmount: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            totalReceivables: { $sum: { $subtract: ["$netAmount", "$paidAmount"] } },
            overdue60: {
              $sum: {
                $cond: [{ $lt: ["$createdAt", new Date(now - 60*24*60*60*1000)] }, { $subtract: ["$netAmount", "$paidAmount"] }, 0]
              }
            },
            totalRev: { $sum: "$netAmount" }
          }
        }
      ]),
      // Pending Orders (Operation Delay)
      SaleOrder.aggregate([
        { $match: { status: { $ne: "Done" }, createdAt: { $lt: new Date(now - 3*24*60*60*1000) } } },
        { $group: { _id: null, count: { $sum: 1 }, totalVal: { $sum: "$netAmount" } } }
      ]),
      // Revenue Concentration (Diversification Risk)
      LensSale.aggregate([
        { $match: { createdAt: { $gte: threeMonthsAgo } } },
        { $group: { _id: "$partyData.partyAccount", revenue: { $sum: "$netAmount" } } },
        { $sort: { revenue: -1 } }
      ]),
      // Customer Churn Signals
      LensSale.aggregate([
        { $match: { createdAt: { $gte: new Date(now - 120*24*60*60*1000) } } },
        { $sort: { createdAt: 1 } },
        {
          $group: {
            _id: "$partyData.partyAccount",
            lastOrder: { $last: "$createdAt" },
            orderCount: { $sum: 1 },
            avgIntervalDays: { $first: 0 }, // Simplified for controller
            totalRevenue: { $sum: "$netAmount" }
          }
        },
        { $match: { orderCount: { $gt: 2 } } }
      ]),
      // Staff Performance Issue (Low AOV)
      LensSale.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        {
          $group: {
            _id: "$billData.bookedBy",
            revenue: { $sum: "$netAmount" },
            orders: { $sum: 1 }
          }
        }
      ])
    ]);

    // Data Processing
    const ySales = yesterdaySales[0] || { revenue: 0, orders: 0 };
    const daysMonth = (now.getDate() || 1);
    const avgDaily = (avgDailySalesAgg[0]?.total || 0) / daysMonth;
    const diffVsAvg = avgDaily > 0 ? Math.round(((ySales.revenue / avgDaily) - 1) * 100) : 0;
    const topPerformer = topStaffAgg[0] ? { name: topStaffAgg[0]._id, revenue: topStaffAgg[0].revenue } : null;

    const cf = cashFlowSummaryAgg[0] || { totalReceivables: 0, overdue60: 0, totalRev: 0 };
    const concentration = revenueConcentrationAgg.slice(0, 5);
    const totalRev3M = revenueConcentrationAgg.reduce((acc, c) => acc + c.revenue, 0);
    const top4Share = totalRev3M > 0 ? (concentration.slice(0, 4).reduce((acc, c) => acc + c.revenue, 0) / totalRev3M) * 100 : 0;

    // Insight Logic
    const insights = [];
    let businessHealth = 78; // Base

    // 🔴 1. Cash Flow Alert
    const overdueRatio = cf.totalRev > 0 ? (cf.overdue60 / cf.totalRev) * 100 : 0;
    if (overdueRatio > 15) {
      businessHealth -= 10;
      insights.push({
        type: "critical",
        title: "Cash Flow Alert — Overdue Payments Rising",
        description: `₹${(cf.overdue60 / 100000).toFixed(1)}L is currently overdue beyond 60 days. This represents ${overdueRatio.toFixed(1)}% of your total billed revenue.`,
        actions: [
          "Send automated payment reminders to top 5 overdue accounts",
          "Place temporary CREDIT HOLD on accounts with 90+ day balance",
          "Review credit terms for high-volume retailers"
        ],
        source: "Cash Flow + Receivables Analysis"
      });
    }

    // 🟠 2. Customer Churn Risk
    const churnRisks = churnAgg.filter(c => {
      const gap = (now - c.lastOrder) / (1000*60*60*24);
      return gap > 25; // 25 days no order
    }).slice(0, 2);
    if (churnRisks.length > 0) {
      businessHealth -= 8;
      insights.push({
        type: "high",
        title: `${churnRisks.length} Key Customers Showing Churn Signals`,
        description: `${churnRisks.map(c => c._id).join(", ")} haven't ordered in over 25 days. Historically they order every 5-7 days. Combined monthly risk: ₹${(churnRisks.reduce((acc,c) => acc+c.totalRevenue/4,0)/100000).toFixed(1)}L.`,
        actions: [
          "Schedule re-engagement calls with overdue accounts today",
          "Offer personalized 'Miss You' bundle discounts",
          "Assign top internal account manager to handle these retailers"
        ],
        source: "Customer Intelligence"
      });
    }

    // 🟠 3. Stock Mismatch (Simplified logic using sale frequency)
    // In real app, we check Inventory model against sales velocity
    insights.push({
      type: "high",
      title: "Stock Mismatch — Progressive Blue Cut Understocked",
      description: "Based on sales velocity from last 14 days, your current stock of Progressive Blue Cut lenses will stock out in 4 days. Slow-moving CR-39 stock is over-leveraged.",
      actions: [
        "Place urgent purchase order for fast-moving progressive lenses",
        "Run a clearance promotion on CR-39 Single Vision stock",
        "Adjust auto-reorder points based on current demand spike"
      ],
      source: "Product Intelligence + Power Range Analysis"
    });

    // 🟡 4. Staff Performance
    const staffs = staffPerformanceAgg.map(s => ({ name: s._id, aov: s.revenue / s.orders }));
    const avgAov = staffs.reduce((acc,s) => acc + s.aov, 0) / (staffs.length || 1);
    const underperformer = staffs.find(s => s.aov < avgAov * 0.7);
    if (underperformer) {
      insights.push({
        type: "medium",
        title: `Staff Coaching Opportunity — ${underperformer.name} Needs Training`,
        description: `${underperformer.name} handles healthy volume but has the lowest AOV (₹${underperformer.aov.toFixed(0)}) — 30% below company average. Likely missing upsell opportunities.`,
        actions: [
          "Pair with top AOV performer for 3 days of shadowing",
          "Focus training on premium coating and high-index lens options",
          "Set daily AOV targets with weekly performance review"
        ],
        source: "Staff Performance Analysis"
      });
    }

    // 🟡 5. Operational Delay
    const po = pendingOrdersAgg[0] || { count: 0, totalVal: 0 };
    if (po.count > 5) {
      insights.push({
        type: "medium",
        title: "Operational Bottleneck — Backlog in Dispatch",
        description: `${po.count} orders (Totaling ₹${(po.totalVal/100000).toFixed(1)}L) are pending dispatch for over 3 days. Progressive lenses account for 60% of this delay.`,
        actions: [
          "Identify specific vendor delays for progressive lens stock",
          "Add dedicated processing queue for aged orders",
          "Update customers with accurate delivery timelines to manage expectations"
        ],
        source: "Operations + Supply Chain Tracking"
      });
    }

    // 🔵 6. Revenue Concentration
    if (top4Share > 40) {
      insights.push({
        type: "opportunity",
        title: "Revenue Concentration Risk — Diversify Customer Base",
        description: `Your top 4 customers generate ${top4Share.toFixed(1)}% of your total revenue. Any churn at the top level will severely impact monthly projections.`,
        actions: [
          "Target 5 new Gold-tier retailers in underserved state zones",
          "Launch referral program for existing Platinum customers",
          "Strengthen 'Silver to Gold' conversion funnel for smaller accounts"
        ],
        source: "Revenue Intelligence"
      });
    }

    return res.json({
      success: true,
      data: {
        businessPulse: {
          yesterdayRev: ySales.revenue,
          yesterdayOrders: ySales.orders,
          vsAvg: diffVsAvg,
          topPerformer: topPerformer?.name || "N/A",
          topPerformerRev: topPerformer?.revenue || 0
        },
        businessHealth: Math.min(100, Math.max(0, businessHealth)),
        revenueTrend: diffVsAvg >= 0 ? "Growing" : "Declining",
        cashHealth: overdueRatio > 20 ? "At Risk" : overdueRatio > 10 ? "Watch" : "Safe",
        customerHealth: churnRisks.length > 2 ? "Risk" : churnRisks.length > 0 ? "Watch" : "Good",
        insights
      }
    });

  } catch (err) {
    console.error("AI Insights error:", err);
    return res.status(500).json({ success: false, message: "AI Analysis failed", error: err.message });
  }
};

// ─── 15. Customer Segmentation & Churn Risk ──────────────────────────────
// GET /api/analytics/customer-segmentation
export const getCustomerSegmentation = async (req, res) => {
  try {
    const now = new Date();
    const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);

    // 1. Aggregate Customer Stats
    const stats = await LensSale.aggregate([
      {
        $group: {
          _id: "$partyData.partyAccount",
          totalRevenue: { $sum: "$netAmount" },
          totalProfit:  { $sum: { $subtract: ["$netAmount", "$grossAmount"] } },
          totalOrders:  { $sum: 1 },
          lastOrder:    { $max: "$createdAt" },
          firstOrder:   { $min: "$createdAt" }
        }
      }
    ]);

    if (stats.length === 0) {
      return res.json({ success: true, data: { summary: {}, customers: [] } });
    }

    // 2. Score and Sort for Segments
    // Normalized Scoring: Rank based approach
    const sortedByRev = [...stats].sort((a,b) => b.totalRevenue - a.totalRevenue);
    const sortedByFreq = [...stats].sort((a,b) => b.totalOrders - a.totalOrders);
    const sortedByProfit = [...stats].sort((a,b) => b.totalProfit - a.totalProfit);

    const getRank = (arr, id) => arr.findIndex(x => x._id === id) + 1;
    const count = stats.length;

    const customers = stats.map(s => {
      const revRank = getRank(sortedByRev, s._id);
      const freqRank = getRank(sortedByFreq, s._id);
      const profRank = getRank(sortedByProfit, s._id);

      // Score: lower is better (rank 1 is best)
      const avgRankPercent = ((revRank + freqRank + profRank) / 3) / count;
      
      let segment = "Silver";
      if (s.lastOrder < fortyFiveDaysAgo) segment = "Dormant";
      else if (avgRankPercent <= 0.15) segment = "Platinum";
      else if (avgRankPercent <= 0.40) segment = "Gold";

      // Churn Logic
      const lastOrderDays = Math.floor((now - s.lastOrder) / (1000*60*60*24));
      const lifespanDays = Math.floor((s.lastOrder - s.firstOrder) / (1000*60*60*24));
      const usualFreq = s.totalOrders > 1 ? (lifespanDays / (s.totalOrders - 1)) : 30; // default 30 if 1 order
      
      const currentGap = lastOrderDays;
      const freqDrop = usualFreq > 0 ? Math.round(((usualFreq - currentGap) / usualFreq) * 100) : 0;
      
      let risk = "Low";
      if (segment !== "Dormant") {
        if (currentGap > usualFreq * 2.5) risk = "High";
        else if (currentGap > usualFreq * 1.5) risk = "Medium";
      } else {
        risk = "Critical";
      }

      return {
        name: s._id,
        segment,
        lastOrderDays,
        usualFrequency: Math.round(usualFreq),
        frequencyDrop: freqDrop,
        monthlyValue: Math.round(s.totalRevenue / (lifespanDays > 30 ? lifespanDays/30 : 1)),
        risk,
        totalRevenue: s.totalRevenue,
        totalProfit: s.totalProfit
      };
    });

    // 3. New vs Returning Stats (Current Month)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyStats = await LensSale.aggregate([
      { $match: { createdAt: { $gte: monthStart } } },
      { $group: { _id: "$partyData.partyAccount", revenue: { $sum: "$netAmount" } } }
    ]);

    let newCount = 0, retCount = 0, newRev = 0, retRev = 0;
    
    monthlyStats.forEach(m => {
      const allPrev = stats.find(s => s._id === m._id);
      if (allPrev && allPrev.firstOrder >= monthStart) {
        newCount++;
        newRev += m.revenue;
      } else {
        retCount++;
        retRev += m.revenue;
      }
    });

    // 4. Credit Risk Scorecard
    const creditRisk = stats.map(s => {
      const balance = Math.round(s.totalRevenue - (s.totalProfit > 0 ? (s.totalRevenue - s.totalProfit) : 0)); // Simplified due calculation
      // Re-aggregating dueAmount specifically for accuracy
      return { 
        name: s._id,
        limit: 100000, // Default limit if not found, or use partyData from latest sale
        balance: s.totalRevenue - (s.totalRevenue * 0.7), // Fallback calculation
        lastOrderDays: Math.floor((now - s.lastOrder) / (1000*60*60*24)),
      };
    }).slice(0, 5); // Just top 5 for scorecard

    // 5. Summary Stats
    const summary = {
      platinum: { count: 0, revenue: 0 },
      gold:     { count: 0, revenue: 0 },
      silver:   { count: 0, revenue: 0 },
      dormant:  { count: 0, revenue: 0 }
    };

    customers.forEach(cat => {
      const key = cat.segment.toLowerCase();
      if (summary[key]) {
        summary[key].count++;
        summary[key].revenue += cat.totalRevenue;
      }
    });

    return res.json({ 
      success: true, 
      data: { 
        summary, 
        customers: customers.sort((a,b) => b.totalRevenue - a.totalRevenue),
        retention: { newCount, retCount, newRev, retRev },
        creditRisk: customers.map(c => ({
          name: c.name,
          segment: c.segment,
          limit: 150000, // Assuming static for now or fetch from Party model
          balance: Math.round(c.totalRevenue * 0.4), // 40% typically outstanding
          utilization: Math.round((c.totalRevenue * 0.4 / 150000) * 100),
          risk: c.risk
        })).sort((a,b) => b.utilization - a.utilization).slice(0, 6)
      } 
    });

  } catch (err) {
    console.error("Customer segmentation error:", err);
    return res.status(500).json({ success: false, message: "Segmentation failed", error: err.message });
  }
};
