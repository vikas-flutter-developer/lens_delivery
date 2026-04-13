import LensGroup from "../models/LensGroup.js";
import LensSale from "../models/LensSale.js";
import LensSaleOrder from "../models/LensSaleOrder.js";
import LensPurchase from "../models/LensPurchase.js";
import LensPurchaseOrder from "../models/LensPurchaseOrder.js";
import LensSaleChallan from "../models/LensSaleChallan.js";
import LensPurchaseChallan from "../models/LensPurchaseChallan.js";
import SaleReturn from "../models/SaleReturn.js";
import PurchaseReturn from "../models/PurchaseReturn.js";
import RxSale from "../models/RxSale.js";
import RxPurchase from "../models/RxPurchase.js";
import RxSaleReturn from "../models/RxSaleReturn.js";
import RxPurchaseReturn from "../models/RxPurchaseReturn.js";
import RxSaleOrder from "../models/RxSaleOrder.js";
import RxPurchaseOrder from "../models/RxPurchaseOrder.js";
import ContactLensSaleOrder from "../models/ContactLensSaleOrder.js";
import ContactLensPurchaseOrder from "../models/ContactLensPurchaseOrder.js";
import ProductExchange from "../models/ProductExchange.js";
import DamageEntry from "../models/DamageEntry.js";
import Account from "../models/Account.js";
import AccountGroup from "../models/AccountGroup.js";
import Item from "../models/Item.js";
import SaleTarget from "../models/SaleTarget.js";
import CollectionTarget from "../models/CollectionTarget.js";
import Voucher from "../models/Voucher.model.js";
import mongoose from "mongoose";

