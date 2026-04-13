import LensPurchase from "../models/LensPurchase.js";
import LensGroup from "../models/LensGroup.js";
import mongoose from "mongoose";

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

const addLensPurchase = async (req, res) => {
  try {
    const data = req.body;

    // Prepare items
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
      orderNo: item.orderNo || "",
      remark: item.remark || "",
    }));

    // Taxes
    const taxes = (data.taxes || []).map((tax) => ({
      taxName: tax.taxName || "",
      type: tax.type || "Additive",
      percentage: Number(tax.percentage) || 0,
      amount: Number(tax.amount) || 0,
      meta: tax.meta || {},
    }));

    // Compute totals
    const subtotal = items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0);
    const taxesAmount = taxes.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const netAmount = subtotal + taxesAmount;
    const paidAmount = Number(data.paidAmount) || 0;
    const dueAmount = netAmount - paidAmount;
    const grossAmount = items.reduce(
      (s, it) => s + (Number(it.qty) || 0) * (Number(it.purchasePrice) || 0),
      0
    );

    // Aggregate summary for purchase doc
    const totalQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
    const totalAmount = items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0);

    // aggregate per combination for stock update
    const ag = aggregateItems(items);

    const missing = [];
    const parentCache = new Map();
    const matchedCache = new Map();

    for (const [combId, entry] of ag.entries()) {
      const parent = await LensGroup.findOne(
        { "addGroups.combinations._id": combId }
      );
      if (!parent) {
        missing.push({ combId, reason: "Combination parent not found" });
        continue;
      }
      parentCache.set(combId, parent);

      let matched = null;
      for (const agp of parent.addGroups || []) {
        matched =
          agp.combinations?.id?.(combId) ||
          (agp.combinations || []).find((c) => String(c._id) === String(combId));
        if (matched) break;
      }
      if (!matched) {
        missing.push({
          combId,
          reason: "Combination subdoc not found inside parent",
        });
        continue;
      }
      matchedCache.set(combId, { parent, matched });
    }

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "One or more combinationIds are invalid",
        details: missing,
      });
    }

    // Update stock
    for (const [combId, entry] of ag.entries()) {
      const { parent, matched } = matchedCache.get(combId);
      const oldStock = Number(matched.initStock || 0);
      const addQty = Number(entry.totalQty || 0);
      matched.initStock = oldStock + addQty;
      await parent.save();
      console.log(`PURCHASE ADD: ${combId} ${oldStock} -> ${matched.initStock} (added ${addQty})`);
    }

    // Create purchase doc with summary
    const newPurchase = new LensPurchase({
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
      summary: { totalQty, totalAmount }, // <-- auto-set summary
      remark: data.remark || "",
      status: data.status || "Pending",
    });

    const savedPurchase = await newPurchase.save();

    return res.status(201).json({
      success: true,
      message: "Lens purchase added and stock updated successfully",
      data: savedPurchase,
    });
  } catch (err) {
    console.error("Error adding lens purchase:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to add lens purchase",
      error: err.message,
    });
  }
};


const getAllLensPurchase = async (req, res) => {
  try {
    const purchases = await LensPurchase.find().sort({ createdAt: -1 }); // latest first
    res.status(200).json({
      success: true,
      data: purchases,
    });
  } catch (err) {
    console.error("Error fetching lens purchases:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch lens purchases",
      error: err.message,
    });
  }
};

