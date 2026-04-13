export const purchaseLedgerAggregation = ({
  partyAccount,
  fromDate,
  toDate,
  companyFilter = {}
}) => [
    {
      $match: Object.assign(
        {},
        partyAccount ? { "partyData.partyAccount": partyAccount } : {},
        fromDate && toDate
          ? { "billData.date": { $gte: fromDate, $lte: toDate } }
          : fromDate
            ? { "billData.date": { $gte: fromDate } }
            : toDate
              ? { "billData.date": { $lte: toDate } }
              : {}
      ),
    },

    {
      $project: {
        date: "$billData.date",
        transType: { $literal: "Purchase" },
        voucherNo: {
          $concat: ["$billData.billSeries", "-", "$billData.billNo"],
        },
        // Purchases (party is supplier) are shown as Credit in a standard party ledger
        debit: "$paidAmount",
        credit: "$netAmount",
        // Rule: Balance = Prev + Credit - Debit
        balanceImpact: { $subtract: ["$netAmount", "$paidAmount"] },
        shortNarr: "$remark",
        remarks: "$status",
        settlementDate: "$settlementDate",
        items: {
          $map: {
            input: "$items",
            as: "item",
            in: {
              itemName: "$$item.itemName",
              sph: "$$item.sph",
              cyl: "$$item.cyl",
              eye: "$$item.eye",
              qty: "$$item.qty",
              price: "$$item.purchasePrice",
              amount: "$$item.totalAmount",
            },
          },
        },
      },
    },
    { $sort: { date: 1 } },
  ];

export const saleLedgerAggregation = ({
  partyAccount,
  fromDate,
  toDate,
  companyFilter = {}
}) => [
    {
      $match: Object.assign(
        {},
        partyAccount ? { "partyData.partyAccount": partyAccount } : {},
        fromDate && toDate
          ? { "billData.date": { $gte: fromDate, $lte: toDate } }
          : fromDate
            ? { "billData.date": { $gte: fromDate } }
            : toDate
              ? { "billData.date": { $lte: toDate } }
              : {}
      ),
    },

    {
      $project: {
        date: "$billData.date",
        transType: { $literal: "Sale" },
        voucherNo: {
          $concat: ["$billData.billSeries", "-", "$billData.billNo"],
        },
        debit: "$netAmount",
        credit: "$paidAmount",
        // Rule: Balance = Prev + Credit - Debit
        balanceImpact: {
          $subtract: ["$paidAmount", "$netAmount"],
        },
        shortNarr: "$remark",
        remarks: "$status",
        settlementDate: "$settlementDate",
        items: {
          $map: {
            input: "$items",
            as: "item",
            in: {
              itemName: "$$item.itemName",
              sph: "$$item.sph",
              cyl: "$$item.cyl",
              eye: "$$item.eye",
              qty: "$$item.qty",
              price: "$$item.salePrice",
              amount: "$$item.totalAmount",
            },
          },
        },
      },
    },
    { $sort: { date: 1 } },
  ];

export const saleOrderLedgerAggregation = ({
  partyAccount,
  fromDate,
  toDate,
  companyFilter = {}
}) => [
    {
      $match: Object.assign(
        {},
        partyAccount ? { "partyData.partyAccount": partyAccount } : {},
        fromDate && toDate
          ? { "billData.date": { $gte: fromDate, $lte: toDate } }
          : fromDate
            ? { "billData.date": { $gte: fromDate } }
            : toDate
              ? { "billData.date": { $lte: toDate } }
              : {}
      ),
    },

    {
      $project: {
        date: "$billData.date",
        transType: { $literal: "Sale Order" },
        voucherNo: {
          $concat: ["$billData.billSeries", "-", "$billData.billNo"],
        },
        // show amount but do not affect balance (informational)
        debit: "$netAmount",
        credit: { $literal: 0 },
        balanceImpact: { $literal: 0 },
        settlementDate: "$settlementDate",
        shortNarr: "$remark",
        remarks: "$status",
        items: {
          $map: {
            input: "$items",
            as: "item",
            in: {
              itemName: "$$item.itemName",
              sph: "$$item.sph",
              cyl: "$$item.cyl",
              eye: "$$item.eye",
              qty: "$$item.qty",
              price: "$$item.salePrice",
              amount: "$$item.totalAmount",
            },
          },
        },
      },
    },
    { $sort: { date: 1 } },
  ];

