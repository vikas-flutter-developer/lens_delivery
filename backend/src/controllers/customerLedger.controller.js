import LensPurchase from "../models/LensPurchase.js";
import LensSale from "../models/LensSale.js";
import LensSaleOrder from "../models/LensSaleOrder.js";
import LensPurchaseChallan from "../models/LensPurchaseChallan.js";
import LensSaleChallan from "../models/LensSaleChallan.js";
import Account from "../models/Account.js";
import redis from "../config/redis.js";

/**
 * Helper to convert date string to Date object (start of day)
 */
const parseDate = (dateStr, isEndOfDay = false) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isEndOfDay) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d;
};

/**
 * Get Customer Ledger
 * Shows only the ledger for the authenticated sale customer
 */
export const getCustomerLedger = async (req, res) => {
  try {
    // Get account ID from authenticated customer
    const customerId = req.customer?.id;
    const accountId = req.customer?.accountId;

    if (!customerId || !accountId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - customer info not found",
      });
    }

    // Get account details
    const account = await Account.findById(customerId);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    const partyAccount = account.Name;
    const companyId = account.companyId;

    // Get optional date filters from query/body
    const { fromDate, toDate } = req.body || req.query;

    // ----- Redis Caching Layer -----
    const cacheKey = `ledger:${customerId}:${companyId}:${fromDate || "all"}:${toDate || "all"}`;
    const startTime = Date.now();
    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        console.log(`[Redis] CACHE HIT - Serving ${cacheKey} in ${Date.now() - startTime}ms`);
        return res.status(200).json(JSON.parse(cachedData));
      }
      console.log(`[Redis] CACHE MISS - ${cacheKey}`);
    } catch (redisError) {
      console.error("[Redis] Cache Error:", redisError.message);
    }
    // -------------------------------

    const fromDateObj = parseDate(fromDate, false); // Start of day
    const toDateObj = parseDate(toDate, true); // End of day

    // Build match conditions
    const baseMatch = {
      "partyData.partyAccount": partyAccount,
      $or: [
        { companyId },
        { companyId: null }
      ]
    };
    if (fromDateObj && toDateObj) {
      baseMatch["billData.date"] = { $gte: fromDateObj, $lte: toDateObj };
    } else if (fromDateObj) {
      baseMatch["billData.date"] = { $gte: fromDateObj };
    } else if (toDateObj) {
      baseMatch["billData.date"] = { $lte: toDateObj };
    }

    // Compute opening balance (sum of balanceImpact BEFORE fromDate)
    let openingBalance = 0;

    if (fromDateObj) {
      const matchBefore = {
        "partyData.partyAccount": partyAccount,
        "billData.date": { $lt: fromDateObj },
        $or: [
          { companyId },
          { companyId: null }
        ]
      };

      // Opening: Sale transactions before fromDate
      const openingAggSale = await LensSale.aggregate([
        { $match: matchBefore },
        {
          $project: {
            balanceImpact: { $subtract: ["$netAmount", "$paidAmount"] },
          },
        },
        { $group: { _id: null, opening: { $sum: "$balanceImpact" } } },
      ]);

      if (openingAggSale.length > 0 && openingAggSale[0].opening) {
        openingBalance += openingAggSale[0].opening;
      }

      // Opening: Sale Challans (not invoiced) before fromDate
      const openingAggSaleChallan = await LensSaleChallan.aggregate([
        {
          $match: Object.assign({}, matchBefore, { isInvoiced: { $ne: true } }),
        },
        {
          $project: {
            balanceImpact: { $subtract: ["$netAmount", "$paidAmount"] },
          },
        },
        { $group: { _id: null, opening: { $sum: "$balanceImpact" } } },
      ]);

      if (
        openingAggSaleChallan.length > 0 &&
        openingAggSaleChallan[0].opening
      ) {
        openingBalance += openingAggSaleChallan[0].opening;
      }
    }

    // Fetch all sale transactions in date range
    const sales = await LensSale.find(baseMatch).lean();

    // Fetch all sale challans (not invoiced) in date range
    const saleChallan = await LensSaleChallan.find({
      ...baseMatch,
      isInvoiced: { $ne: true },
    }).lean();

    // Fetch all sale orders in date range
    const saleOrders = await LensSaleOrder.find(baseMatch).lean();

    // Combine and format entries
    const entries = [];

    // Add sale invoices
    sales.forEach((sale) => {
      entries.push({
        date: sale.billData?.date,
        reference: sale.billData?.billNo || "",
        type: "Sale",
        amount: sale.netAmount || 0,
        paid: sale.paidAmount || 0,
        balance: sale.netAmount - sale.paidAmount,
        billSeries: sale.billData?.billSeries || "",
      });
    });

    // Add sale challans (not invoiced)
    saleChallan.forEach((challan) => {
      entries.push({
        date: challan.billData?.date,
        reference: challan.billData?.billNo || "",
        type: "Sale Challan",
        amount: challan.netAmount || 0,
        paid: challan.paidAmount || 0,
        balance: challan.netAmount - challan.paidAmount,
        billSeries: challan.billData?.billSeries || "",
      });
    });

    // Add sale orders
    saleOrders.forEach((order) => {
      entries.push({
        date: order.billData?.date,
        reference: order.billData?.billNo || "",
        type: "Sale Order",
        amount: order.netAmount || 0,
        paid: order.paidAmount || 0,
        balance: order.netAmount - order.paidAmount,
        billSeries: order.billData?.billSeries || "",
      });
    });

    // Sort entries by date
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance
    let runningBalance = openingBalance;
    const ledgerEntries = entries.map((entry) => {
      runningBalance += entry.balance;
      return {
        ...entry,
        runningBalance,
      };
    });

    // Calculate totals
    const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
    const totalPaid = entries.reduce((sum, e) => sum + e.paid, 0);
    const closingBalance = openingBalance + totalAmount - totalPaid;

    const responseData = {
      success: true,
      customer: {
        accountId: account.AccountId,
        name: account.Name,
        email: account.Email,
        mobileNumber: account.MobileNumber,
      },
      summary: {
        openingBalance,
        totalAmount,
        totalPaid,
        closingBalance,
        fromDate: fromDateObj?.toISOString().split("T")[0],
        toDate: toDateObj?.toISOString().split("T")[0],
      },
      entries: ledgerEntries,
    };

    // Cache the response data
    try {
      const ttl = parseInt(process.env.REDIS_TTL) || 600;
      await redis.set(cacheKey, JSON.stringify(responseData), "EX", ttl);
      console.log(`[Redis] CACHE COMPLETED - Query took ${Date.now() - startTime}ms`);
    } catch (redisError) {
      console.error("[Redis] Cache Set Error:", redisError.message);
    }

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Get customer ledger error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while fetching ledger",
      error: error.message,
    });
  }
};

