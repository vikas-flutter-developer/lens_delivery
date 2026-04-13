import Account from "../models/Account.js";
import LensSale from "../models/LensSale.js";
import LensPurchase from "../models/LensPurchase.js";
import LensSaleChallan from "../models/LensSaleChallan.js";
import LensSaleOrder from "../models/LensSaleOrder.js";
import LensPurchaseChallan from "../models/LensPurchaseChallan.js";
import LensPurchaseOrder from "../models/LensPurchaseOrder.js";

/**
 * Outstanding Report Controller
 * 
 * This calculates aging buckets for receivables (debtors) and payables (creditors)
 * Aging Buckets: 1-30 days, 31-60 days, 61-90 days, above 90 days
 * 
 * Receivables: Outstanding from Sales (customers owe us)
 * Payables: Outstanding from Purchases (we owe vendors)
 */

// Helper to calculate days difference from today
const getDaysDifference = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const transDate = new Date(date);
    transDate.setHours(0, 0, 0, 0);
    const diffTime = today - transDate;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

// Categorize amount into aging bucket
const categorizeAging = (days, amount) => {
    if (days <= 30) return { bucket: "days1to30", amount };
    if (days <= 60) return { bucket: "days31to60", amount };
    if (days <= 90) return { bucket: "days61to90", amount };
    return { bucket: "above90Days", amount };
};

