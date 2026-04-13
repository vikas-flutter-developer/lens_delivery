import LensGroup from "../models/LensGroup.js";
import mongoose from "mongoose";
import PurchaseReturn from "../models/PurchaseReturn.js";

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

const getInternalNextBillNo = async (series, companyId) => {
  try {
    // Filter by companyId to allow per-company sequential numbering
    const allReturns = await PurchaseReturn.find({ companyId })
      .select("billData.billNo")
      .lean();

    console.log(`[PR-BillGen] Found ${allReturns.length} existing records for company ${companyId}.`);

    let maxNo = 0;
    for (const r of allReturns) {
      const val = r.billData?.billNo;
      if (!val) continue;

      const matches = String(val).match(/\d+/g);
      if (matches) {
        for (const m of matches) {
          const n = parseInt(m);
          if (!isNaN(n) && n > maxNo) maxNo = n;
        }
      }
    }

    const result = String(maxNo + 1);
    console.log(`[PR-BillGen] Max number found: ${maxNo}, Next: ${result}`);
    return result;
  } catch (err) {
    console.error("getInternalNextBillNo error:", err);
    return "1";
  }
};

const addLensPurchaseReturn = async (req, res) => {
  try {
    const data = req.body;
    const companyId = req.user?.companyId;

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

    const subtotal = items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0);
    const taxesAmount = taxes.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const netAmount = subtotal + taxesAmount;
    const paidAmount = Number(data.paidAmount) || 0;
    const dueAmount = netAmount - paidAmount;
    const grossAmount = items.reduce(
      (s, it) => s + (Number(it.qty) || 0) * (Number(it.purchasePrice) || 0),
      0
    );

    const orderQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);

    // Aggregate quantities per combinationId
    const ag = aggregateItems(items);

    // parentMap: ID -> document
    const parentMap = new Map();
    // matchedUpdates: list of { matched, subQty } where matched is a subdoc from the parent in parentMap
    const updatesToApply = [];

    for (const [combId, entry] of ag.entries()) {
      if (!combId || !mongoose.Types.ObjectId.isValid(combId)) {
        console.warn(`Purchase Return: invalid combinationId ${combId} — skipping stock update`);
        continue;
      }

      const parentDoc = await LensGroup.findOne({ "addGroups.combinations._id": combId });
      if (!parentDoc) {
        console.warn(`Purchase Return: combinationId ${combId} not found in LensGroup — skipping stock update`);
        continue;
      }

      const parentId = String(parentDoc._id);
      if (!parentMap.has(parentId)) {
        parentMap.set(parentId, parentDoc);
      }
      const activeParent = parentMap.get(parentId);

      let matched = null;
      for (const agp of activeParent.addGroups || []) {
        matched = agp.combinations.id(combId);
        if (matched) break;
      }

      if (!matched) {
        console.warn(`Purchase Return: combination subdoc ${combId} not found in parent — skipping stock update`);
        continue;
      }

      updatesToApply.push({ matched, subQty: entry.totalQty });
    }

    // Apply all updates in memory
    for (const { matched, subQty } of updatesToApply) {
      const oldStock = Number(matched.initStock || 0);
      matched.initStock = oldStock - subQty;
      console.log(`Purchase Return SUB Memory: ${matched._id} ${oldStock} -> ${matched.initStock} (subtracted ${subQty})`);
    }

    // Save each unique parent document ONCE
    for (const parent of parentMap.values()) {
      await parent.save();
    }

    // Handle Bill Number generation if missing
    let billData = data.billData || {};
    if (!billData.billNo) {
      billData.billNo = await getInternalNextBillNo(billData.billSeries || "", companyId);
    }

    const newPurchaseReturn = new PurchaseReturn({
      billData,
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
      dcId: data.dcId || "",
      companyId,
    });

    const savedPurchaseReturn = await newPurchaseReturn.save();

    return res.status(201).json({
      success: true,
      message: "Lens Purchase Return added and stock updated successfully",
      data: savedPurchaseReturn,
    });
  } catch (err) {
    console.error("Error adding lens purchase return:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to add lens purchase return",
      error: err.message,
      stack: err.stack,
      details: "Check backend console for full stack trace"
    });
  }
};



const getAllLensPurchaseReturn = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const purchaseReturns = await PurchaseReturn.find({ companyId }).sort({ createdAt: -1 })
    return res.status(200).json({
      success: true,
      data: purchaseReturns
    })
  } catch (err) {
    console.error("Error fetching lens purchase Returns:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch lens purchase returns",
      error: err.message,
    });
  }
};

const getLensPurchaseReturn = async (req, res) => {
  try {
    const { id } = req.body;
    const companyId = req.user?.companyId;
    const purchasereturn = await PurchaseReturn.findOne({ _id: id, companyId });
    if (!purchasereturn) {
      return res.status(404).json({
        success: false,
        message: "Purchase Return not found"
      })
    }
    return res.status(200).json({
      success: true,
      data: purchasereturn
    })
  } catch (err) {
    console.log(err)
    return res.status(500).json({
      success: false,
      message: "Failed to fetch lens Purchase returns",
      error: err.message,
    })
  }
};

const removeLensPurchaseReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Purchase return ID is required" });
    }
    const existing = await PurchaseReturn.findOne({ _id: id, companyId });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Purchase return not found" });
    }

    const qtyMap = aggregateItems(existing.items || []);

    const parentMap = new Map();
    const updatesToApply = [];

    for (const [combId, entry] of qtyMap.entries()) {
      if (!combId || !mongoose.Types.ObjectId.isValid(combId)) continue;
      const parentDoc = await LensGroup.findOne({ "addGroups.combinations._id": combId });
      if (!parentDoc) continue;

      const parentId = String(parentDoc._id);
      if (!parentMap.has(parentId)) {
        parentMap.set(parentId, parentDoc);
      }
      const activeParent = parentMap.get(parentId);

      let matched = activeParent.addGroups.reduce((found, agp) => found || agp.combinations.id(combId), null);
      if (matched) {
        updatesToApply.push({ matched, addQty: entry.totalQty });
      }
    }

    // Apply restitution (add back returned qty)
    for (const { matched, addQty } of updatesToApply) {
      matched.initStock = (Number(matched.initStock) || 0) + addQty;
    }

    // Save each parent once
    for (const parent of parentMap.values()) {
      await parent.save();
    }

    await PurchaseReturn.findOneAndDelete({ _id: id, companyId });

    return res.status(200).json({
      success: true,
      message: "purchase return deleted and stock adjusted successfully",
      data: existing,
    });
  } catch (err) {
    console.error("Error removing lens purchase return:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete Purchase Return",
      error: err.message,
    });
  }
};

const editLensPurchaseReturn = async (req, res) => {
  try {
    const { id } = req.params
    const data = req.body
    const companyId = req.user?.companyId;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Purchase Return ID is required" });
    }
    const existing = await PurchaseReturn.findOne({ _id: id, companyId });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Purchase Return not found" });
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

    const grossAmount = newItems.reduce((g, it) => g + (Number(it.qty) || 0) * (Number((it.purchasePrice) || 0)), 0)
    const subtotal = newItems.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0)
    const taxesAmount = newItems.reduce((t, tax) => t + (Number(tax.amount) || 0), 0)
    const netAmount = subtotal + taxesAmount
    const paidAmount = Number(data.paidAmount) || 0;
    const dueAmount = netAmount - paidAmount;

    const orderQty = newItems.reduce((s, it) => s + (Number(it.qty) || 0), 0);

    // aggregate old and new
    const oldMap = aggregateItems(existing.items || []);
    const newMap = aggregateItems(newItems);

    // compute diffs: diff = new - old
    const adjustments = new Map();
    for (const [combId, oldEntry] of oldMap.entries()) {
      const oldQty = oldEntry.totalQty;
      const newEntry = newMap.get(combId);
      const newQty = newEntry ? newEntry.totalQty : 0;
      const diff = newQty - oldQty;
      if (diff !== 0) adjustments.set(combId, { diff });
    }
    for (const [combId, newEntry] of newMap.entries()) {
      if (oldMap.has(combId)) continue;
      adjustments.set(combId, { diff: newEntry.totalQty });
    }

    // APPLY adjustments with parentMap batching
    const parentMap = new Map();
    const updatesToApply = [];

    for (const [combId, adj] of adjustments.entries()) {
      if (!combId || !mongoose.Types.ObjectId.isValid(combId)) continue;
      const parentDoc = await LensGroup.findOne({ "addGroups.combinations._id": combId });
      if (!parentDoc) continue;

      const parentId = String(parentDoc._id);
      if (!parentMap.has(parentId)) {
        parentMap.set(parentId, parentDoc);
      }
      const activeParent = parentMap.get(parentId);

      let matched = activeParent.addGroups.reduce((found, agp) => found || agp.combinations.id(combId), null);
      if (matched) {
        updatesToApply.push({ matched, diff: adj.diff });
      }
    }

    for (const { matched, diff } of updatesToApply) {
      matched.initStock = (Number(matched.initStock) || 0) - diff;
    }

    for (const parent of parentMap.values()) {
      await parent.save();
    }

    // update return doc
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
    existing.orderQty = orderQty;
    existing.balQty = Math.max(0, orderQty - (existing.usedQty || 0));
    existing.dcId = data.dcId || existing.dcId || "";

    const updated = await existing.save();

    return res.status(200).json({
      success: true,
      message: "Purchase Return updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Error editing lens Purchase Return:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to edit Purchase Return",
      error: err.message,
    });
  }
};


const getNextBillNumber = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    // Filter by companyId
    const allReturns = await PurchaseReturn.find({ companyId })
      .select("billData.billNo")
      .lean();

    let maxNo = 0;
    for (const r of allReturns) {
      const val = r.billData?.billNo;
      if (!val) continue;

      const matches = String(val).match(/\d+/g);
      if (matches) {
        for (const m of matches) {
          const n = parseInt(m);
          if (!isNaN(n) && n > maxNo) maxNo = n;
        }
      }
    }
    const nextBillNumber = maxNo + 1;
    console.log(`[PR-API-BillGen] Found ${allReturns.length} records for company ${companyId}, Max: ${maxNo}, Next: ${nextBillNumber}`);

    return res.status(200).json({
      success: true,
      nextBillNumber,
    });
  } catch (err) {
    console.error("Error fetching next bill number for Purchase Return:", err);
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
    const { orderQty, usedQty, dcId } = req.body;
    const companyId = req.user?.companyId;

    const existing = await PurchaseReturn.findOne({ _id: id, companyId });
    if (!existing) return res.status(404).json({ success: false, message: "Not found" });

    if (orderQty !== undefined) existing.orderQty = Number(orderQty);
    if (usedQty !== undefined) existing.usedQty = Number(usedQty);
    if (dcId !== undefined) existing.dcId = dcId;

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
  addLensPurchaseReturn,
  getLensPurchaseReturn,
  getAllLensPurchaseReturn,
  removeLensPurchaseReturn,
  editLensPurchaseReturn,
  getNextBillNumber,
  updateReturnQuantities,
};