export const getLensStockReport = async (req, res) => {
  try {
    const {
      groupName,
      productName,
      barcode,
      boxNo,
      powerGroups, // Array of { sphMin, sphMax, cylMin, cylMax, addMin, addMax, label }
      eye,
      showQty // 'All', 'Positive', 'Negative', 'Zero'
    } = req.body;

    const companyId = req.user?.companyId;

    let pipeline = [];

    // Filter LensGroups first if possible
    let matchConditions = [{ companyId: null }];
    if (companyId) {
      matchConditions.push({ companyId: new mongoose.Types.ObjectId(companyId) });
    }

    let lensGroupMatch = { $or: matchConditions };

    if (groupName) lensGroupMatch.groupName = { $regex: groupName, $options: 'i' };
    if (productName) lensGroupMatch.productName = { $regex: productName, $options: 'i' };

    pipeline.push({ $match: lensGroupMatch });

    // Unwind addGroups and combinations
    pipeline.push({ $unwind: "$addGroups" });
    pipeline.push({ $unwind: "$addGroups.combinations" });

    // Project fields to flatten the structure
    pipeline.push({
      $project: {
        _id: 0,
        lensGroupId: "$_id",
        groupName: 1,
        productName: 1,
        addValue: "$addGroups.addValue",
        sph: "$addGroups.combinations.sph",
        cyl: "$addGroups.combinations.cyl",
        axis: "$addGroups.combinations.axis",
        eye: "$addGroups.combinations.eye",
        barcode: "$addGroups.combinations.barcode",
        boxNo: "$addGroups.combinations.boxNo",
        alertQty: "$addGroups.combinations.alertQty",
        pPrice: { $ifNull: ["$addGroups.combinations.pPrice", "$purchasePrice"] },
        sPrice: { $ifNull: ["$addGroups.combinations.sPrice", "$salePrice.default"] },
        initStock: "$addGroups.combinations.initStock",
        totalSoldQty: "$addGroups.combinations.totalSoldQty",
        currentStock: { $subtract: ["$addGroups.combinations.initStock", "$addGroups.combinations.totalSoldQty"] },
        isVerified: { $ifNull: ["$addGroups.combinations.isVerified", false] },
        lastVerifiedDate: "$addGroups.combinations.lastVerifiedDate",
        verifiedQty: "$addGroups.combinations.verifiedQty"
      }
    });

    // Build combination-level match using $and
    let andConditions = [];

    // Barcode / BoxNo filters
    if (barcode) andConditions.push({ barcode: { $regex: barcode, $options: 'i' } });
    if (boxNo) andConditions.push({ boxNo: { $regex: boxNo, $options: 'i' } });

    // Eye filter
    if (eye && eye !== 'All') andConditions.push({ eye });

    // Show Qty filter
    if (showQty === 'Positive') andConditions.push({ currentStock: { $gt: 0 } });
    else if (showQty === 'Negative') andConditions.push({ currentStock: { $lt: 0 } });
    else if (showQty === 'Zero') andConditions.push({ currentStock: 0 });

    // Power Groups filter — each group defines a range; row must match at least one
    if (powerGroups && Array.isArray(powerGroups) && powerGroups.length > 0) {
      const pgConditions = powerGroups.map(pg => {
        const cond = {};
        const sphMin = parseFloat(pg.sphMin);
        const sphMax = parseFloat(pg.sphMax);
        const cylMin = parseFloat(pg.cylMin);
        const cylMax = parseFloat(pg.cylMax);
        const addMin = parseFloat(pg.addMin);
        const addMax = parseFloat(pg.addMax);

        if (!isNaN(sphMin) && !isNaN(sphMax)) cond.sph = { $gte: sphMin, $lte: sphMax };
        if (!isNaN(cylMin) && !isNaN(cylMax)) cond.cyl = { $gte: cylMin, $lte: cylMax };
        if (!isNaN(addMin) && !isNaN(addMax)) cond.addValue = { $gte: addMin, $lte: addMax };

        return cond;
      });
      andConditions.push({ $or: pgConditions });
    }

    if (andConditions.length > 0) {
      pipeline.push({ $match: andConditions.length === 1 ? andConditions[0] : { $and: andConditions } });
    }

    const reportData = await LensGroup.aggregate(pipeline);

    res.status(200).json({ success: true, data: reportData });
  } catch (error) {
    console.error("Error generating lens stock report:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getItemStockSummaryReport = async (req, res) => {
  try {
    const { groupName, productName, stockStatus } = req.body;
    const companyId = req.user?.companyId;

    let pipeline = [];

    // Match filters at group level
    let groupMatch = {};
    // Add companyId filter if present (bringing it inline with other reports)
    if (companyId) groupMatch.companyId = new mongoose.Types.ObjectId(companyId);
    else groupMatch.$or = [{ companyId: null }, { companyId: { $exists: false } }];
    
    if (groupName) groupMatch.groupName = { $regex: groupName, $options: 'i' };
    if (productName) groupMatch.productName = { $regex: productName, $options: 'i' };
    if (Object.keys(groupMatch).length > 0) {
      pipeline.push({ $match: groupMatch });
    }

    // Unwind addGroups and combinations
    pipeline.push({ $unwind: "$addGroups" });
    pipeline.push({ $unwind: "$addGroups.combinations" });

    // Project combination-level fields
    pipeline.push({
      $project: {
        productName: 1,
        groupName: 1,
        pPrice: { $ifNull: ["$addGroups.combinations.pPrice", "$purchasePrice", 0] },
        sPrice: { $ifNull: ["$addGroups.combinations.sPrice", "$salePrice.default", 0] },
        currentStock: {
          $subtract: [
            { $ifNull: ["$addGroups.combinations.initStock", 0] },
            { $ifNull: ["$addGroups.combinations.totalSoldQty", 0] }
          ]
        }
      }
    });

    // Group by productName to get item-level summary
    pipeline.push({
      $group: {
        _id: { productName: "$productName", groupName: "$groupName" },
        totalStockQty: { $sum: "$currentStock" },
        totalPurchaseValue: {
          $sum: { $multiply: ["$currentStock", "$pPrice"] }
        },
        totalSellingValue: {
          $sum: { $multiply: ["$currentStock", "$sPrice"] }
        },
        combinationCount: { $sum: 1 },
        avgPurchasePrice: { $avg: "$pPrice" },
        avgSellingPrice: { $avg: "$sPrice" }
      }
    });

    // Reshape output
    pipeline.push({
      $project: {
        _id: 0,
        productName: "$_id.productName",
        groupName: "$_id.groupName",
        totalStockQty: 1,
        totalPurchaseValue: { $round: ["$totalPurchaseValue", 2] },
        totalSellingValue: { $round: ["$totalSellingValue", 2] },
        expectedProfit: { $round: [{ $subtract: ["$totalSellingValue", "$totalPurchaseValue"] }, 2] },
        combinationCount: 1,
        avgPurchasePrice: { $round: ["$avgPurchasePrice", 2] },
        avgSellingPrice: { $round: ["$avgSellingPrice", 2] }
      }
    });

    // Sort by productName
    pipeline.push({ $sort: { productName: 1 } });

    let data = await LensGroup.aggregate(pipeline);

    // Apply stockStatus filter in memory (needs totalStockQty calculated first)
    if (stockStatus && stockStatus !== 'All') {
      data = data.filter(item => {
        if (stockStatus === 'Low') return item.totalStockQty > 0 && item.totalStockQty <= 10;
        if (stockStatus === 'Medium') return item.totalStockQty > 10 && item.totalStockQty <= 50;
        if (stockStatus === 'High') return item.totalStockQty > 50;
        if (stockStatus === 'Zero') return item.totalStockQty === 0;
        if (stockStatus === 'Negative') return item.totalStockQty < 0;
        return true;
      });
    }

    // Now calculate Live Profit from actual transactions
    // Fetch data from: Sale Orders / Sale Challans / Invoice tables
    const liveProfitMatch = { status: { $ne: "Cancelled" }, ...groupMatch };
    if (liveProfitMatch.$or) delete liveProfitMatch.$or; // Simplify for these collections if needed, though they also have companyId
    
    // Better safely re-apply companyFilter to liveProfitMatch
    let saleCompanyFilter = { status: { $ne: "Cancelled" } };
    if (companyId) {
      saleCompanyFilter.companyId = new mongoose.Types.ObjectId(companyId);
    } else {
      saleCompanyFilter.$or = [{ companyId: null }, { companyId: { $exists: false } }];
    }

    const liveProfitPipeline = [
      { $match: saleCompanyFilter },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.itemName",
          liveProfit: {
            $sum: {
              $subtract: [
                { $ifNull: ["$items.totalAmount", 0] },
                { 
                  $ifNull: [ 
                    { $multiply: [{ $ifNull: ["$items.purchasePrice", 0] }, { $ifNull: ["$items.qty", 0] }] }, 
                    0 
                  ] 
                }
              ]
            }
          }
        }
      }
    ];

    const [salesProfit, ordersProfit, challansProfit] = await Promise.all([
      LensSale.aggregate(liveProfitPipeline),
      LensSaleOrder.aggregate(liveProfitPipeline),
      LensSaleChallan.aggregate(liveProfitPipeline)
    ]);

    const liveProfitMap = {};
    const mergeProfits = (results) => {
      results.forEach((r) => {
        if (r._id) {
          liveProfitMap[r._id] = (liveProfitMap[r._id] || 0) + r.liveProfit;
        }
      });
    };
    mergeProfits(salesProfit);
    mergeProfits(ordersProfit);
    mergeProfits(challansProfit);

    // Inject liveProfit into the final data array
    data = data.map(item => ({
      ...item,
      liveProfit: liveProfitMap[item.productName] || 0
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error generating item stock summary report:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

import LensLocationStock from "../models/LensLocationStock.js";

// Party Wise Item Report
export const getPartyWiseItemReport = async (req, res) => {
  try {
    const {
      dateFrom,
      dateTo,
      transType,
      groupName,
      customerName,
      searchText,
    } = req.body;

    const companyId = req.user?.companyId;

    // Use a very permissive default range if missing
    const startDate = dateFrom ? new Date(dateFrom) : new Date('2000-01-01');
    const endDate = dateTo ? new Date(dateTo) : new Date();
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
       // Optional: Log error or handle invalid dates
    }
    endDate.setHours(23, 59, 59, 999);

    const companyFilter = {
      $or: [
        { companyId },
        { companyId: null }
      ]
    };

    // Generic date filter that works for models with billData.date or just date
    const dateCriteria = { $gte: startDate, $lte: endDate };
    const dateFilter = {
      $or: [
        { 'billData.date': dateCriteria },
        { 'date': dateCriteria }
      ]
    };

    // Add party filter if customerName provided
    const partyFilter = customerName ? { 'partyData.partyAccount': { $regex: customerName, $options: 'i' } } : {};

    let allItems = [];

    // Helper function to process results from a model
    const processModelResults = (results, transactionType, seriesPrefix) => {
      if (!Array.isArray(results)) return;

      results.forEach(doc => {
        let items = [];
        let itemTransType = transactionType;
        if (transactionType === 'Product Exchange') {
          items = [
            ...(doc.exchangeOutItems || []).map(it => ({ ...it, itemName: it.itemName, exchangeType: '(Out)' })),
            ...(doc.exchangeInItems || []).map(it => ({ ...it, itemName: it.itemName, exchangeType: '(In)' }))
          ];
        } else if (transactionType === 'Damage' || transactionType === 'Shrinkage' || transactionType === 'Damage & Shrinkage') {
          // No filtering by doc.type if it's Damage & Shrinkage combined
          if (transactionType !== 'Damage & Shrinkage' && doc.type !== transactionType) return;
          items = doc.items || [];
          // Use the specific type for individual item display in the report
          itemTransType = doc.type || transactionType;
        } else {
          items = doc.items || [];
        }

        if (!Array.isArray(items)) return;

        items.forEach((item, idx) => {
          let itemTransTypeLocal = itemTransType || transactionType;
          // Apply search text filter
          if (searchText) {
            const searchLower = searchText.toLowerCase();
            const matchesSearch =
              (item.itemName && String(item.itemName).toLowerCase().includes(searchLower)) ||
              (item.barcode && String(item.barcode).toLowerCase().includes(searchLower)) ||
              (item.code && String(item.code).toLowerCase().includes(searchLower)) ||
              (doc.partyData?.partyAccount && String(doc.partyData.partyAccount).toLowerCase().includes(searchLower));
            if (!matchesSearch) return;
          }

          // Apply group filter
          if (groupName) {
            // Future: filter by LensGroup groupName if needed
          }

          allItems.push({
             transType: itemTransTypeLocal,
             vchSeries: doc.billData?.billSeries || doc.billSeries || seriesPrefix,
             bookedBy: doc.billData?.bookedBy || '',
             vchNo: doc.billData?.billNo || doc.billNo || doc._id?.toString().slice(-6) || '',
             vchDate: doc.billData?.date || doc.date || doc.createdAt,
             partyName: doc.partyData?.partyAccount || '',
             mobNo: doc.partyData?.contactNumber || '',
             barcode: item.barcode || item.code || '',
             productName: item.itemName || '', // Keep original for lookup
             exchangeType: item.exchangeType || '', // Store separately
             dia: item.dia || '',
             eye: item.eye || '',
             sph: item.sph || 0,
             cyl: item.cyl || 0,
             axis: item.axis || 0,
             add: item.add || 0,
             qty: item.qty || 0,
             pricePerUnit: item.sellPrice || item.salePrice || item.purchasePrice || item.price || 0,
             totalPrice: item.totalAmount || item.totalAmt || (item.qty * (item.sellPrice || item.salePrice || item.purchasePrice || item.price || 0)),
             purchasePrice: item.purchasePrice || 0,
             combinationId: item.combinationId || '',
             remark: doc.remark || doc.remarks || '',
             docId: doc._id,
          });
        });
      });
    };

    // Transaction type mapping (values can be objects or arrays of objects)
    const transactionModels = {
      'Sale': { model: LensSale, type: 'Sale Invoice', prefix: 'SI' },
      'Sale Order': { model: LensSaleOrder, type: 'Sale Order', prefix: 'SO' },
      'Sale Challan': { model: LensSaleChallan, type: 'Sale Challan', prefix: 'SC' },
      'Sale Return': { model: SaleReturn, type: 'Sale Return', prefix: 'SR' },
      'Purchase': { model: LensPurchase, type: 'Purchase Invoice', prefix: 'PI' },
      'Purchase Order': { model: LensPurchaseOrder, type: 'Purchase Order', prefix: 'PO' },
      'Purchase Challan': { model: LensPurchaseChallan, type: 'Purchase Challan', prefix: 'PC' },
      'Purchase Return': { model: PurchaseReturn, type: 'Purchase Return', prefix: 'PR' },
      'Rx Sale Order': { model: RxSaleOrder, type: 'Rx Sale Order', prefix: 'RSO' },
      'Rx Purchase Order': { model: RxPurchaseOrder, type: 'Rx Purchase Order', prefix: 'RPO' },
      'Contact Lens & Sol Sale Order': { model: ContactLensSaleOrder, type: 'Contact Lens & Sol Sale Order', prefix: 'CLSO' },
      'Contact Lens & Sol Purchase Order': { model: ContactLensPurchaseOrder, type: 'Contact Lens & Sol Purchase Order', prefix: 'CLPO' },
      'Product Exchange': { model: ProductExchange, type: 'Product Exchange', prefix: 'EXCH' },
      'Damage & Shrinkage': { model: DamageEntry, type: 'Damage & Shrinkage', prefix: 'DMG/SHR' },
      'Damage': { model: DamageEntry, type: 'Damage', prefix: 'DMG' },
      'Shrinkage': { model: DamageEntry, type: 'Shrinkage', prefix: 'SHR' },
      'Cancelled': [
        { model: LensSaleOrder, type: 'Cancelled Sale Order', prefix: 'SO', extraFilter: { status: 'Cancelled' } },
        { model: LensPurchaseOrder, type: 'Cancelled Purchase Order', prefix: 'PO', extraFilter: { status: 'Cancelled' } },
        { model: RxSaleOrder, type: 'Cancelled Rx Sale Order', prefix: 'RSO', extraFilter: { status: 'Cancelled' } },
        { model: RxPurchaseOrder, type: 'Cancelled Rx Purchase Order', prefix: 'RPO', extraFilter: { status: 'Cancelled' } },
        { model: ContactLensSaleOrder, type: 'Cancelled CL Sale Order', prefix: 'CLSO', extraFilter: { status: 'Cancelled' } },
        { model: ContactLensPurchaseOrder, type: 'Cancelled CL Purchase Order', prefix: 'CLPO', extraFilter: { status: 'Cancelled' } },
        { model: LensSale, type: 'Cancelled Sale Invoice', prefix: 'SI', extraFilter: { status: 'Cancelled' } },
        { model: LensPurchase, type: 'Cancelled Purchase Invoice', prefix: 'PI', extraFilter: { status: 'Cancelled' } },
        { model: RxSale, type: 'Cancelled Rx Sale', prefix: 'RXS', extraFilter: { status: 'Cancelled' } },
        { model: RxPurchase, type: 'Cancelled Rx Purchase', prefix: 'RXP', extraFilter: { status: 'Cancelled' } },
        { model: LensSaleChallan, type: 'Cancelled Sale Challan', prefix: 'SC', extraFilter: { status: 'Cancelled' } },
        { model: LensPurchaseChallan, type: 'Cancelled Purchase Challan', prefix: 'PC', extraFilter: { status: 'Cancelled' } },
      ]
    };

    // Determine which models to query
    let modelsToQuery = [];
    if (transType) {
      if (Array.isArray(transType)) {
        if (transType.includes('All')) {
          modelsToQuery = Object.values(transactionModels).flat();
        } else {
          transType.forEach(type => {
            const config = transactionModels[type];
            if (config) {
               if (Array.isArray(config)) modelsToQuery.push(...config);
               else modelsToQuery.push(config);
            }
          });
        }
      } else if (transType !== 'All') {
        const config = transactionModels[transType];
        if (config) {
          if (Array.isArray(config)) modelsToQuery = config;
          else modelsToQuery = [config];
        }
      } else {
        modelsToQuery = Object.values(transactionModels).flat();
      }
    } else {
      // Default to All if no transType provided
      modelsToQuery = Object.values(transactionModels).flat();
    }

    // Query each model
    for (const modelConfig of modelsToQuery) {
      if (!modelConfig || !modelConfig.model) continue;

      try {
        const results = await modelConfig.model.find({
          ...dateFilter,
          ...partyFilter,
          ...companyFilter,
          ...(modelConfig.extraFilter || {})
        }).lean();

        processModelResults(results, modelConfig.type, modelConfig.prefix);
      } catch (modelError) {
        console.error(`Error querying ${modelConfig.type}:`, modelError);
      }
    }

    // Sort by date (newest first)
    allItems.sort((a, b) => {
      const dateB = b.vchDate ? new Date(b.vchDate).getTime() : 0;
      const dateA = a.vchDate ? new Date(a.vchDate).getTime() : 0;
      return dateB - dateA;
    });

    // --- Start Location Lookup Logic ---
    const productNames = [...new Set(allItems.map(i => i.productName).filter(Boolean))];
    const items = await Item.find({ itemName: { $in: productNames }, ...companyFilter }).select('_id itemName').lean();
    const nameToId = {};
    items.forEach(it => nameToId[it.itemName] = it._id.toString());
    const itemIds = items.map(it => it._id);

    const locations = await LensLocationStock.find({
      item_id: { $in: itemIds },
      ...companyFilter
    }).lean();

    const locMap = {};
    locations.forEach(l => {
      const key = `${l.item_id}_${l.sph}_${l.cyl}_${l.add_power}`;
      if (!locMap[key]) locMap[key] = [];
      const locStr = [l.godown, l.rack_no, l.box_no].filter(Boolean).join('/');
      if (locStr && !locMap[key].includes(locStr)) {
        locMap[key].push(locStr);
      }
    });
    // --- End Location Lookup Logic ---

    // Format dates for response and attach locations
    allItems = allItems.map((item, index) => {
      const itemId = nameToId[item.productName];
      let loc = '-';
      if (itemId) {
        const key = `${itemId}_${item.sph || 0}_${item.cyl || 0}_${item.add || 0}`;
        if (locMap[key] && locMap[key].length > 0) {
          loc = locMap[key].join(', ');
        }
      }

      return {
        ...item,
        productName: item.productName + (item.exchangeType ? ` ${item.exchangeType}` : ''),
        loc,
        sNo: index + 1,
        vchDate: item.vchDate ? new Date(item.vchDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : '',
      };
    });

    res.status(200).json({ success: true, data: allItems });
  } catch (error) {
    console.error("Error generating party wise item report:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Lens Movement Report
export const getLensMovementReport = async (req, res) => {
  console.log("REPORTS: Lens Movement Report request received", req.body);
  try {
    const {
      dateFrom,
      dateTo,
      groupName,
      productName,
      barcode,
      partyName,
      searchType, // 'All I/O Movement' etc (currently treated as all)
      eye,
      sph,
      cyl,
      axis,
      add
    } = req.body;

    const companyId = req.user?.companyId;
    const companyFilter = {
      $or: [
        { companyId },
        { companyId: null }
      ]
    };

    const bCode = barcode?.trim();
    const pName = productName?.trim();
    const gName = groupName?.trim();
    const accName = partyName?.trim();

    const startDate = dateFrom ? new Date(dateFrom) : new Date('2000-01-01');
    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    let purchaseData = [];
    let saleData = [];
    let openingStock = 0;

    const transactionModels = {
      purchase: [
        { model: LensPurchase, type: 'Purchase Invoice', prefix: 'PI', isInward: true },
      ],
      sale: [
        { model: LensSale, type: 'Sale Invoice', prefix: 'SI', isInward: false },
      ]
    };

    // Pre-fetch barcode map from LensGroups to handle missing barcodes in transactions
    // Pre-fetch barcode maps from LensGroups to handle missing barcodes
    const barcodeMap = new Map();
    const attributeMap = new Map(); // Key: "productName|sph|cyl|add|eye" -> barcode
    const productToGroupMap = new Map();
    const barcodeToGroupMap = new Map();

    try {
      // Fetch needed fields: product name for the attribute map, and the nested combinations
      const allGroups = await LensGroup.find(companyFilter, {
        groupName: 1,
        productName: 1,
        'addGroups.addValue': 1,
        'addGroups.combinations': 1
      }).lean();

      allGroups.forEach(g => {
        const pNameNormalized = String(g.productName || '').trim().toLowerCase();
        productToGroupMap.set(pNameNormalized, g.groupName);
        if (g.addGroups) {
          g.addGroups.forEach(ag => {
            const addVal = parseFloat(ag.addValue) || 0;
            if (ag.combinations) {
              ag.combinations.forEach(c => {
                // Populate ID map
                if (c._id && c.barcode) {
                  barcodeMap.set(String(c._id), c.barcode);
                  barcodeToGroupMap.set(String(c.barcode), g.groupName);
                }

                // Populate Attribute map
                if (c.barcode) {
                  const sph = parseFloat(c.sph) || 0;
                  const cyl = parseFloat(c.cyl) || 0;
                  const eye = String(c.eye || '').trim().toLowerCase();
                  // Key format: name|sph|cyl|add|eye
                  const key = `${pName}|${sph}|${cyl}|${addVal}|${eye}`;
                  attributeMap.set(key, c.barcode);
                }
              });
            }
          });
        }
      });
    } catch (err) {
      console.error("Error building barcode maps:", err);
    }

    const processResults = (results, config, targetArray, isOpeningCalc = false) => {
      results.forEach(doc => {
        if (!doc || !doc.items) return;
        doc.items.forEach(item => {
          // Resolve effective barcode
          let effectiveBarcode = item.barcode || item.barCode || item.barcodeNumber || '';

          // Fallback to lookup if missing and combinationId exists
          if (!effectiveBarcode && item.combinationId) {
            effectiveBarcode = barcodeMap.get(String(item.combinationId)) || '';
          }

          // Secondary fallback: lookup by attributes
          if (!effectiveBarcode) {
            const pName = String(item.itemName || '').trim().toLowerCase();
            const sph = parseFloat(item.sph) || 0;
            const cyl = parseFloat(item.cyl) || 0;
            const addVal = parseFloat(item.add) || 0;
            const eye = String(item.eye || '').trim().toLowerCase();
            const key = `${pName}|${sph}|${cyl}|${addVal}|${eye}`;
            effectiveBarcode = attributeMap.get(key) || '';
          }

          // Filter by item/group/barcode
          if (pName && !String(item.itemName).toLowerCase().includes(pName.toLowerCase())) return;
          if (bCode && !String(effectiveBarcode).toLowerCase().includes(bCode.toLowerCase())) return;
          // partyName filter
          if (accName && !String(doc.partyData?.partyAccount).toLowerCase().includes(accName.toLowerCase())) return;

          // Lens Parameter Filters
          if (eye && String(item.eye || '').toLowerCase() !== String(eye).toLowerCase()) return;
          if (sph && parseFloat(item.sph) !== parseFloat(sph)) return;
          if (cyl && parseFloat(item.cyl) !== parseFloat(cyl)) return;
          if (axis && parseFloat(item.axis) !== parseFloat(axis)) return;
          if (add && parseFloat(item.add) !== parseFloat(add)) return;

          const qty = Number(item.qty) || 0;
          if (isOpeningCalc) {
            openingStock += config.isInward ? qty : -qty;
          } else {
            targetArray.push({
              date: doc.billData?.date || doc.createdAt,
              transType: config.type,
              voucherNo: doc.billData?.billNo || doc._id?.toString().slice(-6),
              partyName: doc.partyData?.partyAccount || 'CASH SALES',
              groupName: item.groupName || item.group || productToGroupMap.get(String(item.itemName || '').trim().toLowerCase()) || barcodeToGroupMap.get(String(effectiveBarcode)) || '',
              itemName: item.itemName || '',
              barcode: effectiveBarcode,
              unit: item.unit || 'PCS-PIECES',
              quantity: config.isInward ? qty : -qty,
              price: item.purchasePrice || item.salePrice || item.sellPrice || 0,
              docId: doc._id,
              combinationId: item.combinationId || '',
              eye: item.eye || '',
              sph: item.sph || '',
              cyl: item.cyl || '',
              axis: item.axis || '',
              add: item.add || ''
            });
          }
        });
      });
    };

    // Build DB Query based on filters
    const buildQuery = (dateQuery) => {
      const q = { ...dateQuery };
      if (bCode) {
        q['$or'] = [
          { 'items.barcode': { $regex: bCode, $options: 'i' } },
          { 'items.barCode': { $regex: bCode, $options: 'i' } },
          { 'items.barcodeNumber': { $regex: bCode, $options: 'i' } }
        ];
      }
      if (pName) q['items.itemName'] = { $regex: pName, $options: 'i' };
      if (accName) q['partyData.partyAccount'] = { $regex: accName, $options: 'i' };

      // Apply multi-tenancy filter
      return {
        $and: [
          q,
          companyFilter
        ]
      };
    };

    // 1. Calculate Opening Stock
    const allConfigs = [...transactionModels.purchase, ...transactionModels.sale];
    for (const config of allConfigs) {
      const results = await config.model.find(buildQuery({ 'billData.date': { $lt: startDate } })).lean();
      processResults(results, config, [], true);
    }

    // 2. Fetch Period Data
    for (const config of transactionModels.purchase) {
      const results = await config.model.find(buildQuery({ 'billData.date': { $gte: startDate, $lte: endDate } })).lean();
      processResults(results, config, purchaseData);
    }

    for (const config of transactionModels.sale) {
      const results = await config.model.find(buildQuery({ 'billData.date': { $gte: startDate, $lte: endDate } })).lean();
      processResults(results, config, saleData);
    }

    // Sort by date
    purchaseData.sort((a, b) => new Date(a.date) - new Date(b.date));
    saleData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate Closing Stock
    const periodInward = purchaseData.reduce((sum, item) => sum + (item.quantity > 0 ? item.quantity : 0), 0) +
      saleData.reduce((sum, item) => sum + (item.quantity > 0 ? item.quantity : 0), 0);
    const periodOutward = purchaseData.reduce((sum, item) => sum + (item.quantity < 0 ? -item.quantity : 0), 0) +
      saleData.reduce((sum, item) => sum + (item.quantity < 0 ? -item.quantity : 0), 0);

    const closingStock = openingStock + periodInward - periodOutward;

    // Handle Item Unmovement
    if (searchType === 'Item Unmovement') {
      // Collect barcodes that had movement in this period
      const movedBarcodes = new Set([
        ...purchaseData.map(d => d.barcode),
        ...saleData.map(d => d.barcode)
      ]);

      // Fetch all lens products and their combinations
      const allLensGroups = await LensGroup.find(companyFilter).lean();
      const unmovedItems = [];

      allLensGroups.forEach(group => {
        // Filter by groupName and productName if provided
        if (groupName && !String(group.groupName).toLowerCase().includes(groupName.toLowerCase())) return;
        if (productName && !String(group.productName).toLowerCase().includes(productName.toLowerCase())) return;

        (group.addGroups || []).forEach(ag => {
          (ag.combinations || []).forEach(combo => {
            if (movedBarcodes.has(combo.barcode)) return;
            if (barcode && !String(combo.barcode).toLowerCase().includes(barcode.toLowerCase())) return;

            // Lens Parameter Filters for Unmovement
            if (eye && String(combo.eye || '').toLowerCase() !== String(eye).toLowerCase()) return;
            if (sph && parseFloat(combo.sph) !== parseFloat(sph)) return;
            if (cyl && parseFloat(combo.cyl) !== parseFloat(cyl)) return;
            if (axis && parseFloat(combo.axis) !== parseFloat(axis)) return;
            if (add && parseFloat(ag.addValue) !== parseFloat(add)) return;

            unmovedItems.push({
              date: '-',
              transType: 'No Movement',
              voucherNo: '-',
              partyName: '-',
              groupName: group.groupName || '',
              itemName: group.productName || '',
              barcode: combo.barcode || combo.barCode || '',
              eye: combo.eye || '',
              sph: (combo.sph !== undefined && combo.sph !== null) ? combo.sph : '',
              cyl: (combo.cyl !== undefined && combo.cyl !== null) ? combo.cyl : '',
              axis: (combo.axis !== undefined && combo.axis !== null) ? combo.axis : '',
              add: (ag.addValue !== undefined && ag.addValue !== null) ? ag.addValue : '',
              currentStock: (Number(combo.initStock) || 0) - (Number(combo.totalSoldQty) || 0),
              unit: 'PCS-PIECES',
              quantity: 0,
              price: combo.sPrice || group.salePrice?.default || 0,
              docId: null
            });
          });
        });
      });

      return res.status(200).json({
        success: true,
        data: {
          purchaseData: [],
          saleData: [],
          unmovedItems,
          openingStock,
          closingStock: openingStock
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        purchaseData,
        saleData,
        openingStock,
        closingStock
      }
    });
  } catch (error) {
    console.error("Error generating lens movement report:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getDayBookReport = async (req, res) => {
  try {
    const { firmName, dateFrom, dateTo } = req.body;
    const companyId = req.user?.companyId;
    const companyFilter = {
      $or: [
        { companyId },
        { companyId: null }
      ]
    };

    // Parse dates
    const startDate = dateFrom ? new Date(dateFrom) : new Date('2000-01-01');
    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const transactions = [];

    // Define all transaction models with their configurations
    const transactionModels = [
      // Purchase transactions
      {
        model: LensPurchase,
        type: 'Purchase Invoice',
        isDebit: true,
        dateField: 'billData.date',
        vchField: 'billData.billNo',
        accountField: 'partyData.partyAccount',
        amountField: 'netAmount'
      },
      {
        model: LensPurchaseOrder,
        type: 'Purchase Order',
        isDebit: true,
        dateField: 'billData.date',
        vchField: 'billData.billNo',
        accountField: 'partyData.partyAccount',
        amountField: 'netAmount'
      },
      {
        model: LensPurchaseChallan,
        type: 'Purchase Challan',
        isDebit: true,
        dateField: 'billData.date',
        vchField: 'billData.billNo',
        accountField: 'partyData.partyAccount',
        amountField: 'netAmount'
      },
      {
        model: PurchaseReturn,
        type: 'Purchase Return',
        isDebit: false,
        dateField: 'billData.date',
        vchField: 'billData.billNo',
        accountField: 'partyData.partyAccount',
        amountField: 'netAmount'
      },
      {
        model: RxPurchase,
        type: 'Rx Purchase',
        isDebit: true,
        dateField: 'billData.date',
        vchField: 'billData.billNo',
        accountField: 'partyData.partyAccount',
        amountField: 'netAmount'
      },
      {
        model: RxPurchaseReturn,
        type: 'Rx Purchase Return',
        isDebit: false,
        dateField: 'billData.date',
        vchField: 'billData.billNo',
        accountField: 'partyData.partyAccount',
        amountField: 'netAmount'
      },
      // Sale transactions
      {
        model: LensSale,
        type: 'Sale Invoice',
        isDebit: false,
        dateField: 'billData.date',
        vchField: 'billData.billNo',
        accountField: 'partyData.partyAccount',
        amountField: 'netAmount'
      },
      {
        model: LensSaleOrder,
        type: 'Sale Order',
        isDebit: false,
        dateField: 'billData.date',
        vchField: 'billData.billNo',
        accountField: 'partyData.partyAccount',
        amountField: 'netAmount'
      },
      {
        model: LensSaleChallan,
        type: 'Sale Challan',
        isDebit: false,
        dateField: 'billData.date',
        vchField: 'billData.billNo',
        accountField: 'partyData.partyAccount',
        amountField: 'netAmount'
      },
      {
        model: SaleReturn,
        type: 'Sale Return',
        isDebit: true,
        dateField: 'billData.date',
        vchField: 'billData.billNo',
        accountField: 'partyData.partyAccount',
        amountField: 'netAmount'
      },
      {
        model: RxSale,
        type: 'Rx Sale',
        isDebit: false,
        dateField: 'billData.date',
        vchField: 'billData.billNo',
        accountField: 'partyData.partyAccount',
        amountField: 'netAmount'
      },
      {
        model: RxSaleReturn,
        type: 'Rx Sale Return',
        isDebit: true,
        dateField: 'billData.date',
        vchField: 'billData.billNo',
        accountField: 'partyData.partyAccount',
        amountField: 'netAmount'
      }
    ];

    // Fetch transactions from all models
    for (const config of transactionModels) {
      try {
        const query = {
          ...companyFilter
        };
        query[config.dateField] = { $gte: startDate, $lte: endDate };

        const docs = await config.model.find(query).lean();

        docs.forEach(doc => {
          // Extract nested values safely
          const dateValue = config.dateField.split('.').reduce((obj, key) => obj?.[key], doc);
          const vchValue = config.vchField.split('.').reduce((obj, key) => obj?.[key], doc);
          const accountValue = config.accountField.split('.').reduce((obj, key) => obj?.[key], doc);
          const amountValue = config.amountField.split('.').reduce((obj, key) => obj?.[key], doc) || 0;

          // Apply firm name filter if provided
          if (firmName && firmName.trim() !== '') {
            const firmLower = firmName.toLowerCase();
            const accountLower = (accountValue || '').toLowerCase();
            if (!accountLower.includes(firmLower)) {
              return; // Skip this transaction
            }
          }

          const itemsData = (Array.isArray(doc.items) ? doc.items : []).map(item => ({
            itemName: item.itemName || '',
            orderNo: item.orderNo || '',
            eye: item.eye || '',
            sph: item.sph !== undefined && item.sph !== null ? String(item.sph) : '',
            cyl: item.cyl !== undefined && item.cyl !== null ? String(item.cyl) : '',
            axis: item.axis !== undefined && item.axis !== null ? String(item.axis) : '',
            add: item.add !== undefined && item.add !== null ? String(item.add) : '',
            remark: item.remark || ''
          }));

          transactions.push({
            date: dateValue || doc.createdAt,
            transType: config.type,
            vchNo: vchValue || doc._id?.toString().slice(-6) || 'N/A',
            account: accountValue || 'CASH',
            debit: config.isDebit ? amountValue : 0,
            credit: config.isDebit ? 0 : amountValue,
            docId: doc._id,
            items: itemsData
          });
        });
      } catch (err) {
        console.error(`Error fetching ${config.type}:`, err);
        // Continue with other models even if one fails
      }
    }

    // Sort by date
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate summary
    const totalDebit = transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
    const totalCredit = transactions.reduce((sum, t) => sum + (t.credit || 0), 0);
    const balance = totalDebit - totalCredit;

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        summary: {
          totalDebit,
          totalCredit,
          balance
        }
      }
    });

  } catch (error) {
    console.error("Error generating day book report:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

export const getBankVerificationTransactions = async (req, res) => {
  try {
    const { dateFrom, dateTo, accountName } = req.body;
    const companyId = req.user?.companyId;
    const companyFilter = {
      $or: [
        { companyId },
        { companyId: null }
      ]
    };

    const startDate = dateFrom ? new Date(dateFrom) : new Date('2000-01-01');
    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const transactions = [];

    // 1. Fetch Vouchers
    const vouchers = await Voucher.find({
      date: { $gte: startDate, $lte: endDate },
      ...companyFilter
    }).lean();

    vouchers.forEach(v => {
      v.rows.forEach(row => {
        if (accountName && row.account !== accountName) return;

        transactions.push({
          date: v.date,
          srcType: 'Voucher',
          transType: v.recordType,
          vchNo: v.billNo,
          account: row.account,
          debit: row.debit || 0,
          credit: row.credit || 0,
          amount: (row.debit || 0) + (row.credit || 0),
          docId: v._id,
          remark: row.remark || v.remarks || ''
        });
      });
    });

    // 2. Fetch Sales with paidAmount
    const sales = await LensSale.find({
      'billData.date': { $gte: startDate, $lte: endDate },
      paidAmount: { $gt: 0 },
      ...companyFilter
    }).lean();

    sales.forEach(s => {
      if (accountName && s.billData.bankAccount !== accountName) return;
      transactions.push({
        date: s.billData.date,
        srcType: 'Sale',
        transType: 'Sale Receipt',
        vchNo: s.billData.billNo,
        account: s.billData.bankAccount || 'Bank',
        debit: s.paidAmount,
        credit: 0,
        amount: s.paidAmount,
        docId: s._id,
        remark: `Paid for Sale ${s.billData.billNo}`
      });
    });

    // 3. Fetch Purchases with paidAmount
    const purchases = await LensPurchase.find({
      'billData.date': { $gte: startDate, $lte: endDate },
      paidAmount: { $gt: 0 },
      ...companyFilter
    }).lean();

    purchases.forEach(p => {
       if (accountName && p.billData.bankAccount !== accountName) return;
       transactions.push({
        date: p.billData.date,
        srcType: 'Purchase',
        transType: 'Purchase Payment',
        vchNo: p.billData.billNo,
        account: p.billData.bankAccount || 'Bank',
        debit: 0,
        credit: p.paidAmount,
        amount: p.paidAmount,
        docId: p._id,
        remark: `Paid for Purchase ${p.billData.billNo}`
      });
    });

    // Sort by date
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    console.error("Error fetching bank verification data:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


export const getCashBankBookReport = async (req, res) => {
  try {
    const { firmName, dateFrom, dateTo, transType } = req.body;
    const companyId = req.user?.companyId;
    const companyFilter = {
      $or: [
        { companyId },
        { companyId: null }
      ]
    };

    // Parse dates
    const startDate = dateFrom ? new Date(dateFrom) : new Date('2000-01-01');
    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const saleTransactions = [];
    const purchaseTransactions = [];

    // Fetch all accounts to identify Cash/Bank accounts if needed
    // But for this simplified version, we follow the user's mapping directly.
    const allAccounts = await Account.find(companyFilter).lean();
    const cashBankAcs = new Set();
    allAccounts.forEach(acc => {
      const groups = (acc.Groups || []).map(g => g.toLowerCase());
      if (groups.includes('cash-in-hand') || groups.includes('bank accounts')) {
        cashBankAcs.add(acc.Name);
      }
    });

    const query = {
      ...companyFilter,
      date: { $gte: startDate, $lte: endDate }
    };

    // Filter by recordType if specified
    if (transType && transType !== 'All') {
      query.recordType = transType;
    }

    const vouchers = await Voucher.find(query).sort({ date: 1 }).lean();

    vouchers.forEach(v => {
      // Loop through all rows
      v.rows.forEach(row => {
        const isCashOrBankAc = cashBankAcs.has(row.account);
        
        // For normal Payment/Receipt vouchers, we skip the cash/bank side rows to avoid double-counting
        // Exception: Contra entries should show both sides as they are transfers
        if (v.recordType !== 'Contra' && isCashOrBankAc) {
          return;
        }

        const amount = (row.debit || 0) + (row.credit || 0);
        if (amount === 0) return;

        // classification based on user rules
        // CREDIT (C) -> SaleTransactions (Green Table)
        // DEBIT (D) -> PurchaseTransactions (Orange Table)
        const isCredit = row.dc === 'C' || row.credit > 0;
        
        const entry = {
          date: v.date,
          transType: v.recordType,
          vchNo: v.billNo,
          account: row.account,
          cash: (row.modeOfPayment === 'Cash') ? amount : 0,
          bank: (row.modeOfPayment === 'Bank' || row.modeOfPayment === 'Cheque') ? amount : 0,
          docId: v._id
        };

        if (isCredit) {
          saleTransactions.push(entry);
        } else {
          purchaseTransactions.push(entry);
        }
      });
    });

    // Calculate Summary
    const saleTotalCash = saleTransactions.reduce((sum, t) => sum + (t.cash || 0), 0);
    const saleTotalBank = saleTransactions.reduce((sum, t) => sum + (t.bank || 0), 0);
    const purchaseTotalCash = purchaseTransactions.reduce((sum, t) => sum + (t.cash || 0), 0);
    const purchaseTotalBank = purchaseTransactions.reduce((sum, t) => sum + (t.bank || 0), 0);

    // Calculate opening balance (Placeholder - would need separate logic to calculate pre-range totals)
    const openingAmount = 0; 
    const closingAmount = openingAmount + (saleTotalCash + saleTotalBank) - (purchaseTotalCash + purchaseTotalBank);

    return res.status(200).json({
      success: true,
      data: {
        saleTransactions,
        purchaseTransactions,
        summary: {
          openingAmount,
          closingAmount,
          saleTotalCash,
          saleTotalBank,
          purchaseTotalCash,
          purchaseTotalBank
        }
      }
    });

  } catch (error) {
    console.error("Error generating cash/bank book report:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};


// Get all unique parent groups from Lens Groups
export const getParentGroups = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const companyFilter = {
      $or: [
        { companyId },
        { companyId: null }
      ]
    };
    const groups = await LensGroup.find(companyFilter).select('groupName').distinct('groupName');

    res.status(200).json({
      success: true,
      data: groups.sort()
    });
  } catch (error) {
    console.error("Error fetching parent groups:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

// Get Profit and Loss Report
export const getProfitAndLossReport = async (req, res) => {
  try {
    const { dateFrom, dateTo, groupName, productName, includeStockOutflow, searchText } = req.body;
    const companyId = req.user?.companyId;
    const companyFilter = {
      $or: [
        { companyId },
        { companyId: null }
      ]
    };

    // Parse dates
    const startDate = dateFrom ? new Date(dateFrom) : new Date('2000-01-01');
    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const dateFilter = {
      'billData.date': { $gte: startDate, $lte: endDate }
    };

    // Track items and their profit/loss
    const itemMap = new Map(); // key: itemName, value: item data

    // Process all transaction types
    const models = [
      { model: LensSale, type: 'sale' },
      { model: LensSaleOrder, type: 'sale' },
      { model: LensSaleChallan, type: 'sale' },
      { model: RxSale, type: 'sale' },
      { model: LensPurchase, type: 'purchase' },
      { model: LensPurchaseOrder, type: 'purchase' },
      { model: LensPurchaseChallan, type: 'purchase' },
      { model: RxPurchase, type: 'purchase' },
      { model: SaleReturn, type: 'saleReturn' },
      { model: RxSaleReturn, type: 'saleReturn' },
      { model: PurchaseReturn, type: 'purchaseReturn' },
      { model: RxPurchaseReturn, type: 'purchaseReturn' }
    ];

    for (const { model, type } of models) {
      try {
        const docs = await model.find({ ...dateFilter, ...companyFilter }).lean();

        docs.forEach(doc => {
          if (!Array.isArray(doc.items)) return;

          doc.items.forEach(item => {
            const itemName = item.itemName || 'Unknown';
            const groupInfo = item.groupName || doc.billData?.billType || 'General';

            // Apply filters
            if (groupName && !groupInfo.toLowerCase().includes(groupName.toLowerCase())) return;
            if (productName && !itemName.toLowerCase().includes(productName.toLowerCase())) return;
            if (searchText && !itemName.toLowerCase().includes(searchText.toLowerCase())) return;

            const qty = Number(item.qty) || 0;
            const purchasePrice = Number(item.purchasePrice) || Number(item.salePrice) || 0;
            const salePrice = Number(item.salePrice) || 0;
            const discount = Number(item.discount) || 0;

            const totalPurchasePrice = qty * purchasePrice;
            const totalSalePrice = qty * salePrice;
            const profitLoss = totalSalePrice - totalPurchasePrice;

            if (!itemMap.has(itemName)) {
              itemMap.set(itemName, {
                itemName,
                groupName: groupInfo,
                stokOutQty: 0,
                purchases: {
                  qty: 0,
                  totalPrice: 0,
                  avgPrice: 0
                },
                sales: {
                  qty: 0,
                  totalPrice: 0,
                  avgPrice: 0
                },
                profitLoss: 0
              });
            }

            const itemData = itemMap.get(itemName);

            if (type === 'sale' || type === 'saleReturn') {
              const qtyMultiplier = type === 'saleReturn' ? -1 : 1;
              itemData.sales.qty += qty * qtyMultiplier;
              itemData.sales.totalPrice += totalSalePrice * qtyMultiplier;
              if (type === 'sale') {
                itemData.stokOutQty += qty;
              }
            } else if (type === 'purchase' || type === 'purchaseReturn') {
              const qtyMultiplier = type === 'purchaseReturn' ? -1 : 1;
              itemData.purchases.qty += qty * qtyMultiplier;
              itemData.purchases.totalPrice += totalPurchasePrice * qtyMultiplier;
            }
          });
        });
      } catch (err) {
        console.error(`Error processing ${model.modelName}:`, err);
      }
    }

    // Calculate profit/loss and format results
    const reportData = Array.from(itemMap.values())
      .map(item => {
        const avgPurchasePrice = item.purchases.qty > 0 ? (item.purchases.totalPrice / item.purchases.qty) : 0;
        const avgSalePrice = item.sales.qty > 0 ? (item.sales.totalPrice / item.sales.qty) : 0;
        const profitLoss = item.sales.totalPrice - item.purchases.totalPrice;

        return {
          itemName: item.itemName,
          groupName: item.groupName,
          stokOutQty: item.stokOutQty,
          itemWiseProfit: {
            purPrice: Number(avgPurchasePrice.toFixed(2)),
            salPrice: Number(avgSalePrice.toFixed(2)),
            totPurPrice: Number(item.purchases.totalPrice.toFixed(2)),
            totSalPrice: Number(item.sales.totalPrice.toFixed(2)),
            profitLoss: Number(profitLoss.toFixed(2))
          },
          termsWiseProfit: {
            purPrice: Number(avgPurchasePrice.toFixed(2)),
            salPrice: Number(avgSalePrice.toFixed(2)),
            totPurPrice: Number(item.purchases.totalPrice.toFixed(2)),
            totSalPrice: Number(item.sales.totalPrice.toFixed(2))
          }
        };
      })
      .sort((a, b) => b.itemWiseProfit.profitLoss - a.itemWiseProfit.profitLoss);

    // Calculate summary
    const summary = {
      totalPurchaseAmount: reportData.reduce((sum, item) => sum + item.itemWiseProfit.totPurPrice, 0),
      totalSaleAmount: reportData.reduce((sum, item) => sum + item.itemWiseProfit.totSalPrice, 0),
      totalProfitLoss: reportData.reduce((sum, item) => sum + item.itemWiseProfit.profitLoss, 0),
      totalItems: reportData.length,
      profitableItems: reportData.filter(item => item.itemWiseProfit.profitLoss > 0).length,
      lossItems: reportData.filter(item => item.itemWiseProfit.profitLoss < 0).length
    };

    res.status(200).json({
      success: true,
      data: {
        reportData,
        summary
      }
    });
  } catch (error) {
    console.error("Error generating profit and loss report:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

// Get Profit and Loss Account Report (Account-wise)
export const getProfitAndLossAccountReport = async (req, res) => {
  try {
    const { dateFrom, dateTo, accountName } = req.body;
    const companyId = req.user?.companyId;
    const companyFilter = {
      $or: [
        { companyId },
        { companyId: null }
      ]
    };

    // Parse dates
    const startDate = dateFrom ? new Date(dateFrom) : new Date('2000-01-01');
    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const dateFilter = {
      'billData.date': { $gte: startDate, $lte: endDate }
    };

    // Add account filter if specified
    const accountFilter = accountName
      ? { 'partyData.partyAccount': { $regex: accountName, $options: 'i' } }
      : {};

    // Initialize expense and income categories
    const expenses = {
      directExpenses: new Map(), // Freight, Home Exp, Office Exp, Retail Exp, etc.
      purchaseAccounts: new Map(), // Purchase transactions
      openingStock: new Map(), // Opening stock value
      indirectExpenses: new Map() // Discount, Salary, etc.
    };

    const income = {
      closingStock: new Map(), // Closing stock value
      saleAccounts: new Map() // Sale transactions
    };

    // Define expense categories based on common account groups
    const directExpenseKeywords = ['freight', 'home exp', 'office exp', 'retail exp', 'transport', 'wages', 'electricity', 'rent'];
    const indirectExpenseKeywords = ['discount', 'salary', 'commission', 'interest', 'depreciation', 'bank charges', 'insurance'];

    // Process Sales
    const saleModels = [
      { model: LensSale, type: 'Sale' },
      { model: LensSaleOrder, type: 'Sale Order' },
      { model: LensSaleChallan, type: 'Sale Challan' },
      { model: RxSale, type: 'Rx Sale' }
    ];

    for (const { model, type } of saleModels) {
      try {
        const docs = await model.find({ ...dateFilter, ...accountFilter, ...companyFilter }).lean();
        docs.forEach(doc => {
          const partyAccount = doc.partyData?.partyAccount || 'Cash Sales';
          const netAmount = doc.netAmount || 0;

          if (netAmount > 0) {
            const existing = income.saleAccounts.get(partyAccount) || { amount: 0, type: 'normal' };
            existing.amount += netAmount;
            income.saleAccounts.set(partyAccount, existing);
          }
        });
      } catch (err) {
        console.error(`Error processing ${type}:`, err);
      }
    }

    // Process Sale Returns (reduces income)
    const saleReturnModels = [
      { model: SaleReturn, type: 'Sale Return' },
      { model: RxSaleReturn, type: 'Rx Sale Return' }
    ];

    for (const { model, type } of saleReturnModels) {
      try {
        const docs = await model.find({ ...dateFilter, ...accountFilter, ...companyFilter }).lean();
        docs.forEach(doc => {
          const partyAccount = doc.partyData?.partyAccount || 'Sale Return';
          const netAmount = doc.netAmount || 0;

          if (netAmount > 0) {
            const key = partyAccount + ' (Return)';
            const existing = income.saleAccounts.get(key) || { amount: 0, type: 'minus' };
            existing.amount += netAmount;
            existing.type = 'minus';
            income.saleAccounts.set(key, existing);
          }
        });
      } catch (err) {
        console.error(`Error processing ${type}:`, err);
      }
    }

    // Process Purchases
    const purchaseModels = [
      { model: LensPurchase, type: 'Purchase' },
      { model: LensPurchaseOrder, type: 'Purchase Order' },
      { model: LensPurchaseChallan, type: 'Purchase Challan' },
      { model: RxPurchase, type: 'Rx Purchase' }
    ];

    for (const { model, type } of purchaseModels) {
      try {
        const docs = await model.find({ ...dateFilter, ...accountFilter, ...companyFilter }).lean();
        docs.forEach(doc => {
          const partyAccount = doc.partyData?.partyAccount || 'Cash Purchase';
          const netAmount = doc.netAmount || 0;

          if (netAmount > 0) {
            const existing = expenses.purchaseAccounts.get(partyAccount) || { amount: 0, type: 'normal' };
            existing.amount += netAmount;
            expenses.purchaseAccounts.set(partyAccount, existing);
          }

          // Extract sundry charges as direct/indirect expenses
          if (doc.sundryDetails && Array.isArray(doc.sundryDetails)) {
            doc.sundryDetails.forEach(sundry => {
              const sundryName = (sundry.name || sundry.sundryName || '').toLowerCase();
              const sundryAmount = sundry.amount || sundry.value || 0;

              if (sundryAmount > 0) {
                const isIndirect = indirectExpenseKeywords.some(keyword => sundryName.includes(keyword));
                const isDirect = directExpenseKeywords.some(keyword => sundryName.includes(keyword));

                if (isIndirect) {
                  const key = sundry.name || sundry.sundryName || 'Other Expenses';
                  const existing = expenses.indirectExpenses.get(key) || { amount: 0 };
                  existing.amount += sundryAmount;
                  expenses.indirectExpenses.set(key, existing);
                } else if (isDirect) {
                  const key = sundry.name || sundry.sundryName || 'Direct Expenses';
                  const existing = expenses.directExpenses.get(key) || { amount: 0 };
                  existing.amount += sundryAmount;
                  expenses.directExpenses.set(key, existing);
                }
              }
            });
          }
        });
      } catch (err) {
        console.error(`Error processing ${type}:`, err);
      }
    }

    // Process Purchase Returns (reduces expenses)
    const purchaseReturnModels = [
      { model: PurchaseReturn, type: 'Purchase Return' },
      { model: RxPurchaseReturn, type: 'Rx Purchase Return' }
    ];

    for (const { model, type } of purchaseReturnModels) {
      try {
        const docs = await model.find({ ...dateFilter, ...accountFilter, ...companyFilter }).lean();
        docs.forEach(doc => {
          const partyAccount = doc.partyData?.partyAccount || 'Purchase Return';
          const netAmount = doc.netAmount || 0;

          if (netAmount > 0) {
            const key = partyAccount + ' (Return)';
            const existing = expenses.purchaseAccounts.get(key) || { amount: 0, type: 'minus' };
            existing.amount += netAmount;
            existing.type = 'minus';
            expenses.purchaseAccounts.set(key, existing);
          }
        });
      } catch (err) {
        console.error(`Error processing ${type}:`, err);
      }
    }

    // Calculate Opening Stock (purchases before start date)
    let openingStockAmount = 0;
    const openingStockFilter = {
      'billData.date': { $lt: startDate }
    };

    for (const { model } of purchaseModels) {
      try {
        const docs = await model.find({ ...openingStockFilter, ...accountFilter, ...companyFilter }).lean();
        docs.forEach(doc => {
          openingStockAmount += doc.netAmount || 0;
        });
      } catch (err) {
        // Ignore errors
      }
    }

    if (openingStockAmount > 0) {
      expenses.openingStock.set('Opening Stock', { amount: openingStockAmount });
    }

    // Calculate Closing Stock (rough approximation: opening + purchases - sales)
    let totalPurchases = 0;
    let totalSales = 0;

    expenses.purchaseAccounts.forEach((value) => {
      if (value.type === 'minus') {
        totalPurchases -= value.amount;
      } else {
        totalPurchases += value.amount;
      }
    });

    income.saleAccounts.forEach((value) => {
      if (value.type === 'minus') {
        totalSales -= value.amount;
      } else {
        totalSales += value.amount;
      }
    });

    // Closing stock estimation (simplified)
    const closingStockAmount = Math.max(0, openingStockAmount + totalPurchases - (totalSales * 0.7)); // Assume 70% cost ratio
    if (closingStockAmount > 0) {
      income.closingStock.set('Closing Stock', { amount: closingStockAmount });
    }

    // Calculate totals
    let totalDirectExpenses = 0;
    let totalIndirectExpenses = 0;
    let totalOpeningStock = openingStockAmount;
    let totalClosingStock = closingStockAmount;

    expenses.directExpenses.forEach((value) => {
      totalDirectExpenses += value.amount;
    });

    expenses.indirectExpenses.forEach((value) => {
      totalIndirectExpenses += value.amount;
    });

    // Calculate Gross Profit
    const grossProfit = totalSales + totalClosingStock - totalPurchases - totalOpeningStock - totalDirectExpenses;
    const grossProfitCO = grossProfit > 0 ? grossProfit : 0;
    const grossProfitBF = grossProfit > 0 ? grossProfit : 0;

    // Net Profit
    const netProfit = grossProfit - totalIndirectExpenses;

    // Convert Maps to arrays for response
    const formatMapToArray = (map) => {
      return Array.from(map.entries()).map(([accountName, data]) => ({
        accountName,
        amount: data.amount,
        type: data.type || 'normal'
      })).sort((a, b) => b.amount - a.amount);
    };

    const responseData = {
      expenses: {
        directExpenses: formatMapToArray(expenses.directExpenses),
        purchaseAccounts: formatMapToArray(expenses.purchaseAccounts),
        openingStock: formatMapToArray(expenses.openingStock),
        indirectExpenses: formatMapToArray(expenses.indirectExpenses)
      },
      income: {
        closingStock: formatMapToArray(income.closingStock),
        saleAccounts: formatMapToArray(income.saleAccounts)
      },
      summary: {
        totalDirectExpenses,
        totalPurchase: totalPurchases,
        totalOpeningStock,
        totalIndirectExpenses,
        totalClosingStock,
        totalSales,
        grossProfitCO,
        grossProfitBF,
        netProfit,
        totalExpenses: totalDirectExpenses + totalPurchases + totalOpeningStock + (grossProfitCO > 0 ? 0 : Math.abs(grossProfit)),
        totalIncome: totalSales + totalClosingStock + (grossProfitBF > 0 ? grossProfitBF : 0)
      }
    };

    res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error("Error generating profit and loss account report:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

// Get all unique bank accounts from transactions
export const getBankAccounts = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const companyFilter = {
      $or: [
        { companyId },
        { companyId: null }
      ]
    };
    const bankAccounts = new Set();

    // Models to check for bank accounts
    const models = [
      LensSale,
      LensSaleOrder,
      LensSaleChallan,
      SaleReturn,
      RxSale,
      RxSaleReturn,
      LensPurchase,
      LensPurchaseOrder,
      LensPurchaseChallan,
      PurchaseReturn,
      RxPurchase,
      RxPurchaseReturn
    ];

    // Fetch all documents with bankAccount field and collect unique values
    for (const model of models) {
      try {
        const docs = await model.find({
          'billData.bankAccount': { $exists: true, $ne: '', $ne: null },
          ...companyFilter
        }).select('billData.bankAccount').lean();

        docs.forEach(doc => {
          if (doc.billData?.bankAccount) {
            bankAccounts.add(doc.billData.bankAccount);
          }
        });
      } catch (err) {
        console.error(`Error fetching from ${model.modelName}:`, err);
      }
    }

    // Convert Set to sorted array
    const accountsList = Array.from(bankAccounts).sort();

    res.status(200).json({
      success: true,
      data: accountsList
    });
  } catch (error) {
    console.error("Error fetching bank accounts:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

export const getTransactionSummaryReport = async (req, res) => {
  try {
    const {
      groupName,
      productName,
      billSeries,
      dateFrom,
      dateTo,
      bookedBy,
      transType,
      searchText
    } = req.body;

    const companyId = req.user?.companyId;
    const companyFilter = {
      $or: [
        { companyId },
        { companyId: null }
      ]
    };

    const startDate = dateFrom ? new Date(dateFrom) : new Date('2000-01-01');
    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const dateFilter = {
      'billData.date': { $gte: startDate, $lte: endDate }
    };

    const transactionModels = {
      'sale invoice': { model: LensSale, type: 'Sale Invoice', prefix: 'SI' },
      'sale return': { model: SaleReturn, type: 'Sale Return', prefix: 'SR' },
      'sale order': { model: LensSaleOrder, type: 'Sale Order', prefix: 'SO' },
      'sale challan': { model: LensSaleChallan, type: 'Sale Challan', prefix: 'SC' },
      'purchase invoice': { model: LensPurchase, type: 'Purchase Invoice', prefix: 'PI' },
      'purchase return': { model: PurchaseReturn, type: 'Purchase Return', prefix: 'PR' },
      'purchase order': { model: LensPurchaseOrder, type: 'Purchase Order', prefix: 'PO' },
      'purchase challan': { model: LensPurchaseChallan, type: 'Purchase Challan', prefix: 'PC' },
    };

    let modelsToQuery = [];
    if (transType && transType !== 'All' && transType !== 'DAMAGE AND SHRINKAGE') {
      const config = transactionModels[transType.toLowerCase()];
      if (config) modelsToQuery = [config];
    } else if (transType === 'DAMAGE AND SHRINKAGE') {
      modelsToQuery = [];
    } else {
      modelsToQuery = Object.values(transactionModels);
    }

    // Pre-fetch group info
    const lensGroups = await LensGroup.find(companyFilter, { groupName: 1, productName: 1 }).lean();
    const prodGroupMap = new Map();
    lensGroups.forEach(lg => prodGroupMap.set(lg.productName, lg.groupName));

    let allTransactions = [];

    for (const config of modelsToQuery) {
      const query = { ...dateFilter, ...companyFilter };
      if (billSeries) query['billData.billSeries'] = { $regex: billSeries, $options: 'i' };
      if (bookedBy) query['billData.bookedBy'] = { $regex: bookedBy, $options: 'i' };

      const results = await config.model.find(query).lean();

      results.forEach(doc => {
        // Filter by Item/Group if required
        let matchedItems = doc.items || [];
        if (groupName || productName) {
          matchedItems = matchedItems.filter(item => {
            const itemGroupName = prodGroupMap.get(item.itemName) || '';
            const groupMatch = groupName ? String(itemGroupName).toLowerCase().includes(groupName.toLowerCase()) : true;
            const productMatch = productName ? String(item.itemName).toLowerCase().includes(productName.toLowerCase()) : true;
            return groupMatch && productMatch;
          });
          if (matchedItems.length === 0) return;
        }

        if (searchText) {
          const q = searchText.toLowerCase();
          const matches =
            (doc.billData?.billNo || '').toLowerCase().includes(q) ||
            (doc.partyData?.partyAccount || '').toLowerCase().includes(q) ||
            (doc.partyData?.gstNo || '').toLowerCase().includes(q) ||
            (doc.partyData?.contactNumber || '').toLowerCase().includes(q) ||
            (doc.remark || '').toLowerCase().includes(q);
          if (!matches) return;
        }

        let paidAmt = 0;
        if (config.type.startsWith('Sale')) {
          paidAmt = doc.paymentData?.receivedAmount || 0;
        } else if (config.type.startsWith('Purchase')) {
          paidAmt = doc.paymentData?.paidAmount || 0;
        }

        allTransactions.push({
          date: doc.billData?.date || doc.createdAt,
          vchNo: doc.billData?.billNo || '',
          vchSeries: doc.billData?.billSeries || config.prefix,
          partyName: doc.partyData?.partyAccount || '',
          gstin: doc.partyData?.gstNo || '',
          mobileNo: doc.partyData?.contactNumber || '',
          grossAmt: doc.netAmount || 0,
          paidAmt: paidAmt,
          dueAmt: (doc.netAmount || 0) - paidAmt,
          billType: doc.billData?.billType || 'TAXFREE(L)',
          mtrlCenter: doc.billData?.materialCenter || 'MC 1',
          usedIn: '',
          remark: doc.remark || '',
          status: doc.status || 'Done',
          createdBy: doc.billData?.bookedBy || 'ADMIN',
          transType: config.type,
          docId: doc._id,
          items: doc.items.map(it => ({
            sph: it.sph || 0,
            cyl: it.cyl || 0,
            add: it.add || 0
          }))
        });
      });
    }

    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.status(200).json({ success: true, data: allTransactions });
  } catch (error) {
    console.error("Error in getTransactionSummaryReport:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getTransactionDetailReport = async (req, res) => {
  try {
    const {
      groupName,
      productName,
      billSeries,
      dateFrom,
      dateTo,
      transType,
      searchText
    } = req.body;

    const companyId = req.user?.companyId;
    const companyFilter = {
      $or: [
        { companyId },
        { companyId: null }
      ]
    };

    const startDate = dateFrom ? new Date(dateFrom) : new Date('2000-01-01');
    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const dateFilter = {
      'billData.date': { $gte: startDate, $lte: endDate }
    };

    const transactionModels = {
      'sale': { model: LensSale, type: 'SALE', prefix: 'SI' },
      'purchase': { model: LensPurchase, type: 'PURCHASE', prefix: 'PI' },
    };

    let modelsToQuery = [];
    if (transType && transType !== 'All') {
      const config = transactionModels[transType.toLowerCase()];
      if (config) modelsToQuery = [config];
    } else {
      modelsToQuery = Object.values(transactionModels);
    }

    // Pre-fetch group info to map products to groups
    const lensGroups = await LensGroup.find(companyFilter, { groupName: 1, productName: 1, 'addGroups.combinations._id': 1 }).lean();
    const prodGroupMap = new Map();
    lensGroups.forEach(lg => {
      prodGroupMap.set(lg.productName, lg.groupName);
    });

    let reportData = [];

    for (const config of modelsToQuery) {
      let query = { ...dateFilter, ...companyFilter };
      if (billSeries && billSeries !== 'All') query['billData.billSeries'] = { $regex: billSeries, $options: 'i' };

      const results = await config.model.find(query).lean();

      results.forEach(doc => {
        doc.items.forEach(item => {
          const itemGroupName = prodGroupMap.get(item.itemName) || '';

          // Apply groupName filter
          if (groupName && !String(itemGroupName).toLowerCase().includes(groupName.toLowerCase())) return;
          // Apply productName filter
          if (productName && !String(item.itemName).toLowerCase().includes(productName.toLowerCase())) return;

          if (searchText) {
            const q = searchText.toLowerCase();
            const matches =
              (doc.billData?.billNo || '').toLowerCase().includes(q) ||
              (doc.partyData?.partyAccount || '').toLowerCase().includes(q) ||
              (item.itemName || '').toLowerCase().includes(q);
            if (!matches) return;
          }

          reportData.push({
            date: doc.billData?.date || doc.createdAt,
            vchNo: doc.billData?.billNo || '',
            partyName: doc.partyData?.partyAccount || '',
            mobNo: doc.partyData?.contactNumber || '',
            group: itemGroupName,
            product: item.itemName || '',
            modelNo: '',
            size: item.dia || '',
            color: '',
            itemDetail: `${item.sph || 0}/${item.cyl || 0}/${item.axis || 0}/${item.add || 0}`,
            sph: item.sph || 0,
            cyl: item.cyl || 0,
            add: item.add || 0,
            qty: item.qty || 0,
            price: item.sellPrice || item.salePrice || item.purchasePrice || 0,
            ttlPrc: (item.qty || 0) * (item.sellPrice || item.salePrice || item.purchasePrice || 0),
            disAmt: item.discount || 0,
            ttlPrice: item.totalAmount || 0,
            gstWiseAmt: doc.taxesAmount || 0,
            dueAmt: doc.dueAmount || 0,
            docId: doc._id,
            transType: config.type
          });
        });
      });
    }

    reportData.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.status(200).json({ success: true, data: reportData });
  } catch (error) {
    console.error("Error in getTransactionDetailReport:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getSaleSummaryFormatReport = async (req, res) => {
  try {
    const {
      groupName,
      productName,
      billSeries,
      dateFrom,
      dateTo,
      bookedBy,
      transType,
      searchText
    } = req.body;

    const companyId = req.user?.companyId;
    const companyFilter = {
      $or: [
        { companyId },
        { companyId: null }
      ]
    };

    const startDate = dateFrom ? new Date(dateFrom) : new Date('2000-01-01');
    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const query = {
      'billData.date': { $gte: startDate, $lte: endDate },
      ...companyFilter
    };

    if (billSeries) query['billData.billSeries'] = { $regex: billSeries, $options: 'i' };

    const sales = await LensSale.find(query).lean();

    let reportData = sales.map(doc => {
      const taxInfo = doc.taxes && doc.taxes.length > 0 ? doc.taxes[0] : { percentage: 0, amount: 0 };

      return {
        date: doc.billData?.date || doc.createdAt,
        billNo: doc.billData?.billNo || '',
        partyName: doc.partyData?.partyAccount || '',
        mobileNo: doc.partyData?.contactNumber || '',
        gstin: doc.partyData?.gstNo || '',
        state: 'Maharashtra', // Placeholder or from account
        billType: doc.billData?.billType || 'TAXFREE(L)',
        mtrlCntr: doc.billData?.godown || 'MC 1',
        totalQty: doc.summary?.totalQty || 0,
        totalAmt: doc.netAmount || 0,
        taxableAmt: doc.subtotal || 0,
        taxPercent: taxInfo.percentage || 0,
        cgstPercent: (taxInfo.percentage || 0) / 2,
        cgstAmt: (taxInfo.amount || 0) / 2,
        sgstPercent: (taxInfo.percentage || 0) / 2,
        sgstAmt: (taxInfo.amount || 0) / 2,
        docId: doc._id
      };
    });

    if (searchText) {
      const q = searchText.toLowerCase();
      reportData = reportData.filter(d =>
        d.billNo.toLowerCase().includes(q) ||
        d.partyName.toLowerCase().includes(q)
      );
    }

    reportData.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.status(200).json({ success: true, data: reportData });
  } catch (error) {
    console.error("Error in getSaleSummaryFormatReport:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Get Balance Sheet Report
export const getBalanceSheetReport = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.body;
    const companyId = req.user?.companyId;
    const companyFilter = {
      $or: [
        { companyId },
        { companyId: null }
      ]
    };

    const startDate = dateFrom ? new Date(dateFrom) : new Date('2000-01-01');
    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    // 1. Calculate Net Profit/Loss for the period (using existing logic)
    // For the sake of accuracy in this specific context, we'll re-calculate profit/loss
    // based on the logic in getProfitAndLossAccountReport but for the specified period.

    // Process Sales
    const saleModels = [
      { model: LensSale, type: 'Sale' },
      { model: RxSale, type: 'Rx Sale' }
    ];

    let totalSales = 0;
    for (const { model } of saleModels) {
      const docs = await model.find({ ...companyFilter, 'billData.date': { $gte: startDate, $lte: endDate } }).lean();
      docs.forEach(doc => { totalSales += (doc.netAmount || 0); });
    }

    // Process Purchases
    const purchaseModels = [
      { model: LensPurchase, type: 'Purchase' },
      { model: RxPurchase, type: 'Rx Purchase' }
    ];

    let totalPurchases = 0;
    for (const { model } of purchaseModels) {
      const docs = await model.find({ ...companyFilter, 'billData.date': { $gte: startDate, $lte: endDate } }).lean();
      docs.forEach(doc => { totalPurchases += (doc.netAmount || 0); });
    }

    // Process Returns
    const saleReturnModels = [{ model: SaleReturn }, { model: RxSaleReturn }];
    let totalSaleReturns = 0;
    for (const { model } of saleReturnModels) {
      const docs = await model.find({ ...companyFilter, 'billData.date': { $gte: startDate, $lte: endDate } }).lean();
      docs.forEach(doc => { totalSaleReturns += (doc.netAmount || 0); });
    }

    const purchaseReturnModels = [{ model: PurchaseReturn }, { model: RxPurchaseReturn }];
    let totalPurchaseReturns = 0;
    for (const { model } of purchaseReturnModels) {
      const docs = await model.find({ ...companyFilter, 'billData.date': { $gte: startDate, $lte: endDate } }).lean();
      docs.forEach(doc => { totalPurchaseReturns += (doc.netAmount || 0); });
    }

    // Estimated Gross Profit
    const netSales = totalSales - totalSaleReturns;
    const netPurchases = totalPurchases - totalPurchaseReturns;

    // Standard approximation: opening stock + purchases - sales(at cost) = closing stock
    // But since we want to match the image's structure:
    const netProfitForPeriod = netSales - netPurchases; // Simplified for now

    // 2. Aggregate Account Balances
    // We categorize accounts based on their groups.
    const allAccounts = await Account.find(companyFilter).lean();

    const balanceSheet = {
      liabilities: [],
      equity: [],
      assets: [],
      profitLoss: {
        surplus: 0, // Accumulated profit on Liabilities side
        loss: 0     // Loss for the period on Assets side
      },
      differenceInOpeningBalance: 0
    };

    let totalLiabilitiesValue = 0;
    let totalAssetsValue = 0;
    let totalEquityValue = 0;

    const assetGroups = ['bank accounts', 'cash-in-hand', 'sundry debtors', 'fixed assets', 'current assets', 'investments', 'loans & advances (asset)'];
    const liabilityGroups = ['sundry creditors', 'loans (liability)', 'current liabilities', 'unsecured loans', 'secured loans', 'duties & taxes'];
    const equityGroups = ['capital account', 'reserves & surplus'];

    for (const account of allAccounts) {
      // For accuracy, we should calculate balance up to endDate
      // But for this demonstration, we use OpeningBalance + Current impacts
      // A more robust way would be a full ledger scan but that's expensive.

      let balance = (account.OpeningBalance?.balance || 0) * (account.OpeningBalance?.type === 'Cr' ? 1 : -1);

      // In a real system, we'd add transaction impacts here.
      // Since accounts might have CurrentBalance calculated, let's use that if available
      let currentBal = (account.CurrentBalance?.amount || 0) * (account.CurrentBalance?.type === 'Cr' ? 1 : -1);

      const mainGroup = (account.Groups && account.Groups.length > 0 ? account.Groups[0] : '').toLowerCase();

      if (equityGroups.some(g => mainGroup.includes(g))) {
        balanceSheet.equity.push({ name: account.Name, amount: Math.abs(currentBal) });
        totalEquityValue += Math.abs(currentBal);
      } else if (liabilityGroups.some(g => mainGroup.includes(g))) {
        balanceSheet.liabilities.push({ name: account.Name, amount: Math.abs(currentBal) });
        totalLiabilitiesValue += Math.abs(currentBal);
      } else if (assetGroups.some(g => mainGroup.includes(g))) {
        balanceSheet.assets.push({ name: account.Name, amount: Math.abs(currentBal) });
        totalAssetsValue += Math.abs(currentBal);
      }
    }

    // Handle Profit/Loss
    if (netProfitForPeriod >= 0) {
      balanceSheet.profitLoss.surplus = netProfitForPeriod;
    } else {
      balanceSheet.profitLoss.loss = Math.abs(netProfitForPeriod);
    }

    // Force Balance (Difference in Opening Balance)
    // Liabilities + Equity + Profit = Assets + Loss + Diff
    const totalLeft = totalLiabilitiesValue + totalEquityValue + balanceSheet.profitLoss.surplus;
    const totalRight = totalAssetsValue + balanceSheet.profitLoss.loss;

    if (totalLeft > totalRight) {
      balanceSheet.differenceInOpeningBalance = totalLeft - totalRight;
    } else {
      // If Right > Left, the difference would be on the Liabilities side
      // But based on the image, we'll just show it on Assets side for now.
      balanceSheet.differenceInOpeningBalance = totalLeft - totalRight;
    }

    res.status(200).json({
      success: true,
      data: {
        liabilities: balanceSheet.liabilities,
        equity: balanceSheet.equity,
        assets: balanceSheet.assets,
        profitLossA_c: balanceSheet.profitLoss.surplus,
        lossForPeriod: balanceSheet.profitLoss.loss,
        diffInOpBal: balanceSheet.differenceInOpeningBalance,
        summary: {
          totalLiabilities: totalLiabilitiesValue + balanceSheet.profitLoss.surplus,
          totalEquity: totalEquityValue,
          totalAssets: totalAssetsValue + balanceSheet.profitLoss.loss + balanceSheet.differenceInOpeningBalance,
          grandTotalLeft: totalLiabilitiesValue + totalEquityValue + balanceSheet.profitLoss.surplus,
          grandTotalRight: totalAssetsValue + balanceSheet.profitLoss.loss + balanceSheet.differenceInOpeningBalance
        }
      }
    });
  } catch (error) {
    console.error("Error generating balance sheet:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Collection Report
export const getCollectionReport = async (req, res) => {
  try {
    const {
      firmName,
      dateFrom,
      dateTo,
      reportBy, // 'All', 'Date Wise', 'Month Wise'
      monthFrom,
      monthTo,
      transTypes = [] // ['Sale', 'Purchase', etc.]
    } = req.body;

    const companyId = req.user?.companyId;
    const companyFilter = {
      $or: [
        { companyId },
        { companyId: null }
      ]
    };

    let startDate, endDate;

    if (reportBy === 'Month Wise') {
      startDate = monthFrom ? new Date(monthFrom) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      endDate = monthTo ? new Date(monthTo) : new Date();
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0); // Last day of month
    } else {
      startDate = dateFrom ? new Date(dateFrom) : new Date('2000-01-01');
      endDate = dateTo ? new Date(dateTo) : new Date();
    }
    endDate.setHours(23, 59, 59, 999);

    const dateFilter = {
      'billData.date': { $gte: startDate, $lte: endDate }
    };

    const transactionModels = {
      'sale': { model: LensSale, type: 'Sale' },
      'sale order': { model: LensSaleOrder, type: 'Sale Order' },
      'sale challan': { model: LensSaleChallan, type: 'Sale Challan' },
      'purchase': { model: LensPurchase, type: 'Purchase' },
      'purchase order': { model: LensPurchaseOrder, type: 'Purchase Order' },
      'purchase challan': { model: LensPurchaseChallan, type: 'Purchase Challan' },
      'sale return': { model: SaleReturn, type: 'Sale Return' },
      'purchase return': { model: PurchaseReturn, type: 'Purchase Return' },
      'rx sale': { model: RxSale, type: 'Rx Sale' },
      'rx purchase': { model: RxPurchase, type: 'Rx Purchase' },
      'rx sale return': { model: RxSaleReturn, type: 'Rx Sale Return' },
      'rx purchase return': { model: RxPurchaseReturn, type: 'Rx Purchase Return' }
    };

    let allDocs = [];

    // Filter models to query
    const targetKeys = transTypes.length > 0
      ? transTypes.map(t => t.toLowerCase())
      : Object.keys(transactionModels);

    for (const key of targetKeys) {
      const config = transactionModels[key];
      if (!config) continue;

      const query = { ...dateFilter, ...companyFilter };
      if (firmName) query['partyData.partyAccount'] = { $regex: firmName, $options: 'i' };

      const results = await config.model.find(query).lean();
      results.forEach(doc => {
        allDocs.push({ ...doc, _internalTransType: config.type });
      });
    }

    // Process and Group
    const grouped = {};

    allDocs.forEach(doc => {
      const date = new Date(doc.billData?.date || doc.createdAt);
      let groupKey;

      if (reportBy === 'Month Wise') {
        groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (reportBy === 'Date Wise') {
        groupKey = date.toISOString().split('T')[0];
      } else {
        // default or 'All' -> we still show rows but grouped by firm?
        // Based on image, it looks like rows are by Date
        groupKey = date.toISOString().split('T')[0];
      }

      const partyName = doc.partyData?.partyAccount || 'Unknown';
      // For 'All' or if we want to show firm headers, we might need a more complex grouping.
      // But let's stick to the requested logic.

      const compositeKey = reportBy === 'All' ? `${groupKey}_${partyName}` : groupKey;

      if (!grouped[compositeKey]) {
        grouped[compositeKey] = {
          date: groupKey,
          totalBusiness: 0,
          cashDr: 0,
          cashCr: 0,
          bankDr: 0,
          bankCr: 0,
          othDr: 0,
          othCr: 0,
          details: {}, // accountName -> amount
          firmName: partyName
        };
      }

      const netAmt = doc.netAmount || 0;
      const paidAmt = doc.paidAmount || 0;
      const bankAcc = (doc.billData?.bankAccount || 'CASH').toUpperCase();
      const isCash = bankAcc === 'CASH' || bankAcc === 'HOME CASH' || bankAcc === 'PETTY CASH' || bankAcc === '';
      const isReturn = doc._internalTransType.toLowerCase().includes('return');
      const isSaleRelated = doc._internalTransType.toLowerCase().includes('sale');

      // Total Business only for Sales
      if (isSaleRelated && !isReturn) {
        grouped[compositeKey].totalBusiness += netAmt;
      }

      // Handle Collections (Dr) and Payments (Cr)
      let dr = 0, cr = 0;

      if (isSaleRelated) {
        if (isReturn) {
          cr = paidAmt; // Paying back customer
        } else {
          dr = paidAmt; // Customer paying us
        }
      } else {
        // Purchase related
        if (isReturn) {
          dr = paidAmt; // Vendor paying us back
        } else {
          cr = paidAmt; // We paying vendor
        }
      }

      if (isCash) {
        grouped[compositeKey].cashDr += dr;
        grouped[compositeKey].cashCr += cr;
      } else {
        grouped[compositeKey].bankDr += dr;
        grouped[compositeKey].bankCr += cr;
      }

      // Add to details
      if (paidAmt !== 0) {
        const detailKey = isCash ? 'CASH' : bankAcc;
        const impact = dr - cr;
        grouped[compositeKey].details[detailKey] = (grouped[compositeKey].details[detailKey] || 0) + impact;
      }
    });

    const reportData = Object.values(grouped).map(item => {
      const detailStr = Object.entries(item.details)
        .map(([name, amt]) => `${name}=${amt.toFixed(2)}`)
        .join(', ');

      const totalDr = item.cashDr + item.bankDr + item.othDr;
      const totalCr = item.cashCr + item.bankCr + item.othCr;
      const balance = totalDr - totalCr;

      return {
        ...item,
        detail: detailStr,
        balance: Math.abs(balance).toFixed(2) + (balance >= 0 ? ' Dr' : ' Cr')
      };
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json({ success: true, data: reportData });

  } catch (error) {
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getSaleItemGroupWiseReport = async (req, res) => {
  try {
    const { dateFrom, dateTo, selectedGroups } = req.body;
    const companyId = req.user?.companyId;
    const companyFilter = {
      $or: [
        { companyId },
        { companyId: null }
      ]
    };
    console.log("SALE_GROUP_REPORT: Request filters:", { dateFrom, dateTo, selectedGroups });

    const startDate = dateFrom ? new Date(dateFrom) : new Date('2000-01-01');
    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);
    console.log("SALE_GROUP_REPORT: Effective date range:", { startDate, endDate });

    // 1. Fetch group maps
    const lensGroups = await LensGroup.find(companyFilter, { groupName: 1, 'addGroups.combinations._id': 1, 'addGroups.combinations.barcode': 1 }).lean();
    const lensGroupMap = new Map();
    lensGroups.forEach(lg => {
      lg.addGroups?.forEach(ag => {
        ag.combinations?.forEach(c => {
          lensGroupMap.set(String(c._id), lg.groupName || 'Lens');
        });
      });
    });

    const items = await Item.find(companyFilter, { itemName: 1, groupName: 1 }).lean();
    const itemGroupMap = new Map();
    items.forEach(i => {
      itemGroupMap.set(i.itemName, i.groupName || 'General');
    });

    // 2. Fetch Sales
    const query = {
      $and: [
        {
          $or: [
            { 'billData.date': { $gte: startDate, $lte: endDate } },
            { 'billData.date': { $gte: startDate.toISOString(), $lte: endDate.toISOString() } }
          ]
        },
        companyFilter
      ]
    };
    let [lensSales, rxSales] = await Promise.all([
      LensSale.find(query).lean(),
      RxSale.find(query).lean()
    ]);

    if (lensSales.length === 0 && rxSales.length === 0) {
      lensSales = await LensSale.find({}).limit(10).lean();
      rxSales = await RxSale.find({}).limit(10).lean();
    }

    console.log(`SALE_GROUP_REPORT: Found ${lensSales.length} LensSales and ${rxSales.length} RxSales in range ${startDate.toISOString()} to ${endDate.toISOString()}`);

    let reportData = [];
    let processedCounts = { lensRows: 0, rxRows: 0, skipped: 0 };

    const processSale = (sale, isLens) => {
      (sale.items || []).forEach(item => {
        const groupName = isLens
          ? lensGroupMap.get(String(item.combinationId)) || 'Lens'
          : itemGroupMap.get(item.itemName) || 'General';

        if (selectedGroups && selectedGroups.length > 0 && !selectedGroups.includes(groupName)) {
          processedCounts.skipped++;
          return;
        }

        if (isLens) processedCounts.lensRows++; else processedCounts.rxRows++;

        const qty = item.qty || 0;
        const price = item.salePrice || item.sellPrice || 0;
        const discountRs = item.discount || 0;
        const subtotal = qty * price;
        const discountPct = subtotal !== 0 ? (discountRs / subtotal) * 100 : 0;

        const bankAcc = (sale.billData?.bankAccount || '').toUpperCase();
        const isCash = bankAcc === 'CASH' || bankAcc === 'HOME CASH' || bankAcc === 'PETTY CASH' || bankAcc === '';

        reportData.push({
          billNo: `${sale.billData?.billSeries || ''}${sale.billData?.billNo || ''}`,
          date: sale.billData?.date,
          party: sale.partyData?.partyAccount || 'Cash',
          productGroup: groupName,
          productName: item.itemName || '',
          qty: qty,
          prodPrice: price,
          prodDisPct: discountPct,
          prodDisRs: discountRs,
          otherDisPct: 0,
          otherDisRs: 0,
          prodValue: item.totalAmount || (subtotal - discountRs),
          prodTxbleAmt: item.totalAmount || (subtotal - discountRs),
          invoiceTotalAmt: sale.netAmount || 0,
          cash: isCash ? sale.netAmount : 0,
          bank: !isCash ? sale.netAmount : 0,
        });
      });
    };

    lensSales.forEach(s => processSale(s, true));
    rxSales.forEach(s => processSale(s, false));

    console.log("SALE_GROUP_REPORT: Processed Summary:", processedCounts);
    console.log("SALE_GROUP_REPORT: Final report data length:", reportData.length);

    // Sort by date then billNo
    reportData.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json({
      success: true,
      data: reportData,
      debug: {
        processedCounts,
        rawCounts: { lens: lensSales.length, rx: rxSales.length },
        samples: {
          lens: lensSales.length > 0 ? { billData: lensSales[0].billData, itemNames: lensSales[0].items?.map(i => i.itemName) } : null,
          rx: rxSales.length > 0 ? { billData: rxSales[0].billData, itemNames: rxSales[0].items?.map(i => i.itemName) } : null,
        }
      }
    });

  } catch (error) {
    console.error("Error in getSaleItemGroupWiseReport:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getCustomerAnalysisReport = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.body;
    const companyId = req.user?.companyId;
    const companyFilter = {
      $or: [
        { companyId },
        { companyId: null }
      ]
    };

    const startDate = dateFrom ? new Date(dateFrom) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const matchQuery = {
      'billData.date': { $gte: startDate, $lte: endDate }
    };

    const aggregatePerformance = async (Model) => {
      return await Model.aggregate([
        { $match: { ...matchQuery, ...companyFilter } },
        {
          $project: {
            partyName: { $toUpper: { $ifNull: ["$partyData.partyAccount", "CASH"] } },
            netAmount: 1,
            billDate: "$billData.date",
            itemQty: { $sum: "$items.qty" }
          }
        },
        {
          $group: {
            _id: "$partyName",
            totalSales: { $sum: "$netAmount" },
            orderCount: { $sum: 1 },
            totalQty: { $sum: "$itemQty" },
            lastOrderDate: { $max: "$billDate" }
          }
        }
      ]);
    };

    const [lensPerformance, rxPerformance] = await Promise.all([
      aggregatePerformance(LensSale),
      aggregatePerformance(RxSale)
    ]);

    // Merge results
    const customerMap = new Map();

    const merge = (results) => {
      results.forEach(item => {
        const name = item._id;
        if (!customerMap.has(name)) {
          customerMap.set(name, {
            customerName: name,
            totalSales: 0,
            orderCount: 0,
            totalQty: 0,
            lastOrderDate: null
          });
        }
        const current = customerMap.get(name);
        current.totalSales += (item.totalSales || 0);
        current.orderCount += (item.orderCount || 0);
        current.totalQty += (item.totalQty || 0);
        if (!current.lastOrderDate || new Date(item.lastOrderDate) > new Date(current.lastOrderDate)) {
          current.lastOrderDate = item.lastOrderDate;
        }
      });
    };

    merge(lensPerformance);
    merge(rxPerformance);

    const finalData = Array.from(customerMap.values()).sort((a, b) => b.totalSales - a.totalSales);

    res.status(200).json({
      success: true,
      data: finalData
    });

  } catch (error) {
    console.error("Error in getCustomerAnalysisReport:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * Power Movement Report Controller
 * Analyzes which lens powers are selling/moving based on unique combinations
 */
export const getPowerMovementReport = async (req, res) => {
  try {
    const {
      dateFrom,
      dateTo,
      itemName,
      groupName, // New filter
      eye,
      sphMin,
      sphMax,
      cylMin,
      cylMax,
      addMin,
      addMax,
      movementType,
      vendorPartyName,
    } = req.body;

    const companyId = req.user?.companyId;
    const companyFilter = {
      $or: [
        { companyId },
        { companyId: null }
      ]
    };

    // Pre-filter items if groupName provided
    let allowedItemNames = null;
    if (groupName) {
      const itemsInGroup = await Item.find({ groupName, ...companyFilter }).select('itemName').lean();
      allowedItemNames = new Set(itemsInGroup.map(i => i.itemName));
    }

    // Default dates to current month if not provided
    const now = new Date();
    const startDate = dateFrom ? new Date(dateFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = dateTo ? new Date(dateTo) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Set hours for date range search
    if (dateFrom) startDate.setHours(0, 0, 0, 0);
    if (dateTo) endDate.setHours(23, 59, 59, 999);

    const matchQuery = {
      'billData.date': { $gte: startDate, $lte: endDate },
      ...companyFilter
    };

    // Models to aggregate from
    const models = [
      { model: LensSale, type: 'Lens Sale' },
      { model: LensSaleOrder, type: 'Lens Order' },
      { model: LensSaleChallan, type: 'Lens Challan' },
      { model: RxSale, type: 'Rx Sale' },
      { model: RxSaleOrder, type: 'Rx Order' }
    ];

    let combinedItems = [];

    // Aggregate data from each model
    for (const m of models) {
      const docs = await m.model.find(matchQuery).lean();
      
      docs.forEach(doc => {
        // Party filter
        if (vendorPartyName) {
          const party = (doc.partyData?.partyAccount || '').toLowerCase();
          if (!party.includes(vendorPartyName.toLowerCase())) return;
        }

        (doc.items || []).forEach(item => {
          // Item name filter
          if (itemName) {
            if (Array.isArray(itemName) && itemName.length > 0) {
              if (!itemName.some(name => item.itemName?.toLowerCase() === name.toLowerCase())) return;
            } else if (typeof itemName === 'string' && itemName.trim() !== '') {
              if (!item.itemName?.toLowerCase().includes(itemName.toLowerCase())) return;
            }
          }
          // Group filter (new)
          if (allowedItemNames && !allowedItemNames.has(item.itemName)) return;

          // Power attributes (normalize to numbers for comparison)
          const iSph = parseFloat(item.sph) || 0;
          const iCyl = parseFloat(item.cyl) || 0;
          const iAdd = parseFloat(item.add) || 0;
          const iEye = (item.eye || '').toUpperCase();

          // SPH filter
          if (sphMin !== undefined && iSph < parseFloat(sphMin)) return;
          if (sphMax !== undefined && iSph > parseFloat(sphMax)) return;

          // CYL filter
          if (cylMin !== undefined && iCyl < parseFloat(cylMin)) return;
          if (cylMax !== undefined && iCyl > parseFloat(cylMax)) return;

          // ADD filter
          if (addMin !== undefined && iAdd < parseFloat(addMin)) return;
          if (addMax !== undefined && iAdd > parseFloat(addMax)) return;

          // Eye filter
          if (eye && eye !== 'Both' && iEye !== eye.toUpperCase()) return;

          combinedItems.push({
            eye: iEye || '-',
            sph: iSph,
            cyl: iCyl,
            axis: item.axis || 0,
            add: iAdd,
            itemName: item.itemName,
            qty: parseFloat(item.qty) || 0,
            revenue: parseFloat(item.totalAmount || item.totalAmt || (item.qty * (item.sellPrice || item.salePrice || item.price || 0))) || 0,
            date: doc.billData?.date || doc.createdAt,
            orderId: doc._id
          });
        });
      });
    }

    // Grouping by power combination
    const powerMap = new Map();

    combinedItems.forEach(item => {
      // Create a unique key for the combination
      const key = `${item.eye}|${item.sph}|${item.cyl}|${item.axis}|${item.add}|${item.itemName}`;
      
      if (!powerMap.has(key)) {
        powerMap.set(key, {
          eye: item.eye,
          sph: item.sph,
          cyl: item.cyl,
          axis: item.axis,
          add: item.add,
          itemName: item.itemName,
          totalQty: 0,
          totalRevenue: 0,
          orderCount: new Set(),
          lastSoldDate: null
        });
      }

      const entry = powerMap.get(key);
      entry.totalQty += item.qty;
      entry.totalRevenue += item.revenue;
      entry.orderCount.add(item.orderId.toString());
      if (!entry.lastSoldDate || new Date(item.date) > new Date(entry.lastSoldDate)) {
        entry.lastSoldDate = item.date;
      }
    });

    // Convert map to array and compute analytics
    let summaryData = Array.from(powerMap.values()).map(item => ({
      ...item,
      orderCount: item.orderCount.size,
      avgPrice: item.totalQty > 0 ? (item.totalRevenue / item.totalQty) : 0
    }));

    if (summaryData.length === 0) {
      return res.status(200).json({ success: true, data: [], analytics: {} });
    }

    // Determine thresholds for movement status
    const allQtys = summaryData.map(d => d.totalQty).sort((a, b) => b - a);
    const maxQty = allQtys[0] || 0;
    
    summaryData = summaryData.map(item => {
      let status = 'Slow Moving';
      if (item.totalQty >= maxQty * 0.6) status = 'Fast Moving';
      else if (item.totalQty >= maxQty * 0.2) status = 'Medium Moving';
      
      return { ...item, movementStatus: status };
    });

    // Apply Movement Type Filter
    if (movementType && movementType !== 'All') {
      summaryData = summaryData.filter(item => item.movementStatus === movementType);
    }

    // Insights/Analytics
    const analytics = {
      topFastMoving: [...summaryData].sort((a, b) => b.totalQty - a.totalQty).slice(0, 5),
      topSlowMoving: [...summaryData].sort((a, b) => a.totalQty - b.totalQty).slice(0, 5),
      mostSoldItem: null,
      highestRevenue: [...summaryData].sort((a, b) => b.totalRevenue - a.totalRevenue)[0],
      totalSummary: {
        totalQty: summaryData.reduce((acc, curr) => acc + curr.totalQty, 0),
        totalRevenue: summaryData.reduce((acc, curr) => acc + curr.totalRevenue, 0)
      }
    };

    // Calculate most sold item name
    const itemStats = {};
    combinedItems.forEach(i => {
      itemStats[i.itemName] = (itemStats[i.itemName] || 0) + i.qty;
    });
    analytics.mostSoldItem = Object.entries(itemStats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    res.status(200).json({ success: true, data: summaryData, analytics });
  } catch (error) {
    console.error("Error generating power movement report:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Sale Return Ratio Report
export const getSaleReturnRatioReport = async (req, res) => {
  try {
    const { dateFrom, dateTo, customerName } = req.body;
    const companyId = req.user?.companyId;

    const startDate = dateFrom ? new Date(dateFrom) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const companyFilter = { $or: [{ companyId }, { companyId: null }] };
    const dateFilter = { 'billData.date': { $gte: startDate, $lte: endDate } };

    const filter = { ...companyFilter, ...dateFilter };
    if (customerName) {
      filter['partyData.partyAccount'] = { $regex: customerName, $options: 'i' };
    }

    const saleModels = [LensSale, RxSale, LensSaleChallan];
    const returnModels = [SaleReturn, RxSaleReturn];

    const partyStats = {};
    const trendStats = {};

    const processDocs = (docs, isReturn = false) => {
      docs.forEach(doc => {
        const party = doc.partyData?.partyAccount || 'Unknown';
        const amount = Number(doc.netAmount || doc.summary?.totalAmount || 0);
        const date = new Date(doc.billData?.date || doc.createdAt);
        
        // Party stats
        if (!partyStats[party]) {
          partyStats[party] = { partyName: party, totalSale: 0, totalReturn: 0 };
        }
        if (isReturn) partyStats[party].totalReturn += amount;
        else partyStats[party].totalSale += amount;

        // Trend stats (Monthly)
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        if (!trendStats[monthKey]) {
          trendStats[monthKey] = { period: monthKey, sale: 0, "return": 0 };
        }
        if (isReturn) trendStats[monthKey].return += amount;
        else trendStats[monthKey].sale += amount;
      });
    };

    for (const modelConfig of [
      { m: LensSale }, 
      { m: RxSale }, 
      { m: LensSaleChallan, filter: { isInvoiced: { $ne: true } } }, 
      { m: LensSaleOrder, filter: { status: { $nin: ['Done', 'Cancelled'] } } },
      { m: RxSaleOrder, filter: { status: { $nin: ['Done', 'Cancelled'] } } },
      { m: ContactLensSaleOrder, filter: { status: { $nin: ['Done', 'Cancelled'] } } }
    ]) {
      const finalFilter = { ...filter, ...(modelConfig.filter || {}) };
      const docs = await modelConfig.m.find(finalFilter).lean();
      processDocs(docs, false);
    }
    for (const modelConfig of [{ m: SaleReturn }, { m: RxSaleReturn }]) {
      const docs = await modelConfig.m.find(filter).lean();
      processDocs(docs, true);
    }

    // Format Party Data
    const formattedPartyData = Object.values(partyStats).map(p => {
      const netSale = p.totalSale - p.totalReturn;
      const ratio = p.totalSale > 0 ? (p.totalReturn / p.totalSale) * 100 : 0;
      return { ...p, netSale, ratio: parseFloat(ratio.toFixed(2)) };
    });

    // Format Trend Data
    const formattedTrendData = Object.values(trendStats).sort((a, b) => a.period.localeCompare(b.period)).map(t => {
      const ratio = t.sale > 0 ? (t["return"] / t.sale) * 100 : 0;
      return { ...t, ratio: parseFloat(ratio.toFixed(2)) };
    });

    // Summary calculation
    const overallTotalSale = Object.values(partyStats).reduce((sum, p) => sum + p.totalSale, 0);
    const overallTotalReturn = Object.values(partyStats).reduce((sum, p) => sum + p.totalReturn, 0);
    const overallNetSale = overallTotalSale - overallTotalReturn;
    const overallRatio = overallTotalSale > 0 ? (overallTotalReturn / overallTotalSale) * 100 : 0;

    res.status(200).json({
      success: true,
      summary: {
        totalSale: overallTotalSale,
        totalReturn: overallTotalReturn,
        netSale: overallNetSale,
        ratio: parseFloat(overallRatio.toFixed(2))
      },
      partyWise: formattedPartyData,
      trend: formattedTrendData
    });
  } catch (error) {
    console.error("Error generating Sale Return Ratio Report:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
export const saveSaleTarget = async (req, res) => {
  try {
    const { partyId, partyName, targetAmount, periodType, year, month, quarter, startDate, endDate } = req.body;
    const companyId = req.user?.companyId;

    const query = { 
      partyId: String(partyId).trim(), 
      periodType, 
      year: Number(year), 
      companyId 
    };
    if (periodType === 'Monthly' && month) query.month = Number(month);
    if (periodType === 'Quarterly' && quarter) query.quarter = Number(quarter);

    const update = {
      partyName: String(partyName).trim(),
      targetAmount: Number(targetAmount),
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    };

    const target = await SaleTarget.findOneAndUpdate(query, update, { upsert: true, new: true });
    res.status(200).json({ success: true, data: target });
  } catch (error) {
    console.error("Error saving sale target:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Get Sale Target Report
export const getSaleTargetReport = async (req, res) => {
  try {
    const { year, periodType, month, quarter } = req.body;
    const companyId = req.user?.companyId;
    const companyFilter = { $or: [{ companyId }, { companyId: null }] };

    // 1. Get all targets for selected period/year
    const targetQuery = { year: Number(year), periodType, ...companyFilter };
    if (periodType === 'Monthly' && month) targetQuery.month = Number(month);
    if (periodType === 'Quarterly' && quarter) targetQuery.quarter = Number(quarter);
    
    console.log("Target Query:", JSON.stringify(targetQuery));
    const targets = await SaleTarget.find(targetQuery).lean();
    console.log("Targets Found:", targets.length);

    // 2. Map targets by party for easy lookup (using normalized keys)
    const targetMap = {};
    targets.forEach(t => {
      targetMap[String(t.partyId).trim()] = t;
    });

    // 3. Define target period boundaries
    let startDate, endDate;
    if (periodType === 'Yearly') {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59);
    } else if (periodType === 'Monthly') {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59);
    } else if (periodType === 'Quarterly') {
      startDate = new Date(year, (quarter - 1) * 3, 1);
      endDate = new Date(year, quarter * 3, 0, 23, 59, 59);
    }

    // 4. Fetch all accounts (parties) that should be in the report (Sales, Both)
    const accounts = await Account.find({ ...companyFilter, AccountType: { $in: ['Sale', 'Both'] } }).select('Name').lean();

    // 5. Aggregate sales data for these parties in the period
    const saleModels = [
      { m: LensSale },
      { m: RxSale },
      { m: LensSaleChallan, filter: { isInvoiced: { $ne: true } } },
      { m: LensSaleOrder, filter: { status: { $nin: ['Done', 'Cancelled'] } } },
      { m: RxSaleOrder, filter: { status: { $nin: ['Done', 'Cancelled'] } } },
      { m: ContactLensSaleOrder, filter: { status: { $nin: ['Done', 'Cancelled'] } } }
    ];
    const returnModels = [{ m: SaleReturn }, { m: RxSaleReturn }];

    const salesByParty = {};
    const processDocs = (docs, isReturn = false) => {
      docs.forEach(doc => {
        const pId = String(doc.partyData?.partyAccount || 'Unknown').trim();
        const amt = Number(doc.netAmount || doc.summary?.totalAmount || 0);
        if (!salesByParty[pId]) salesByParty[pId] = 0;
        if (isReturn) salesByParty[pId] -= amt;
        else salesByParty[pId] += amt;
      });
    };

    const filter = { ...companyFilter, 'billData.date': { $gte: startDate, $lte: endDate } };
    for (const config of saleModels) {
      const docs = await config.m.find({ ...filter, ...(config.filter || {}) }).lean();
      processDocs(docs, false);
    }
    for (const config of returnModels) {
      const docs = await config.m.find(filter).lean();
      processDocs(docs, true);
    }

    // 6. Build the result
    const reportData = accounts.map(acc => {
      const partyNameKey = String(acc.Name).trim();
      const target = targetMap[partyNameKey] || null;
      const targetAmount = target ? target.targetAmount : 0;
      const achieved = salesByParty[partyNameKey] || 0;
      const diff = targetAmount - achieved;
      const ratio = targetAmount > 0 ? (achieved / targetAmount) * 100 : 0;
      
      let status = "No Target";
      if (targetAmount > 0) {
        if (ratio >= 100) status = "Achieved";
        else if (ratio >= 70) status = "Pending";
        else status = "Below Target";
      }

      return {
        partyName: acc.Name,
        targetAmount,
        achieved,
        difference: diff,
        ratio: parseFloat(ratio.toFixed(2)),
        status,
        targetId: target?._id,
        periodType,
        year,
        month,
        quarter
      };
    });

    // Overall Summary
    const summary = {
      totalTarget: reportData.reduce((s, r) => s + r.targetAmount, 0),
      totalAchieved: reportData.reduce((s, r) => s + r.achieved, 0),
    };
    summary.shortfall = summary.totalTarget - summary.totalAchieved;
    summary.ratio = summary.totalTarget > 0 ? parseFloat(((summary.totalAchieved / summary.totalTarget) * 100).toFixed(2)) : 0;

    res.status(200).json({ success: true, summary, data: reportData });
  } catch (error) {
    console.error("Error generating sale target report:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Get Target History for a specific party with performance calculation
export const getPartyTargetHistory = async (req, res) => {
  try {
    const { partyName } = req.params;
    const companyId = req.user?.companyId;
    const companyFilter = { $or: [{ companyId }, { companyId: null }] };
    const partyId = String(partyName).trim();

    const history = await SaleTarget.find({ partyId, ...companyFilter }).sort({ year: -1, month: -1, quarter: -1 }).lean();

    // Models to aggregate from
    const saleModels = [
      { m: LensSale }, { m: RxSale },
      { m: LensSaleChallan, filter: { isInvoiced: { $ne: true } } },
      { m: LensSaleOrder, filter: { status: { $nin: ['Done', 'Cancelled'] } } },
      { m: RxSaleOrder, filter: { status: { $nin: ['Done', 'Cancelled'] } } },
      { m: ContactLensSaleOrder, filter: { status: { $nin: ['Done', 'Cancelled'] } } }
    ];
    const returnModels = [{ m: SaleReturn }, { m: RxSaleReturn }];

    // For each historical target, calculate performance
    const historyWithPerformance = await Promise.all(history.map(async (target) => {
      let startDate, endDate;
      const { year, periodType, month, quarter } = target;

      if (periodType === 'Yearly') {
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31, 23, 59, 59);
      } else if (periodType === 'Monthly') {
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0, 23, 59, 59);
      } else if (periodType === 'Quarterly') {
        startDate = new Date(year, (quarter - 1) * 3, 1);
        endDate = new Date(year, quarter * 3, 0, 23, 59, 59);
      }

      let achieved = 0;
      const filter = { ...companyFilter, 'partyData.partyAccount': partyId, 'billData.date': { $gte: startDate, $lte: endDate } };

      for (const config of saleModels) {
        const docs = await config.m.find({ ...filter, ...(config.filter || {}) }).select('netAmount summary.totalAmount').lean();
        docs.forEach(d => achieved += Number(d.netAmount || d.summary?.totalAmount || 0));
      }
      for (const config of returnModels) {
        const docs = await config.m.find(filter).select('netAmount summary.totalAmount').lean();
        docs.forEach(d => achieved -= Number(d.netAmount || d.summary?.totalAmount || 0));
      }

      const ratio = target.targetAmount > 0 ? (achieved / target.targetAmount) * 100 : 0;
      let status = "No Target";
      if (target.targetAmount > 0) {
        if (ratio >= 100) status = "Achieved";
        else if (ratio >= 70) status = "Pending";
        else status = "Below Target";
      }

      return {
        ...target,
        achieved,
        ratio: parseFloat(ratio.toFixed(2)),
        status
      };
    }));

    res.status(200).json({ success: true, data: historyWithPerformance });
  } catch (error) {
    console.error("Error fetching party target history:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Cancelled Order Ratio Report
export const getCancelledOrderRatioReport = async (req, res) => {
  try {
    const { dateFrom, dateTo, transactionType, partyName } = req.body;
    const companyId = req.user?.companyId;

    const startDate = dateFrom ? new Date(dateFrom) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const companyFilter = { $or: [{ companyId }, { companyId: null }] };
    let dateFilter = { 'billData.date': { $gte: startDate, $lte: endDate } };

    const baseFilter = { ...companyFilter, ...dateFilter };
    if (partyName) {
      baseFilter['partyData.partyAccount'] = { $regex: partyName, $options: 'i' };
    }

    const saleModels = [
      { m: LensSaleOrder, label: 'Sale Order', orderType: 'Order' },
      { m: RxSaleOrder, label: 'Rx Sale Order', orderType: 'Order' },
      { m: ContactLensSaleOrder, label: 'Contact Lens Sale Order', orderType: 'Order' },
      { m: LensSaleChallan, label: 'Sale Challan', orderType: 'Challan' }
    ];

    const purchaseModels = [
      { m: LensPurchaseOrder, label: 'Purchase Order', orderType: 'Order' },
      { m: RxPurchaseOrder, label: 'Rx Purchase Order', orderType: 'Order' },
      { m: ContactLensPurchaseOrder, label: 'Contact Lens Purchase Order', orderType: 'Order' },
      { m: LensPurchaseChallan, label: 'Purchase Challan', orderType: 'Challan' }
    ];

    const details = [];
    const partyDataMap = {};
    const trends = {};

    const process = async (models, type) => {
      if (transactionType && transactionType !== 'Both' && transactionType !== type) return;

      for (const modelConfig of models) {
        // Some models might use 'billData.date' or 'createdAt' if billData.date is missing? No, we filter by billData.date.
        const docs = await modelConfig.m.find(baseFilter).lean();
        
        docs.forEach(doc => {
          const party = doc.partyData?.partyAccount || 'Unknown';
          const isCancelled = (doc.status || '').toLowerCase() === 'cancelled';
          const date = new Date(doc.billData?.date || doc.createdAt);
          const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

          details.push({
            date: date.toISOString().split('T')[0],
            transactionType: type,
            orderType: modelConfig.orderType,
            label: modelConfig.label,
            partyName: party,
            totalOrders: 1,
            cancelledOrders: isCancelled ? 1 : 0,
            netAmount: Number(doc.netAmount || 0),
            status: doc.status
          });

          // Party Breakdown
          if (!partyDataMap[party]) {
            partyDataMap[party] = { partyName: party, totalOrders: 0, cancelledOrders: 0, saleCount: 0, purchaseCount: 0 };
          }
          partyDataMap[party].totalOrders++;
          if (isCancelled) partyDataMap[party].cancelledOrders++;
          if (type === 'Sale') partyDataMap[party].saleCount++;
          else partyDataMap[party].purchaseCount++;

          // Trend
          if (!trends[monthKey]) {
            trends[monthKey] = { period: monthKey, total: 0, cancelled: 0 };
          }
          trends[monthKey].total++;
          if (isCancelled) trends[monthKey].cancelled++;
        });
      }
    };

    await process(saleModels, 'Sale');
    await process(purchaseModels, 'Purchase');

    // Summarize
    const overallTotal = details.reduce((s, r) => s + r.totalOrders, 0);
    const overallCancelled = details.reduce((s, r) => s + r.cancelledOrders, 0);
    const overallRatio = overallTotal > 0 ? parseFloat(((overallCancelled / overallTotal) * 100).toFixed(2)) : 0;
    
    // Sort details by date desc
    details.sort((a, b) => b.date.localeCompare(a.date));

    // Format partyWise data
    const partyWise = Object.values(partyDataMap).map(p => {
      const ratio = p.totalOrders > 0 ? parseFloat(((p.cancelledOrders / p.totalOrders) * 100).toFixed(2)) : 0;
      return { ...p, ratio };
    });

    // Format trend data
    const trend = Object.values(trends).sort((a, b) => a.period.localeCompare(b.period)).map(t => {
      const ratio = t.total > 0 ? parseFloat(((t.cancelled / t.total) * 100).toFixed(2)) : 0;
      return { ...t, ratio };
    });

    // Comparison summary
    const saleTotal = details.filter(d => d.transactionType === 'Sale').length;
    const saleCancelled = details.filter(d => d.transactionType === 'Sale' && d.status?.toLowerCase() === 'cancelled').length;
    const purchaseTotal = details.filter(d => d.transactionType === 'Purchase').length;
    const purchaseCancelled = details.filter(d => d.transactionType === 'Purchase' && d.status?.toLowerCase() === 'cancelled').length;

    const summary = {
      totalOrders: overallTotal,
      cancelledOrders: overallCancelled,
      activeOrders: overallTotal - overallCancelled,
      ratio: overallRatio,
      sale: {
        total: saleTotal,
        cancelled: saleCancelled,
        ratio: saleTotal > 0 ? parseFloat(((saleCancelled / saleTotal) * 100).toFixed(2)) : 0
      },
      purchase: {
        total: purchaseTotal,
        cancelled: purchaseCancelled,
        ratio: purchaseTotal > 0 ? parseFloat(((purchaseCancelled / purchaseTotal) * 100).toFixed(2)) : 0
      }
    };

    res.status(200).json({
      success: true,
      summary,
      details,
      partyWise,
      trend
    });

  } catch (error) {
    console.error("Error generating Cancelled Order Ratio Report:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Order to Challan Time Report
export const getOrderToChallanTimeReport = async (req, res) => {
  try {
    const { dateFrom, dateTo, partyName, status } = req.body;
    const companyId = req.user?.companyId;

    const startDate = dateFrom ? new Date(dateFrom) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const companyFilter = { $or: [{ companyId }, { companyId: null }] };
    const dateFilter = { 'billData.date': { $gte: startDate, $lte: endDate } };

    const baseFilter = { ...companyFilter, ...dateFilter };
    if (partyName) {
      baseFilter['partyData.partyAccount'] = { $regex: partyName, $options: 'i' };
    }

    const orderModels = [
      { m: LensSaleOrder, type: 'LENS' },
      { m: RxSaleOrder, type: 'RX' },
      { m: ContactLensSaleOrder, type: 'CONTACT' }
    ];

    const results = [];
    const challans = await LensSaleChallan.find({ ...companyFilter }).select('sourceSaleId orderType billData.date billNo createdAt').lean();
    
    // Map challans by sourceSaleId
    const challanMap = {};
    challans.forEach(c => {
      if (c.sourceSaleId) {
        // If multiple challans for same order, we might want the first one created?
        const key = c.sourceSaleId.toString();
        if (!challanMap[key] || new Date(c.createdAt) < new Date(challanMap[key].createdAt)) {
          challanMap[key] = c;
        }
      }
    });

    for (const config of orderModels) {
      const orders = await config.m.find(baseFilter).lean();
      
      orders.forEach(order => {
        const id = order._id.toString();
        const challan = challanMap[id];
        
        let diffMinutes = null;
        let orderStatus = "Pending";

        if (challan) {
          orderStatus = "Completed";
          const orderTime = new Date(order.createdAt);
          const challanTime = new Date(challan.createdAt);
          diffMinutes = Math.floor((challanTime - orderTime) / (1000 * 60));
        }

        results.push({
          orderId: id,
          orderNo: order.billData?.billNo || 'N/A',
          orderDate: order.billData?.date,
          orderCreatedAt: order.createdAt,
          challanNo: challan?.billNo || 'N/A',
          challanDate: challan?.billData?.date || null,
          challanCreatedAt: challan?.createdAt || null,
          partyName: order.partyData?.partyAccount || 'Unknown',
          timeDifference: diffMinutes,
          status: orderStatus
        });
      });
    }

    // Filter by status if requested
    let filteredResults = results;
    if (status && status !== 'All') {
      filteredResults = results.filter(r => r.status === status);
    }

    // Calculate Summary
    const totalOrders = results.length;
    const completedOrders = results.filter(r => r.status === 'Completed').length;
    const pendingOrders = totalOrders - completedOrders;
    
    const totalDiff = results.filter(r => r.timeDifference !== null).reduce((s, r) => s + r.timeDifference, 0);
    const avgTime = completedOrders > 0 ? parseFloat((totalDiff / completedOrders).toFixed(2)) : 0;

    // Trend Data (Monthly Average)
    const trends = {};
    results.filter(r => r.timeDifference !== null).forEach(r => {
      const date = new Date(r.orderDate || r.orderCreatedAt);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!trends[monthKey]) trends[monthKey] = { period: monthKey, totalTime: 0, count: 0 };
      trends[monthKey].totalTime += r.timeDifference;
      trends[monthKey].count++;
    });
    
    const formattedTrend = Object.values(trends).sort((a,b) => a.period.localeCompare(b.period)).map(t => ({
      period: t.period,
      avgTime: parseFloat((t.totalTime / t.count).toFixed(2))
    }));

    res.status(200).json({
      success: true,
      summary: {
        totalOrders,
        completedOrders,
        pendingOrders,
        avgTime
      },
      details: filteredResults,
      trend: formattedTrend
    });

  } catch (error) {
    console.error("Error generating Order to Challan Time Report:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ─── Customer/Vendor Collection Target ─────────────────────────────────────

export const saveCollectionTarget = async (req, res) => {
  try {
    const { partyId, partyName, targetAmount, targetType, periodType, year, month, quarter, startDate, endDate } = req.body;
    const companyId = req.user?.companyId;

    const query = {
      partyId: String(partyId).trim(),
      targetType,
      periodType,
      year: Number(year),
      companyId,
    };
    if (periodType === 'Monthly' && month) query.month = Number(month);
    if (periodType === 'Quarterly' && quarter) query.quarter = Number(quarter);

    const update = {
      partyName: String(partyName).trim(),
      targetAmount: Number(targetAmount),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };

    const target = await CollectionTarget.findOneAndUpdate(query, update, { upsert: true, new: true });
    res.status(200).json({ success: true, data: target });
  } catch (error) {
    console.error("Error saving collection target:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getCollectionTargetReport = async (req, res) => {
  try {
    const { year, periodType, month, quarter, targetType } = req.body;
    const companyId = req.user?.companyId;
    const companyFilter = { $or: [{ companyId }, { companyId: null }] };

    const y = Number(year);
    const m = Number(month);
    const q = Number(quarter);

    let startDate, endDate;
    if (periodType === 'Yearly') {
      startDate = new Date(y, 0, 1);
      endDate   = new Date(y, 11, 31, 23, 59, 59);
    } else if (periodType === 'Monthly') {
      startDate = new Date(y, m - 1, 1);
      endDate   = new Date(y, m, 0, 23, 59, 59);
    } else {
      startDate = new Date(y, (q - 1) * 3, 1);
      endDate   = new Date(y, q * 3, 0, 23, 59, 59);
    }

    // Fetch saved targets
    const targetQuery = { year: y, periodType, targetType, ...companyFilter };
    if (periodType === 'Monthly') targetQuery.month = m;
    if (periodType === 'Quarterly') targetQuery.quarter = q;
    const targets = await CollectionTarget.find(targetQuery).lean();
    const targetMap = {};
    targets.forEach(t => { targetMap[String(t.partyId).trim()] = t; });

    // Accounts — Customer = Sale/Both, Vendor = Purchase/Both
    const accountType = targetType === 'Customer'
      ? { $in: ['Sale', 'Both'] }
      : { $in: ['Purchase', 'Both'] };
    const accounts = await Account.find({ ...companyFilter, AccountType: accountType }).select('Name').lean();

    // Aggregate voucher rows in the period
    // Customer: dc='C' (credit received), Vendor: dc='D' (debit paid)
    const dc = targetType === 'Customer' ? 'C' : 'D';
    const amountField = targetType === 'Customer' ? 'credit' : 'debit';

    const vouchers = await Voucher.find({
      ...companyFilter,
      date: { $gte: startDate, $lte: endDate },
    }).lean();

    const collectedByParty = {};
    vouchers.forEach(v => {
      (v.rows || []).forEach(row => {
        if (row.dc === dc) {
          const key = String(row.account || '').trim();
          collectedByParty[key] = (collectedByParty[key] || 0) + Number(row[amountField] || 0);
        }
      });
    });

    // Build per-party rows
    const reportData = accounts.map(acc => {
      const key = String(acc.Name).trim();
      const target = targetMap[key] || null;
      const targetAmount = target ? target.targetAmount : 0;
      const received  = collectedByParty[key] || 0;
      const balance   = received < targetAmount ? targetAmount - received : 0;
      const excess    = received >= targetAmount && targetAmount > 0 ? received - targetAmount : 0;
      const performance = targetAmount > 0 ? parseFloat(((received / targetAmount) * 100).toFixed(2)) : 0;

      let status = 'No Target';
      if (targetAmount > 0) {
        if (performance >= 100) status = 'Achieved';
        else if (performance >= 70) status = 'Pending';
        else status = 'Below Target';
      }

      return { partyName: acc.Name, targetAmount, received, balance, excess, performance, status, targetId: target?._id, periodType, year: y, month: m, quarter: q };
    });

    const totalTarget   = reportData.reduce((s, r) => s + r.targetAmount, 0);
    const totalReceived = reportData.reduce((s, r) => s + r.received, 0);
    const totalBalance  = reportData.reduce((s, r) => s + r.balance, 0);
    const totalExcess   = reportData.reduce((s, r) => s + r.excess, 0);
    const achievement   = totalTarget > 0 ? parseFloat(((totalReceived / totalTarget) * 100).toFixed(2)) : 0;

    res.status(200).json({ success: true, summary: { totalTarget, totalReceived, totalBalance, totalExcess, achievement }, data: reportData });
  } catch (error) {
    console.error("Error generating collection target report:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getCollectionTargetHistory = async (req, res) => {
  try {
    const { partyName, targetType } = req.params;
    const companyId = req.user?.companyId;
    const companyFilter = { $or: [{ companyId }, { companyId: null }] };
    const partyId = String(partyName).trim();

    const history = await CollectionTarget
      .find({ partyId, targetType, ...companyFilter })
      .sort({ year: -1, month: -1, quarter: -1 })
      .lean();

    const dc = targetType === 'Customer' ? 'C' : 'D';
    const amountField = targetType === 'Customer' ? 'credit' : 'debit';

    const enriched = await Promise.all(history.map(async target => {
      let startDate, endDate;
      const { year, periodType, month, quarter } = target;
      if (periodType === 'Yearly') {
        startDate = new Date(year, 0, 1);
        endDate   = new Date(year, 11, 31, 23, 59, 59);
      } else if (periodType === 'Monthly') {
        startDate = new Date(year, month - 1, 1);
        endDate   = new Date(year, month, 0, 23, 59, 59);
      } else {
        startDate = new Date(year, (quarter - 1) * 3, 1);
        endDate   = new Date(year, quarter * 3, 0, 23, 59, 59);
      }

      const vouchers = await Voucher.find({ ...companyFilter, date: { $gte: startDate, $lte: endDate } }).lean();
      let received = 0;
      vouchers.forEach(v => {
        (v.rows || []).forEach(row => {
          if (row.dc === dc && String(row.account || '').trim() === partyId) {
            received += Number(row[amountField] || 0);
          }
        });
      });

      const performance = target.targetAmount > 0 ? parseFloat(((received / target.targetAmount) * 100).toFixed(2)) : 0;
      let status = 'No Target';
      if (target.targetAmount > 0) {
        if (performance >= 100) status = 'Achieved';
        else if (performance >= 70) status = 'Pending';
        else status = 'Below Target';
      }
      return { ...target, received, performance, status };
    }));

    res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    console.error("Error fetching collection target history:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ─── Customer Item Sales Report ─────────────────────────────────────────────

export const getCustomerItemSalesReport = async (req, res) => {
  try {
    const {
      customerName,
      dateFrom,
      dateTo,
      itemSearch,
      eye,
      sph,
      cyl,
      add,
    } = req.body;

    const companyId = req.user?.companyId;
    const companyFilter = { $or: [{ companyId }, { companyId: null }] };

    const startDate = dateFrom ? new Date(dateFrom) : new Date('2000-01-01');
    const endDate   = dateTo   ? new Date(dateTo)   : new Date();
    endDate.setHours(23, 59, 59, 999);

    const dateCriteria = { $gte: startDate, $lte: endDate };
    const dateFilter = {
      $or: [
        { 'billData.date': dateCriteria },
        { date: dateCriteria },
      ],
    };

    const partyFilter = customerName
      ? { 'partyData.partyAccount': { $regex: customerName, $options: 'i' } }
      : {};

    // Query sale invoice + sale challan (skip cancelled)
    const saleModels = [
      { model: LensSale,        type: 'Sale Invoice' },
      { model: LensSaleChallan, type: 'Sale Challan' },
    ];

    let allItems = [];

    for (const { model, type } of saleModels) {
      try {
        const docs = await model.find({
          ...dateFilter,
          ...partyFilter,
          ...companyFilter,
          status: { $ne: 'Cancelled' },
        }).lean();

        docs.forEach(doc => {
          const docDate   = doc.billData?.date || doc.date || doc.createdAt;
          const partyName = doc.partyData?.partyAccount || '';

          (doc.items || []).forEach(item => {
            const qty     = Number(item.qty || 0);
            const price   = Number(item.sellPrice || item.salePrice || 0);
            const revenue = Number(item.totalAmount || item.totalAmt || (qty * price) || 0);

            allItems.push({
              itemName:  String(item.itemName || '').trim(),
              eye:       item.eye   || '',
              sph:       Number(item.sph  || 0),
              cyl:       Number(item.cyl  || 0),
              axis:      Number(item.axis || 0),
              add:       Number(item.add  || 0),
              qty,
              revenue,
              date:      docDate,
              partyName,
              transType: type,
            });
          });
        });
      } catch (err) {
        console.error(`[CustomerItemSales] Error querying ${type}:`, err);
      }
    }

    // ── Item-level filters ──────────────────────────────────────────────────
    if (itemSearch) {
      const s = itemSearch.toLowerCase();
      allItems = allItems.filter(i => i.itemName.toLowerCase().includes(s));
    }
    if (eye && eye !== 'All')    allItems = allItems.filter(i => i.eye === eye);
    if (sph !== undefined && sph !== '') allItems = allItems.filter(i => i.sph === Number(sph));
    if (cyl !== undefined && cyl !== '') allItems = allItems.filter(i => i.cyl === Number(cyl));
    if (add !== undefined && add !== '') allItems = allItems.filter(i => i.add === Number(add));

    // ── Aggregate by itemName + power combination ──────────────────────────
    const grouped = {};
    allItems.forEach(item => {
      const key = `${item.itemName}||${item.eye}||${item.sph}||${item.cyl}||${item.axis}||${item.add}`;
      if (!grouped[key]) {
        grouped[key] = {
          itemName:     item.itemName,
          eye:          item.eye,
          sph:          item.sph,
          cyl:          item.cyl,
          axis:         item.axis,
          add:          item.add,
          totalQty:     0,
          totalRevenue: 0,
          lastSoldDate: null,
          orderCount:   0,
        };
      }
      grouped[key].totalQty     += item.qty;
      grouped[key].totalRevenue += item.revenue;
      grouped[key].orderCount   += 1;

      if (item.date) {
        const d = new Date(item.date);
        if (!grouped[key].lastSoldDate || d > new Date(grouped[key].lastSoldDate)) {
          grouped[key].lastSoldDate = d;
        }
      }
    });

    const reportData = Object.values(grouped)
      .sort((a, b) => b.totalQty - a.totalQty)
      .map(r => ({
        ...r,
        totalRevenue: parseFloat(r.totalRevenue.toFixed(2)),
        lastSoldDate: r.lastSoldDate
          ? new Date(r.lastSoldDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
          : null,
      }));

    const totalItems   = reportData.length;
    const totalQty     = reportData.reduce((s, r) => s + r.totalQty,     0);
    const totalRevenue = parseFloat(reportData.reduce((s, r) => s + r.totalRevenue, 0).toFixed(2));

    res.status(200).json({
      success: true,
      summary: { totalItems, totalQty, totalRevenue },
      data:    reportData,
    });
  } catch (error) {
    console.error('Error generating customer item sales report:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ─────────────────────────────────────────────
// SALES GROWTH COMPARISON REPORT
// ─────────────────────────────────────────────
export const getSalesGrowthComparisonReport = async (req, res) => {
  try {
    const { month, year, partyName } = req.body;
    const now = new Date();
    const refYear  = year  ? parseInt(year)  : now.getFullYear();
    const refMonth = month ? parseInt(month) : now.getMonth() + 1;

    const currStart = new Date(refYear, refMonth - 1, 1);
    const currEnd   = new Date(refYear, refMonth, 0, 23, 59, 59, 999);
    const prevMonthDate = new Date(refYear, refMonth - 2, 1);
    const prevStart = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1);
    const prevEnd   = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0, 23, 59, 59, 999);
    const lyStart = new Date(refYear - 1, refMonth - 1, 1);
    const lyEnd   = new Date(refYear - 1, refMonth, 0, 23, 59, 59, 999);

    const partyRegex = partyName && partyName.trim()
      ? new RegExp(partyName.trim(), 'i')
      : null;

    const aggregateSalesByParty = async (start, end) => {
      const matchStage = { 'billData.date': { $gte: start, $lte: end }, status: { $ne: 'Cancelled' } };
      if (partyRegex) matchStage['partyData.partyAccount'] = { $regex: partyRegex };
      const rows = await LensSale.aggregate([
        { $match: matchStage },
        { $group: { _id: '$partyData.partyAccount', totalSales: { $sum: '$netAmount' }, totalQty: { $sum: '$summary.totalQty' }, invoiceCount: { $sum: 1 } } }
      ]);
      const map = {};
      rows.forEach(r => { if (r._id) map[r._id] = { totalSales: r.totalSales || 0, totalQty: r.totalQty || 0, invoiceCount: r.invoiceCount || 0 }; });
      return map;
    };

    const [currMap, prevMap, lyMap] = await Promise.all([
      aggregateSalesByParty(currStart, currEnd),
      aggregateSalesByParty(prevStart, prevEnd),
      aggregateSalesByParty(lyStart, lyEnd),
    ]);

    const allParties = Array.from(new Set([...Object.keys(currMap), ...Object.keys(prevMap), ...Object.keys(lyMap)]));

    let data = allParties.map(party => {
      const curr = currMap[party]?.totalSales || 0;
      const prev = prevMap[party]?.totalSales || 0;
      const ly   = lyMap[party]?.totalSales   || 0;
      let momGrowth = null;
      if (prev === 0 && curr > 0) momGrowth = 100;
      else if (prev > 0) momGrowth = parseFloat(((curr - prev) / prev * 100).toFixed(2));
      let yoyGrowth = null;
      if (ly === 0 && curr > 0) yoyGrowth = 100;
      else if (ly > 0) yoyGrowth = parseFloat(((curr - ly) / ly * 100).toFixed(2));
      return {
        partyName: party,
        currSales: parseFloat(curr.toFixed(2)),
        prevSales: parseFloat(prev.toFixed(2)),
        lySales: parseFloat(ly.toFixed(2)),
        currQty: currMap[party]?.totalQty || 0,
        currInvoices: currMap[party]?.invoiceCount || 0,
        momGrowth,
        yoyGrowth,
        momStatus: momGrowth === null ? 'N/A' : momGrowth >= 0 ? 'Growth' : 'Degrowth',
        yoyStatus: yoyGrowth === null ? 'N/A' : yoyGrowth >= 0 ? 'Growth' : 'Degrowth',
      };
    });

    data.sort((a, b) => b.currSales - a.currSales);
    const currTotal = parseFloat(data.reduce((s, r) => s + r.currSales, 0).toFixed(2));
    const prevTotal = parseFloat(data.reduce((s, r) => s + r.prevSales, 0).toFixed(2));
    const lyTotal   = parseFloat(data.reduce((s, r) => s + r.lySales, 0).toFixed(2));
    const momGrowthPct = prevTotal > 0 ? parseFloat(((currTotal - prevTotal) / prevTotal * 100).toFixed(2)) : (currTotal > 0 ? 100 : 0);
    const yoyGrowthPct = lyTotal   > 0 ? parseFloat(((currTotal - lyTotal)   / lyTotal   * 100).toFixed(2)) : (currTotal > 0 ? 100 : 0);
    const fmtLabel = (y, m) => new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    const summary = {
      currTotal, prevTotal, lyTotal, momGrowthPct, yoyGrowthPct, refMonth, refYear,
      currLabel: fmtLabel(refYear, refMonth),
      prevLabel: fmtLabel(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1),
      lyLabel:   fmtLabel(refYear - 1, refMonth),
      growingParties:   data.filter(r => r.momStatus === 'Growth').length,
      degrowingParties: data.filter(r => r.momStatus === 'Degrowth').length,
    };
    res.status(200).json({ success: true, summary, data });
  } catch (error) {
    console.error('Error generating sales growth comparison report:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