const getLensPurchase = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Purchase ID is required" });
    }

    const purchase = await LensPurchase.findById(id);

    if (!purchase) {
      return res
        .status(404)
        .json({ success: false, message: "Lens purchase not found" });
    }

    return res.status(200).json({ success: true, data: purchase });
  } catch (err) {
    console.error("Error fetching lens purchase:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

const editLensPurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "Purchase ID is required" });
    }

    const existing = await LensPurchase.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Purchase not found" });
    }

    // map items
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
      orderNo: item.orderNo || "",
      remark: item.remark || "",
    }));

    // map taxes
    const taxes = (data.taxes || []).map((tax) => ({
      taxName: tax.taxName || "",
      type: tax.type || "Additive",
      percentage: Number(tax.percentage) || 0,
      amount: Number(tax.amount) || 0,
      meta: tax.meta || {},
    }));

    // totals
    const subtotal = newItems.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0);
    const taxesAmount = taxes.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const netAmount = subtotal + taxesAmount;
    const paidAmount = Number(data.paidAmount) || 0;
    const dueAmount = netAmount - paidAmount;
    const grossAmount = newItems.reduce(
      (s, it) => s + (Number(it.qty) || 0) * (Number(it.purchasePrice) || 0),
      0
    );

    // aggregate old and new
    const oldMap = aggregateItems(existing.items || []);
    const newMap = aggregateItems(newItems);

    // compute adjustments
    const adjustments = new Map();
    for (const [combId, oldEntry] of oldMap.entries()) {
      const oldQty = oldEntry.totalQty;
      const newEntry = newMap.get(combId);
      const newQty = newEntry ? newEntry.totalQty : 0;
      const diff = newQty - oldQty;
      if (diff !== 0)
        adjustments.set(combId, { diff, exampleItem: newEntry ? newEntry.exampleItem : oldEntry.exampleItem });
    }
    for (const [combId, newEntry] of newMap.entries()) {
      if (oldMap.has(combId)) continue;
      const diff = newEntry.totalQty;
      if (diff !== 0) adjustments.set(combId, { diff, exampleItem: newEntry.exampleItem });
    }

    // if no adjustments -> just update purchase meta
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

      // add summary
      existing.summary = {
        totalQty: newItems.reduce((s, it) => s + (it.qty || 0), 0),
        totalAmount: newItems.reduce((s, it) => s + (it.totalAmount || 0), 0),
      };

      const updated = await existing.save();
      return res.status(200).json({
        success: true,
        message: "Purchase updated (no stock changes)",
        data: updated,
      });
    }

    // validate stock for deductions
    const insufficient = [];
    const parentCache = new Map();
    const matchedCache = new Map();

    for (const [combId, adj] of adjustments.entries()) {
      const diff = adj.diff;
      if (diff >= 0) continue; // only negative diffs
      const needToDeduct = -diff;

      const parent = await LensGroup.findOne(
        { "addGroups.combinations._id": combId }
      );
      if (!parent) {
        insufficient.push({ combId, reason: "Combination parent not found" });
        continue;
      }
      parentCache.set(combId, parent);

      let matched = null;
      for (const agp of parent.addGroups || []) {
        matched = agp.combinations?.id?.(combId) || (agp.combinations || []).find((c) => String(c._id) === String(combId));
        if (matched) break;
      }
      if (!matched) {
        insufficient.push({ combId, reason: "Combination subdoc not found" });
        continue;
      }
      matchedCache.set(combId, { parent, matched });

      const currentStock = Number(matched.initStock || 0);
      if (currentStock < needToDeduct) {
        insufficient.push({ combId, available: currentStock, required: needToDeduct });
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
      const diff = adj.diff;
      let parent = parentCache.get(combId);
      let matchedEntry = matchedCache.get(combId);

      if (!parent || !matchedEntry) {
        console.warn("Skipping adjustment (parent/matched not found):", combId);
        continue;
      }

      const { matched } = matchedEntry;
      const oldStock = Number(matched.initStock || 0);
      const newStock = oldStock + diff;
      if (newStock < 0) {
        return res.status(500).json({
          success: false,
          message: `Unexpected negative stock for ${combId}`,
        });
      }
      matched.initStock = newStock;
      await matchedEntry.parent.save();
      console.log(`PURCHASE EDIT: ${combId} ${oldStock} -> ${newStock} (diff ${diff})`);
    }

    // update purchase doc
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

    // add summary
    existing.summary = {
      totalQty: newItems.reduce((s, it) => s + (it.qty || 0), 0),
      totalAmount: newItems.reduce((s, it) => s + (it.totalAmount || 0), 0),
    };

    const updated = await existing.save();

    return res.status(200).json({
      success: true,
      message: "Purchase updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Error editing lens purchase:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to edit purchase",
      error: err.message,
    });
  }
};


const removeLensPurchase = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Purchase ID is required" });
    }

    const existing = await LensPurchase.findById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Purchase not found" });
    }

    // aggregate qty per combination
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
            "Cannot delete purchase: insufficient stock to rollback/deduct",
          details: insufficient,
        });
    }

    // apply deductions
    for (const [combId, entry] of qtyMap.entries()) {
      const { parent, matched } = matchedCache.get(combId);
      if (!matched) continue;
      const oldStock = Number(matched.initStock || 0);
      const newStock = oldStock - entry.totalQty;
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

    await LensPurchase.findByIdAndDelete(id);

    return res
      .status(200)
      .json({
        success: true,
        message: "Purchase deleted and stock adjusted successfully",
        data: existing,
      });
  } catch (err) {
    console.error("Error removing lens purchase:", err);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to delete purchase",
        error: err.message,
      });
  }
};

const patchLensPurchaseDcId = async (req, res) => {
  try {
    const { id } = req.params;
    const { dcId } = req.body;
    if (!id) return res.status(400).json({ success: false, message: "ID required" });
    const updated = await LensPurchase.findByIdAndUpdate(
      id,
      { $set: { dcId: dcId || "" } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: "Invoice not found" });
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("Error patching invoice dcId:", err);
    return res.status(500).json({ success: false, message: "Failed to update DC ID", error: err.message });
  }
};

export {
  addLensPurchase,
  getLensPurchase,
  getAllLensPurchase,
  removeLensPurchase,
  editLensPurchase,
  patchLensPurchaseDcId,
};