/**
 * Get Customer Balance
 * Returns current outstanding balance for the customer
 */
export const getCustomerBalance = async (req, res) => {
  try {
    const customerId = req.customer?.id;
    const accountId = req.customer?.accountId;

    if (!customerId || !accountId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const account = await Account.findById(customerId);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    const partyAccount = account.Name;
    const companyId = account.companyId;

    // Calculate total outstanding from all transactions
    let totalOutstanding = 0;

    // Sale transactions
    const saleAgg = await LensSale.aggregate([
      {
        $match: {
          "partyData.partyAccount": partyAccount,
          $or: [
            { companyId },
            { companyId: null }
          ]
        }
      },
      {
        $project: {
          outstanding: { $subtract: ["$netAmount", "$paidAmount"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$outstanding" } } },
    ]);

    if (saleAgg.length > 0) {
      totalOutstanding += saleAgg[0].total || 0;
    }

    // Sale challans (not invoiced)
    const saleChallanAgg = await LensSaleChallan.aggregate([
      {
        $match: {
          "partyData.partyAccount": partyAccount,
          isInvoiced: { $ne: true },
          $or: [
            { companyId },
            { companyId: null }
          ]
        },
      },
      {
        $project: {
          outstanding: { $subtract: ["$netAmount", "$paidAmount"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$outstanding" } } },
    ]);

    if (saleChallanAgg.length > 0) {
      totalOutstanding += saleChallanAgg[0].total || 0;
    }

    // Sale orders
    const saleOrderAgg = await LensSaleOrder.aggregate([
      {
        $match: {
          "partyData.partyAccount": partyAccount,
          $or: [
            { companyId },
            { companyId: null }
          ]
        }
      },
      {
        $project: {
          outstanding: { $subtract: ["$netAmount", "$paidAmount"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$outstanding" } } },
    ]);

    if (saleOrderAgg.length > 0) {
      totalOutstanding += saleOrderAgg[0].total || 0;
    }

    return res.status(200).json({
      success: true,
      customer: {
        accountId: account.AccountId,
        name: account.Name,
      },
      balance: {
        outstanding: totalOutstanding,
        creditLimit: account.CreditLimit,
        availableCredit: Math.max(0, account.CreditLimit - totalOutstanding),
      },
    });
  } catch (error) {
    console.error("Get customer balance error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};
