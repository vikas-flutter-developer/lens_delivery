import LensGroup from "../models/LensGroup.js";
import mongoose from "mongoose";
import SaleReturn from "../models/SaleReturn.js";
const aggregateItems = (items) => {
  const m = new Map();
  for (const it of items || []) {
    const cid = it.combinationId ? String(it.combinationId) : "";
    if (!cid) continue;
    if (!m.has(cid)) m.set(cid, { exampleItem: it, totalQty: 0 });
    const ent = m.get(cid);
    ent.totalQty += Number(it.qty) || 0;
    ent.exampleItem = it;
  }
  return m;
};
const addLensSaleReturn = async (req, res) => {
  try {
    const data = req.body;

    const items = (data.items || []).map((item) => ({
      barcode: item.barcode || "",
      itemName: item.itemName || "",
      unit: item.unit || "",
      dia: item.dia || "",
      eye: item.eye || "",
      sph: Number(item.sph) || 0,
      cyl: Number(item.cyl) || 0,
      axis: Number(item.axis) || 0,
      add: Number(item.add) || 0,
      qty: Number(item.qty) || 0,
      purchasePrice: Number(item.purchasePrice) || 0,
      salePrice: Number(item.salePrice) || 0,
      discount: Number(item.discount) || 0,
      totalAmount: Number(item.totalAmount) || 0,
      sellPrice: Number(item.sellPrice) || 0,
      combinationId: item.combinationId || "",
      remark: item.remark || "",
    }));

    const taxes = (data.taxes || []).map((tax) => ({
      taxName: tax.taxName || "",
      type: tax.type || "Additive",
      percentage: Number(tax.percentage) || 0,
      amount: Number(tax.amount) || 0,
      meta: tax.meta || {},
    }));

    const subtotal = items.reduce(
      (s, it) => s + (Number(it.totalAmount) || 0),
      0
    );
    const taxesAmount = taxes.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const netAmount = subtotal + taxesAmount;
    const paidAmount = Number(data.paidAmount) || 0;
    const dueAmount = netAmount - paidAmount;
    const grossAmount = items.reduce(
      (s, it) => s + (Number(it.qty) || 0) * (Number(it.salePrice) || 0),
      0
    );

    // aggregate per combination
    const ag = aggregateItems(items);

    const orderQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);

    // Validate existence of each combination and prepare parent+matched caches
    // Validate existence of each combination and prepare parent+matched caches
    const missing = [];
    const parentMap = new Map(); // ID -> document
    const matchedCache = new Map(); // combId -> { parent, matched }

    for (const [combId, entry] of ag.entries()) {
      const parent = await LensGroup.findOne({ "addGroups.combinations._id": combId });
      if (!parent) {
        missing.push({ combId, reason: "Combination parent not found" });
        continue;
      }

      // Cache unique parent by its ID to ensure we work on the same instance
      const parentId = String(parent._id);
      if (!parentMap.has(parentId)) {
        parentMap.set(parentId, parent);
      }
      const activeParent = parentMap.get(parentId);

      // resolve matched subdoc
      let matched = null;
      for (const agp of activeParent.addGroups || []) {
        matched = agp.combinations?.id?.(combId) ||
          (agp.combinations || []).find(c => String(c._id) === String(combId));
        if (matched) break;
      }

      if (!matched) {
        missing.push({ combId, reason: "Combination subdoc not found inside parent" });
        continue;
      }
      matchedCache.set(combId, { parent: activeParent, matched });
    }

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "One or more combinationIds are invalid",
        details: missing,
      });
    }

    // APPLY: Update stock in memory for all matched combinations
    for (const [combId, entry] of ag.entries()) {
      const { matched } = matchedCache.get(combId);
      const oldStock = Number(matched.initStock || 0);
      const addQty = Number(entry.totalQty || 0);
      matched.initStock = oldStock + addQty;
      console.log(`Memory Update: ${combId} stock ${oldStock} -> ${matched.initStock}`);
    }

    // SAVE: Save each unique parent document once
    for (const parent of parentMap.values()) {
      console.log(`Saving parent LensGroup: ${parent.productName} (${parent._id})`);
      await parent.save();
    }

    const newSaleReturn = new SaleReturn({
      billData: data.billData || {},
      partyData: data.partyData || {},
      items,
      taxes,
      grossAmount,
      subtotal,
      taxesAmount,
      netAmount,
      paidAmount,
      dueAmount,
      remark: data.remark || "",
      status: data.status || "Pending",
      orderQty,
      usedQty: 0,
      balQty: orderQty,
      companyId: req.user?.companyId || null,
    });

    console.log("Saving new SaleReturn document...");
    const savedSaleReturn = await newSaleReturn.save();
    console.log("Successfully saved new SaleReturn document.");

    return res.status(201).json({
      success: true,
      message: "Lens Sale Return added and stock updated successfully",
      data: savedSaleReturn,
    });
  } catch (err) {
    console.error("FULL ERROR IN addLensSaleReturn:", err);
    if (err.stack) console.error("STACK TRACE:", err.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to add lens sale return",
      error: err.message,
      stack: err.stack // Send stack to frontend briefly for debugging if needed
    });
  }
};