async function getOutstandingReport(req, res) {
    try {
        const { type, fromDate, stationName, groupName, search } = req.body || req.query;
        const companyId = req.user?.companyId;
        const companyFilter = {
            $or: [
                { companyId },
                { companyId: null }
            ]
        };

        // Type: "receivable" (what customers owe us - from sales)
        //       "payable" (what we owe vendors - from purchases)
        const isReceivable = type !== "payable";

        // Build match criteria for aggregation
        const matchCriteria = {};

        // Date filter - only consider transactions up to today
        if (fromDate) {
            const fromDateObj = new Date(fromDate);
            fromDateObj.setHours(0, 0, 0, 0);
            matchCriteria["billData.date"] = { $gte: fromDateObj, $lte: new Date() };
        }

        // Get all transactions with outstanding amounts
        let allTransactions = [];

        if (isReceivable) {
            // RECEIVABLES: Get from Sales, Sale Challans, Sale Orders

            // Sale Invoices with outstanding
            const sales = await LensSale.aggregate([
                { $match: companyFilter },
                {
                    $addFields: {
                        outstanding: { $subtract: [{ $ifNull: ["$netAmount", 0] }, { $ifNull: ["$paidAmount", 0] }] }
                    }
                },
                { $match: { outstanding: { $gt: 0 } } },
                {
                    $project: {
                        partyAccount: "$partyData.partyAccount",
                        date: "$billData.date",
                        outstanding: 1,
                        voucherNo: "$billData.invoiceNo",
                        transType: { $literal: "Sale Invoice" }
                    }
                }
            ]);

            // Sale Challans (not invoiced) with outstanding
            const saleChallans = await LensSaleChallan.aggregate([
                { $match: { ...companyFilter, isInvoiced: { $ne: true } } },
                {
                    $addFields: {
                        outstanding: { $subtract: [{ $ifNull: ["$netAmount", 0] }, { $ifNull: ["$paidAmount", 0] }] }
                    }
                },
                { $match: { outstanding: { $gt: 0 } } },
                {
                    $project: {
                        partyAccount: "$partyData.partyAccount",
                        date: "$billData.date",
                        outstanding: 1,
                        voucherNo: "$billData.challanNo",
                        transType: { $literal: "Sale Challan" }
                    }
                }
            ]);

            // Sale Orders with outstanding
            const saleOrders = await LensSaleOrder.aggregate([
                { $match: companyFilter },
                {
                    $addFields: {
                        outstanding: { $subtract: [{ $ifNull: ["$netAmount", 0] }, { $ifNull: ["$paidAmount", 0] }] }
                    }
                },
                { $match: { outstanding: { $gt: 0 } } },
                {
                    $project: {
                        partyAccount: "$partyData.partyAccount",
                        date: "$billData.date",
                        outstanding: 1,
                        voucherNo: "$billData.orderNo",
                        transType: { $literal: "Sale Order" }
                    }
                }
            ]);

            allTransactions = [...sales, ...saleChallans, ...saleOrders];
        } else {
            // PAYABLES: Get from Purchases, Purchase Challans, Purchase Orders

            // Purchase Invoices with outstanding
            const purchases = await LensPurchase.aggregate([
                { $match: companyFilter },
                {
                    $addFields: {
                        outstanding: { $subtract: [{ $ifNull: ["$netAmount", 0] }, { $ifNull: ["$paidAmount", 0] }] }
                    }
                },
                { $match: { outstanding: { $gt: 0 } } },
                {
                    $project: {
                        partyAccount: "$partyData.partyAccount",
                        date: "$billData.date",
                        outstanding: 1,
                        voucherNo: "$billData.invoiceNo",
                        transType: { $literal: "Purchase Invoice" }
                    }
                }
            ]);

            // Purchase Challans (not invoiced) with outstanding
            const purchaseChallans = await LensPurchaseChallan.aggregate([
                { $match: { ...companyFilter, isInvoiced: { $ne: true } } },
                {
                    $addFields: {
                        outstanding: { $subtract: [{ $ifNull: ["$netAmount", 0] }, { $ifNull: ["$paidAmount", 0] }] }
                    }
                },
                { $match: { outstanding: { $gt: 0 } } },
                {
                    $project: {
                        partyAccount: "$partyData.partyAccount",
                        date: "$billData.date",
                        outstanding: 1,
                        voucherNo: "$billData.challanNo",
                        transType: { $literal: "Purchase Challan" }
                    }
                }
            ]);

            // Purchase Orders with outstanding
            const purchaseOrders = await LensPurchaseOrder.aggregate([
                { $match: companyFilter },
                {
                    $addFields: {
                        outstanding: { $subtract: [{ $ifNull: ["$netAmount", 0] }, { $ifNull: ["$paidAmount", 0] }] }
                    }
                },
                { $match: { outstanding: { $gt: 0 } } },
                {
                    $project: {
                        partyAccount: "$partyData.partyAccount",
                        date: "$billData.date",
                        outstanding: 1,
                        voucherNo: "$billData.orderNo",
                        transType: { $literal: "Purchase Order" }
                    }
                }
            ]);

            allTransactions = [...purchases, ...purchaseChallans, ...purchaseOrders];
        }

        // Group transactions by party account
        const partyMap = new Map();

        for (const txn of allTransactions) {
            const partyName = txn.partyAccount;
            if (!partyName) continue;

            if (!partyMap.has(partyName)) {
                partyMap.set(partyName, {
                    partyAccount: partyName,
                    transactions: [],
                    days1to30: 0,
                    days31to60: 0,
                    days61to90: 0,
                    above90Days: 0,
                });
            }

            const party = partyMap.get(partyName);
            party.transactions.push(txn);

            // Calculate aging bucket
            if (txn.date && txn.outstanding > 0) {
                const days = getDaysDifference(txn.date);
                const aging = categorizeAging(days, txn.outstanding);

                switch (aging.bucket) {
                    case "days1to30":
                        party.days1to30 += aging.amount;
                        break;
                    case "days31to60":
                        party.days31to60 += aging.amount;
                        break;
                    case "days61to90":
                        party.days61to90 += aging.amount;
                        break;
                    case "above90Days":
                        party.above90Days += aging.amount;
                        break;
                }
            }
        }

        // Get account details for all parties
        const partyNames = Array.from(partyMap.keys());
        const accounts = await Account.find({ ...companyFilter, Name: { $in: partyNames } }).lean();
        const accountMap = new Map(accounts.map(a => [a.Name, a]));

        // Build results with account details
        let results = [];

        for (const [partyName, partyData] of partyMap.entries()) {
            const account = accountMap.get(partyName) || {};

            const totalOutstanding = partyData.days1to30 + partyData.days31to60 +
                partyData.days61to90 + partyData.above90Days;

            if (totalOutstanding <= 0) continue;

            // Apply filters
            if (stationName && (!account.Stations || !account.Stations.includes(stationName))) {
                continue;
            }
            if (groupName && (!account.Groups || !account.Groups.includes(groupName))) {
                continue;
            }
            if (search) {
                const searchLower = search.toLowerCase();
                const nameMatch = partyName.toLowerCase().includes(searchLower);
                const mobileMatch = (account.MobileNumber || "").toLowerCase().includes(searchLower);
                const addressMatch = (account.Address || "").toLowerCase().includes(searchLower);
                if (!nameMatch && !mobileMatch && !addressMatch) {
                    continue;
                }
            }

            results.push({
                _id: account._id || partyName,
                particular: partyName,
                contactNo: account.MobileNumber || account.TelNumber || "",
                address: account.Address || "",
                groupName: account.Groups?.join(", ") || "",
                state: account.State || "",
                days1to30: partyData.days1to30.toFixed(2),
                days31to60: partyData.days31to60.toFixed(2),
                days61to90: partyData.days61to90.toFixed(2),
                above90Days: partyData.above90Days.toFixed(2),
                totalOutstanding: totalOutstanding.toFixed(2),
                transactions: partyData.transactions,
            });
        }

        // Sort by total outstanding descending
        results.sort((a, b) => parseFloat(b.totalOutstanding) - parseFloat(a.totalOutstanding));

        res.status(200).json({
            success: true,
            count: results.length,
            data: results,
            summary: {
                totalAccounts: results.length,
                total1to30: results.reduce((sum, r) => sum + parseFloat(r.days1to30), 0).toFixed(2),
                total31to60: results.reduce((sum, r) => sum + parseFloat(r.days31to60), 0).toFixed(2),
                total61to90: results.reduce((sum, r) => sum + parseFloat(r.days61to90), 0).toFixed(2),
                totalAbove90: results.reduce((sum, r) => sum + parseFloat(r.above90Days), 0).toFixed(2),
                grandTotal: results.reduce((sum, r) => sum + parseFloat(r.totalOutstanding), 0).toFixed(2),
            },
        });
    } catch (err) {
        console.error("Outstanding report error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch outstanding report",
            error: err.message,
        });
    }
}

// Get all unique stations for dropdown
async function getStations(req, res) {
    try {
        const companyId = req.user?.companyId;
        const companyFilter = {
            $or: [
                { companyId },
                { companyId: null }
            ]
        };
        const stations = await Account.distinct("Stations", companyFilter);
        res.status(200).json({
            success: true,
            data: stations.filter(Boolean).sort(),
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch stations",
        });
    }
}

// Get all unique groups for dropdown
async function getGroups(req, res) {
    try {
        const companyId = req.user?.companyId;
        const companyFilter = {
            $or: [
                { companyId },
                { companyId: null }
            ]
        };
        const groups = await Account.distinct("Groups", companyFilter);
        res.status(200).json({
            success: true,
            data: groups.filter(Boolean).sort(),
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch groups",
        });
    }
}

export { getOutstandingReport, getStations, getGroups };