/**
 * Purchase Challan Ledger Aggregation
 * 
 * LOGIC:
 * - Challans appear in ledger with transType "Purchase Challan"
 * - Only non-invoiced challans are shown (isInvoiced !== true)
 * - When an invoice is created from a challan, challan.isInvoiced is set to true
 * - This automatically removes it from the ledger and shows the invoice instead
 * - Balance impact: netAmount (goods received on credit) - paidAmount (payment made)
 * 
 * ACCOUNTING:
 * - For supplier ledger (CR = we owe them):
 * - When goods received on credit: increases what we owe (balance increases)
 * - When payment made: decreases what we owe (balance decreases)
 * - Formula: netAmount - paidAmount = amount owed
 * 
 * FLOW:
 * 1. Challan created → appears as "Purchase Challan" in ledger (isInvoiced = false)
 * 2. Invoice created from challan → challan.isInvoiced = true, invoice appears as "Purchase" 
 * 3. Ledger automatically transitions challan entry to invoice entry
 */
export const purchaseChallanLedgerAggregation = ({
  partyAccount,
  fromDate,
  toDate,
  companyFilter = {}
}) => [
    {
      $match: Object.assign(
        {},
        partyAccount ? { "partyData.partyAccount": partyAccount } : {},
        fromDate && toDate
          ? { "billData.date": { $gte: fromDate, $lte: toDate } }
          : fromDate
            ? { "billData.date": { $gte: fromDate } }
            : toDate
              ? { "billData.date": { $lte: toDate } }
              : {},
        // Exclude challans that are already invoiced (isInvoiced = true)
        { isInvoiced: { $ne: true } }
      ),
    },

    {
      $project: {
        date: "$billData.date",
        transType: { $literal: "Purchase Challan" },
        voucherNo: {
          $concat: ["$billData.billSeries", "-", "$billData.billNo"],
        },
        // Challans show as Credit (similar to purchase)
        debit: "$paidAmount",
        credit: "$netAmount",
        // Rule: Balance = Prev + Credit - Debit
        balanceImpact: { $subtract: ["$netAmount", "$paidAmount"] },
        shortNarr: "$remark",
        remarks: "$status",
        settlementDate: "$settlementDate",
        items: {
          $map: {
            input: "$items",
            as: "item",
            in: {
              itemName: "$$item.itemName",
              sph: "$$item.sph",
              cyl: "$$item.cyl",
              eye: "$$item.eye",
              qty: "$$item.qty",
              price: "$$item.purchasePrice",
              amount: "$$item.totalAmount",
            },
          },
        },
      },
    },
    { $sort: { date: 1 } },
  ];

/**
 * Sale Challan Ledger Aggregation
 * 
 * LOGIC:
 * - Challans appear in ledger with transType "Sale Challan"
 * - Only non-invoiced challans are shown (isInvoiced !== true)
 * - When an invoice is created from a challan, challan.isInvoiced is set to true
 * - This automatically removes it from the ledger and shows the invoice instead
 * - Balance impact is the same as actual sales (netAmount - paidAmount)
 * 
 * FLOW:
 * 1. Challan created → appears as "Sale Challan" in ledger (isInvoiced = false)
 * 2. Invoice created from challan → challan.isInvoiced = true, invoice appears as "Sale"
 * 3. Ledger automatically transitions challan entry to invoice entry
 */
export const saleChallanLedgerAggregation = ({
  partyAccount,
  fromDate,
  toDate,
  companyFilter = {}
}) => [
    {
      $match: Object.assign(
        {},
        partyAccount ? { "partyData.partyAccount": partyAccount } : {},
        fromDate && toDate
          ? { "billData.date": { $gte: fromDate, $lte: toDate } }
          : fromDate
            ? { "billData.date": { $gte: fromDate } }
            : toDate
              ? { "billData.date": { $lte: toDate } }
              : {},
        // Exclude challans that are already invoiced (isInvoiced = true)
        { isInvoiced: { $ne: true } }
      ),
    },

    {
      $project: {
        date: "$billData.date",
        transType: { $literal: "Sale Challan" },
        voucherNo: {
          $concat: ["$billData.billSeries", "-", "$billData.billNo"],
        },
        debit: "$netAmount",
        credit: "$paidAmount",
        // Rule: Balance = Prev + Credit - Debit
        balanceImpact: {
          $subtract: ["$paidAmount", "$netAmount"],
        },
        shortNarr: "$remark",
        remarks: "$status",
        settlementDate: "$settlementDate",
        items: {
          $map: {
            input: "$items",
            as: "item",
            in: {
              itemName: "$$item.itemName",
              sph: "$$item.sph",
              cyl: "$$item.cyl",
              eye: "$$item.eye",
              qty: "$$item.qty",
              price: "$$item.salePrice",
              amount: "$$item.totalAmount",
            },
          },
        },
      },
    },
    { $sort: { date: 1 } },
  ];