const getAllLensSaleReturn = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const saleReturns = await SaleReturn.find({ companyId }).sort({ createdAt: -1 })
    return res.status(200).json({
      success: true,
      data: saleReturns
    })
  } catch (err) {
    console.error("Error fetching lens sale Returns:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch lens sale returns",
      error: err.message,
    });
  }
};
const getLensSaleReturn = async (req, res) => {
  try {
    const { id } = req.body
    const companyId = req.user?.companyId;
    const salereturn = await SaleReturn.findOne({ _id: id, companyId })
    if (!salereturn) {
      return res.status(404).json({
        success: false,
        message: "Sale Return not found"
      })
    }
    return res.status(200).json({
      success: true,
      data: salereturn
    })
  } catch (err) {
    console.log(err)
    return res.status(500).json({
      success: false,
      message: "Failed to fetch lens sale returns",
      error: err.message,
    })
  }
};

const removeLensSaleReturn = async (req, res) => {
  try {
    const { id } = req.params
    const companyId = req.user?.companyId;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Sale return ID is required" });
    }
    const existing = await SaleReturn.findOne({ _id: id, companyId })
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Sale return not found" });
    }

    const qtyMap = aggregateItems(existing.items || []); // Map<combId, { totalQty }>

    // validate: ensure current stock >= qty to deduct for each
    const insufficient = [];
    const parentCache = new Map();
    const matchedCache = new Map();

    for (const [combId, entry] of qtyMap.entries()) {
      const needToDeduct = entry.totalQty;
      if (!needToDeduct) continue;

      const parent = await LensGroup.findOne(
        { "addGroups.combinations._id": combId }
      );
      if (!parent) {
        insufficient.push({ combId, reason: "Parent not found" });
        continue;
      }
      parentCache.set(combId, parent);

      let matched = null;
      for (const agp of parent.addGroups || []) {
        matched =
          agp.combinations?.id?.(combId) ||
          (agp.combinations || []).find(
            (c) => String(c._id) === String(combId)
          );
        if (matched) break;
      }
      if (!matched) {
        insufficient.push({ combId, reason: "Combination not found" });
        continue;
      }
      matchedCache.set(combId, { parent, matched });

      const currentStock = Number(matched.initStock || 0);
      if (currentStock < needToDeduct) {
        insufficient.push({
          combId,
          available: currentStock,
          required: needToDeduct,
        });
      }
    }

    if (insufficient.length > 0) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Cannot delete sale return: insufficient stock to rollback/deduct",
          details: insufficient,
        });
    }

    // apply 
    for (const [combId, entry] of qtyMap.entries()) {
      const { parent, matched } = matchedCache.get(combId);
      if (!matched) continue;
      const oldStock = Number(matched.initStock || 0);
      const newStock = oldStock + entry.totalQty;
      if (newStock < 0) {
        return res
          .status(500)
          .json({
            success: false,
            message: `Unexpected negative stock for ${combId}`,
          });
      }
      matched.initStock = newStock;
      await parent.save();
    }

    await SaleReturn.findByIdAndDelete(id);

    return res
      .status(200)
      .json({
        success: true,
        message: "sale return deleted and stock adjusted successfully",
        data: existing,
      });
  } catch (err) {
    console.error("Error removing lens sale return:", err);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to delete Sale Return",
        error: err.message,
      });
  }
};

