import LensPurchase from "../models/LensPurchase.js";
import LensSale from "../models/LensSale.js";
import LensSaleOrder from "../models/LensSaleOrder.js";
import LensPurchaseChallan from "../models/LensPurchaseChallan.js";
import LensSaleChallan from "../models/LensSaleChallan.js";
import { purchaseLedgerAggregation, saleLedgerAggregation, saleOrderLedgerAggregation, purchaseChallanLedgerAggregation, saleChallanLedgerAggregation } from "../aggregations/ledger.aggregation.js"

/**
 * LEDGER ENTRY FLOW:
 * 
 * SALES FLOW:
 * 1. Challan created → "Sale Challan" entry appears (isInvoiced: false)
 * 2. Invoice created from challan → challan.isInvoiced set to true
 * 3. Ledger hides challan, shows "Sale" invoice instead
 * 4. Running balance transitions from challan → invoice (no gap)
 * 
 * PURCHASE FLOW:
 * 1. Challan created → "Purchase Challan" entry appears (isInvoiced: false)
 * 2. Invoice created from challan → challan.isInvoiced set to true
 * 3. Ledger hides challan, shows "Purchase" invoice instead
 * 4. Running balance transitions from challan → invoice (no gap)
 * 
 * KEY: Both challan and invoice use the same amounts, so balance never breaks.
 * When challan is marked isInvoiced=true, aggregation automatically filters it out
 * and shows only the corresponding invoice entry instead.
 */

// Helper to convert date string to Date object (start of day)
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

async function getAccountLedger(req, res) {
  try {
    // Accept parameters from request body (preferred for POST) or query (backwards compatible)
    const { partyAccount, fromDate, toDate } =
      (req.body && Object.keys(req.body).length) ? req.body : req.query;

    // Parse dates properly (start of day for fromDate, end of day for toDate)
    const fromDateObj = parseDate(fromDate, false);  // Start of day
    const toDateObj = parseDate(toDate, true);       // End of day

    // compute opening balance (sum of balanceImpact BEFORE fromDate)
    // Opening balance includes ALL transaction types: Purchases, Sales, Challans
    let openingBalance = 0;
    if (fromDateObj) {
      const matchBefore = Object.assign(
        {},
        partyAccount ? { "partyData.partyAccount": partyAccount } : {},
        { "billData.date": { $lt: fromDateObj } }
      );

      // Opening: Purchase transactions before fromDate
      const openingAggPurch = await LensPurchase.aggregate([
        { $match: matchBefore },
        {
          $project: {
            balanceImpact: { $subtract: ["$netAmount", "$paidAmount"] },
          },
        },
        { $group: { _id: null, opening: { $sum: "$balanceImpact" } } },
      ]);

      // Opening: Sale transactions before fromDate (Rule: subtract Debit + add Credit)
      const openingAggSale = await LensSale.aggregate([
        { $match: matchBefore },
        {
          $project: {
            balanceImpact: { $subtract: ["$paidAmount", "$netAmount"] },
          },
        },
        { $group: { _id: null, opening: { $sum: "$balanceImpact" } } },
      ]);

      // Opening: Purchase Challans (not invoiced) before fromDate
      const openingAggPurchChallan = await LensPurchaseChallan.aggregate([
        {
          $match: Object.assign(
            {},
            matchBefore,
            { isInvoiced: { $ne: true } }
          ),
        },
        {
          $project: {
            balanceImpact: { $subtract: ["$netAmount", "$paidAmount"] },
          },
        },
        { $group: { _id: null, opening: { $sum: "$balanceImpact" } } },
      ]);

      // Opening: Sale Challans (not invoiced) before fromDate
      const openingAggSaleChallan = await LensSaleChallan.aggregate([
        {
          $match: Object.assign(
            {},
            matchBefore,
            { isInvoiced: { $ne: true } }
          ),
        },
        {
          $project: {
            balanceImpact: { $subtract: ["$paidAmount", "$netAmount"] },
          },
        },
        { $group: { _id: null, opening: { $sum: "$balanceImpact" } } },
      ]);

      const opPurch = openingAggPurch?.[0]?.opening || 0;
      const opSale = openingAggSale?.[0]?.opening || 0;
      const opPurchChallan = openingAggPurchChallan?.[0]?.opening || 0;
      const opSaleChallan = openingAggSaleChallan?.[0]?.opening || 0;

      openingBalance = opPurch + opSale + opPurchChallan + opSaleChallan;
    }

    // fetch purchase and sale ledger rows within date range
    const purchaseRows = await LensPurchase.aggregate(
      purchaseLedgerAggregation({ partyAccount, fromDate: fromDateObj, toDate: toDateObj })
    );

    const saleRows = await LensSale.aggregate(
      saleLedgerAggregation({ partyAccount, fromDate: fromDateObj, toDate: toDateObj })
    );

    // include purchase challans (not yet invoiced)
    const purchaseChallanRows = await LensPurchaseChallan.aggregate(
      purchaseChallanLedgerAggregation({ partyAccount, fromDate: fromDateObj, toDate: toDateObj })
    );

    // include sale challans (not yet invoiced)
    const saleChallanRows = await LensSaleChallan.aggregate(
      saleChallanLedgerAggregation({ partyAccount, fromDate: fromDateObj, toDate: toDateObj })
    );

    // include sale orders as informational rows
    const saleOrderRows = await LensSaleOrder.aggregate(
      saleOrderLedgerAggregation({ partyAccount, fromDate: fromDateObj, toDate: toDateObj })
    );

    // combine and sort by date (and keep stable order)
    const ledgerData = [...purchaseRows, ...saleRows, ...purchaseChallanRows, ...saleChallanRows, ...saleOrderRows].sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningBalance = Number(openingBalance) || 0;
    const result = ledgerData.map((row, index) => {
      runningBalance += row.balanceImpact;

      return {
        sn: index + 1,
        sourceId: row._id,
        date: row.date,
        transType: row.transType,
        voucherNo: row.voucherNo,
        debit: row.debit,
        credit: row.credit,
        balance: runningBalance,
        shortNarr: row.shortNarr,
        remarks: row.remarks,
        settlementDate: row.settlementDate,
        items: row.items || [], // Include items from aggregation
      };
    });

    const closingBalance = runningBalance;

    // totals of actual transactions (not including opening balance)
    const totalDebit = result.reduce((s, r) => s + (Number(r.debit || 0)), 0);
    const totalCredit = result.reduce((s, r) => s + (Number(r.credit || 0)), 0);

    res.status(200).json({
      success: true,
      count: result.length,
      data: result,
      openingBalance,      // Opening balance before any transactions
      totalDebit,           // Total debits in date range
      totalCredit,          // Total credits in date range
      closingBalance,       // Final balance = openingBalance + sum(balanceImpact)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Ledger fetch failed",
    });
  }
};

async function reconcileLedgerTransactions(req, res) {
  try {
    const { transactions, settlementDate } = req.body;
    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ success: false, message: "Invalid transactions data" });
    }

    const date = settlementDate ? new Date(settlementDate) : null;

    for (const trans of transactions) {
      const { sourceId, transType } = trans;
      let Model;
      switch (transType) {
        case "Purchase": Model = LensPurchase; break;
        case "Sale": Model = LensSale; break;
        case "Sale Order": Model = LensSaleOrder; break;
        case "Purchase Challan": Model = LensPurchaseChallan; break;
        case "Sale Challan": Model = LensSaleChallan; break;
        default: continue;
      }
      if (Model && sourceId) {
        await Model.findByIdAndUpdate(sourceId, { settlementDate: date });
      }
    }

    res.status(200).json({ success: true, message: "Transactions reconciled successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Reconciliation failed" });
  }
}

export { getAccountLedger, reconcileLedgerTransactions };