const editLensSaleReturn = async (req, res) => {
  try {
    const { id } = req.params
    const data = req.body
    const companyId = req.user?.companyId;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Sale Return ID is required" });
    }
    const existing = await SaleReturn.findOne({ _id: id, companyId })
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Sale Return not found" });
    }

    const newItems = (data.items || []).map((item) => ({
      barcode: item.barcode || "",
      itemName: item.itemName || "",
      unit: item.unit || "",
      dia: item.dia || "",
      eye: item.eye || "",
      sph: Number(item.sph) || 0,
      cyl: Number(item.cyl) || 0,
      axis: Number(item.axis) || 0,
      add: Number(item.add) || 0,
      qty: Number(item.qty) || 0,
      purchasePrice: Number(item.purchasePrice) || 0,
      salePrice: Number(item.salePrice) || 0,
      discount: Number(item.discount) || 0,
      totalAmount: Number(item.totalAmount) || 0,
      sellPrice: Number(item.sellPrice) || 0,
      combinationId: item.combinationId || item.CombinationId || "",
      remark: item.remark || "",
    }))

    const taxes = (data.taxes || []).map((tax) => ({
      taxName: tax.taxName || "",
      type: tax.type || "Additive",
      percentage: Number(tax.percentage) || 0,
      amount: Number(tax.amount) || 0,
      meta: tax.meta || {},
    }))

    const grossAmount = newItems.reduce((g, it) => g + (Number(it.qty) || 0) * (Number((it.salePrice) || 0)), 0)
    const subtotal = newItems.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0)
    const taxesAmount = newItems.reduce((t, tax) => t + (Number(tax.amount) || 0), 0)
    const netAmount = subtotal + taxesAmount
    const paidAmount = Number(data.paidAmount) || 0;
    const dueAmount = netAmount - paidAmount;

    const orderQty = newItems.reduce((s, it) => s + (Number(it.qty) || 0), 0);
    existing.orderQty = orderQty;
    existing.balQty = Math.max(0, orderQty - (existing.usedQty || 0));
    // aggregate old and new
    const oldMap = aggregateItems(existing.items || []);
    const newMap = aggregateItems(newItems);

    // compute diffs: diff = new - old
    // positive => add to stock, negative => deduct from stock
    const adjustments = new Map(); // combId -> { diff, exampleItem }
    for (const [combId, oldEntry] of oldMap.entries()) {
      const oldQty = oldEntry.totalQty;
      const newEntry = newMap.get(combId);
      const newQty = newEntry ? newEntry.totalQty : 0;
      const diff = newQty - oldQty;
      if (diff !== 0)
        adjustments.set(combId, {
          diff,
          exampleItem: newEntry ? newEntry.exampleItem : oldEntry.exampleItem,
        });
    }
    // combos only in new
    for (const [combId, newEntry] of newMap.entries()) {
      if (oldMap.has(combId)) continue;
      const diff = newEntry.totalQty; // new - 0
      if (diff !== 0)
        adjustments.set(combId, { diff, exampleItem: newEntry.exampleItem });
    }

    // if no adjustments -> just update meta
    if (adjustments.size === 0) {
      existing.billData = data.billData || existing.billData || {};
      existing.partyData = data.partyData || existing.partyData || {};
      existing.items = newItems;
      existing.taxes = taxes;
      existing.grossAmount = grossAmount;
      existing.subtotal = subtotal;
      existing.taxesAmount = taxesAmount;
      existing.netAmount = netAmount;
      existing.paidAmount = paidAmount;
      existing.dueAmount = dueAmount;
      existing.remark = data.remark || existing.remark || "";
      existing.status = data.status || existing.status || "Pending";
      const updated = await existing.save();
      return res
        .status(200)
        .json({
          success: true,
          message: "Sale Return updated (no stock changes)",
          data: updated,
        });
    }

    // validation: for any negative diffs (deductions), ensure enough stock exists
    const insufficient = [];
    const parentCache = new Map();
    const matchedCache = new Map();

    for (const [combId, adj] of adjustments.entries()) {
      const diff = adj.diff;
      if (diff >= 0) continue; // only check when deducting (diff < 0)
      const needToDeduct = -diff;

      const parent = await LensGroup.findOne(
        { "addGroups.combinations._id": combId }
      );
      if (!parent) {
        insufficient.push({ combId, reason: "Combination parent not found" });
        continue;
      }
      parentCache.set(combId, parent);

      // find matched subdoc
      let matched = null;
      for (const agp of parent.addGroups || []) {
        matched =
          agp.combinations?.id?.(combId) ||
          (agp.combinations || []).find(
            (c) => String(c._id) === String(combId)
          );
        if (matched) break;
      }
      if (!matched) {
        insufficient.push({ combId, reason: "Combination subdoc not found" });
        continue;
      }
      matchedCache.set(combId, { parent, matched });

      const currentStock = Number(matched.initStock || 0);
      if (currentStock < needToDeduct) {
        insufficient.push({
          combId,
          available: currentStock,
          required: needToDeduct,
        });
      }
    }

    if (insufficient.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot apply edit: insufficient stock for deduction(s)",
        details: insufficient,
      });
    }

    // APPLY adjustments
    for (const [combId, adj] of adjustments.entries()) {
      const diff = adj.diff; // positive add, negative deduct
      let parent = parentCache.get(combId);
      let matchedEntry = matchedCache.get(combId);

      if (!parent) {
        parent = await LensGroup.findOne(
          { "addGroups.combinations._id": combId }
        );
        if (!parent) {
          console.warn("Skipping adjustment (parent not found):", combId);
          continue;
        }
        let matched = null;
        for (const agp of parent.addGroups || []) {
          matched =
            agp.combinations?.id?.(combId) ||
            (agp.combinations || []).find(
              (c) => String(c._id) === String(combId)
            );
          if (matched) break;
        }
        if (!matched) {
          console.warn("Skipping adjustment (matched not found):", combId);
          continue;
        }
        matchedEntry = { parent, matched };
      }

      const { matched } = matchedEntry;
      const oldStock = Number(matched.initStock || 0);
      const newStock = oldStock + diff;

      if (newStock < 0) {
        return res
          .status(500)
          .json({
            success: false,
            message: `Unexpected negative stock for ${combId}`,
          });
      }

      matched.initStock = newStock;
      await matchedEntry.parent.save();
      console.log(
        `Sale Return EDIT: ${combId} ${oldStock} -> ${newStock} (diff ${diff})`
      );
    }

    // update sale return doc
    existing.billData = data.billData || existing.billData || {};
    existing.partyData = data.partyData || existing.partyData || {};
    existing.items = newItems;
    existing.taxes = taxes;
    existing.grossAmount = grossAmount;
    existing.subtotal = subtotal;
    existing.taxesAmount = taxesAmount;
    existing.netAmount = netAmount;
    existing.paidAmount = paidAmount;
    existing.dueAmount = dueAmount;
    existing.remark = data.remark || existing.remark || "";
    existing.status = data.status || existing.status || "Pending";

    const updated = await existing.save();

    return res
      .status(200)
      .json({
        success: true,
        message: "Sale Return updated successfully",
        data: updated,
      });
  } catch (err) {
    console.error("Error editing lens Sale Return:", err);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to edit Sale Return",
        error: err.message,
      });
  }
};

const getNextBillNumber = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(400).json({ success: false, message: "Company ID is required" });
    }

    // Filter by companyId
    const allReturns = await SaleReturn.find({ companyId })
      .select("billData.billNo")
      .lean();

    let maxNo = 0;
    allReturns.forEach(r => {
      const val = r.billData?.billNo;
      if (val) {
        const matches = String(val).match(/\d+/g);
        if (matches) {
          for (const m of matches) {
            const n = parseInt(m);
            if (!isNaN(n) && n > maxNo) maxNo = n;
          }
        }
      }
    });

    const nextBillNumber = maxNo + 1;

    return res.status(200).json({
      success: true,
      nextBillNumber,
      count: allReturns.length
    });
  } catch (err) {
    console.error("Error fetching next bill number for Sale Return:", err);
    return res.status(200).json({
      success: false,
      message: "Failed to fetch next bill number",
      nextBillNumber: 1
    });
  }
};

const updateReturnQuantities = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderQty, usedQty } = req.body;
    const existing = await SaleReturn.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: "Not found" });

    if (orderQty !== undefined) existing.orderQty = Number(orderQty);
    if (usedQty !== undefined) existing.usedQty = Number(usedQty);

    const o = existing.orderQty || 0;
    const u = existing.usedQty || 0;
    existing.balQty = Math.max(0, o - u);

    await existing.save();
    return res.status(200).json({ success: true, message: "Quantities updated", data: existing });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export {
  addLensSaleReturn,
  getLensSaleReturn,
  getAllLensSaleReturn,
  removeLensSaleReturn,
  editLensSaleReturn,
  getNextBillNumber,
  updateReturnQuantities,
};
