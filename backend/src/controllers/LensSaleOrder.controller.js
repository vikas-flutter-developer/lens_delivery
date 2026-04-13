// controllers/LensSale.controller.js
import LensSale from "../models/LensSale.js";
import LensGroup from "../models/LensGroup.js";
import LensSaleOrder from "../models/LensSaleOrder.js";
import LensSaleChallan from "../models/LensSaleChallan.js"
import mongoose from "mongoose";
import {
  deriveOrderStatus,
  initializeItemStatuses,
  updateItemStatuses,
  recalculateDocStatus
} from "../utils/statusManager.js";
import {
  validateStockAvailability,
  deductStock,
  restoreStock,
  adjustStockForEdit
} from "../utils/stockDeductionHelper.js";
import { validateAccountLimitsHelper } from "../utils/accountValidator.js";
const addLensSaleOrder = async (req, res) => {
  try {
    const data = req.body;
    let totalqty = 0;
    const items = (data.items || []).map((item) => {
      totalqty = item.qty + totalqty;
      return {
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
        isInvoiced: false,
        salePrice: Number(item.salePrice) || 0,
        discount: Number(item.discount) || 0,
        totalAmount: Number(item.totalAmount) || 0,
        sellPrice: Number(item.sellPrice) || 0,
        combinationId: item.combinationId || "",
        orderNo: item.orderNo || "",
        remark: item.remark || "",
        vendor: item.vendor || "",
        partyName: item.partyName || "",
        // Initialize all items with "Pending" status
        itemStatus: "Pending",
      };
    });

    const taxes = (data.taxes || []).map((tax) => ({
      taxName: tax.taxName || "",
      type: tax.type || "Additive",
      percentage: Number(tax.percentage) || 0,
      amount: Number(tax.amount) || 0,
      meta: tax.meta || {},
    }));

    if (!items.length) {
      return res.status(400).json({
        success: false,
        message: "At least one sale order item is required",
      });
    }
    const subtotal = items.reduce(
      (sum, it) => sum + (Number(it.totalAmount) || 0),
      0
    );

    const taxesAmount = taxes.reduce(
      (sum, t) => sum + (Number(t.amount) || 0),
      0
    );

    const orderQty = totalqty;
    const balQty = orderQty;

    const netAmount = subtotal + taxesAmount;
    const paidAmount = Number(data.paidAmount) || 0;
    const dueAmount = netAmount - paidAmount;

    const grossAmount = items.reduce(
      (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.salePrice) || 0),
      0
    );

    // Initialize all items with "Pending" status
    const itemsWithStatus = items.map(item => ({
      ...item,
      itemStatus: item.itemStatus || "Pending"
    }));

    // Derive order status from items
    const orderStatus = deriveOrderStatus(itemsWithStatus, data.status || "Pending");

    const newOrder = new LensSaleOrder({
      companyId: req.user?.companyId,
      billData: data.billData || {},
      partyData: data.partyData || {},
      items: itemsWithStatus,
      taxes,
      orderQty,
      balQty,
      grossAmount,
      subtotal,
      taxesAmount,
      netAmount,
      paidAmount,
      dueAmount,
      deliveryDate: data.deliveryDate || Date.now(),
      remark: data.remark || "",
      status: orderStatus,
      parentStatus: orderStatus,
    });

    const savedOrder = await newOrder.save();

    // ── Stock Deduction ──────────────────────────────────────────────────────────
    // Validate and deduct stock. Non-blocking: log but don't fail the order if
    // a stock record is missing.
    try {
      const companyId = req.user?.companyId || null;
      const stockValidation = await validateStockAvailability(itemsWithStatus, companyId);
      if (!stockValidation.valid) {
        // Roll back saved order and inform the client
        await LensSaleOrder.findByIdAndDelete(savedOrder._id);
        const messages = stockValidation.errors.map(e => e.message).join(" | ");
        return res.status(400).json({
          success: false,
          message: "Insufficient stock: " + messages,
          stockErrors: stockValidation.errors,
        });
      }
      await deductStock(itemsWithStatus, companyId);
    } catch (stockErr) {
      console.error("[Stock] Deduction error (non-fatal):", stockErr.message);
    }
    // ─────────────────────────────────────────────────────────────────────────────

    return res.status(201).json({
      success: true,
      message: "Sale Order added successfully",
      data: savedOrder,
    });
  } catch (err) {
    console.error("❌ Error adding sale challan:", {
      message: err.message,
      stack: err.stack,
      code: err.code,
      keyPattern: err.keyPattern,
      name: err.name
    });

    // Check for validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        error: errors.join(', '),
        details: err.errors
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to add sale order",
      error: err.message,
    });
  }
};

const getAllLensSaleOrder = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const saleOrders = await LensSaleOrder.find({
      $or: [
        { companyId },
        { companyId: null }
      ]
    }).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      data: saleOrders,
    });
  } catch (err) {
    console.error("Error fetching lens sale Orders:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch lens sales",
      error: err.message,
    });
  }
};

const getLensSaleOrder = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Sale ID is required" });
    }
    let saleOrder = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      saleOrder = await LensSaleOrder.findById(id);
    }
    if (!saleOrder) {
      saleOrder = await LensSaleOrder.findOne({
        "billData.billNo": id,
        $or: [{ companyId: req.user?.companyId }, { companyId: null }]
      });
    }
    if (!saleOrder) {
      return res
        .status(404)
        .json({ success: false, message: "Lens sale not found" });
    }
    return res.status(200).json({ success: true, data: saleOrder });
  } catch (err) {
    console.error("Error fetching lens sale:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

const editLensSaleOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    console.log('📝 editLensSaleOrder called with ID:', id);

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Order ID is required" });
    }

    let existing = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      existing = await LensSaleOrder.findById(id);
    }
    if (!existing) {
      existing = await LensSaleOrder.findOne({
        "billData.billNo": id,
        $or: [{ companyId: req.user?.companyId }, { companyId: null }]
      });
    }
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (existing.status === "Done") {
      return res.status(400).json({
        success: false,
        message: "Order is already completed and cannot be modified.",
      });
    }

    console.log('✅ Order found, processing items...');

    const parseBool = (v) => {
      if (typeof v === "boolean") return v;
      if (typeof v === "number") return v === 1;
      if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        return s === "true" || s === "1";
      }
      return false;
    };
    const incomingItems = (data.items || []).map((item) => ({
      _id: item._id ? String(item._id) : undefined,
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
      isInvoicedRaw: item.hasOwnProperty("isInvoiced")
        ? item.isInvoiced
        : undefined,
      hasIsInvoiced: item.hasOwnProperty("isInvoiced"),
      isChallaned: item.isChallaned || false,
      salePrice: Number(item.salePrice) || 0,
      discount: Number(item.discount) || 0,
      totalAmount: Number(item.totalAmount) || 0,
      sellPrice: Number(item.sellPrice) || 0,
      combinationId: item.combinationId
        ? String(item.combinationId)
        : item.CombinationId
          ? String(item.CombinationId)
          : "",
      usageHistory: Array.isArray(item.usageHistory) ? item.usageHistory : [],
      orderNo: item.orderNo || "",
      remark: item.remark || "",
      vendor: item.vendor || "",
      partyName: item.partyName || "",
      itemStatus: item.itemStatus || "Pending", // Preserve existing status or default
    }));

    const subtotal = incomingItems.reduce(
      (s, it) => s + (Number(it.totalAmount) || 0),
      0
    );

    const taxes = (data.taxes || []).map((tax) => ({
      taxName: tax.taxName || "",
      type: tax.type || "Additive",
      percentage: Number(tax.percentage) || 0,
      amount: Number(tax.amount) || 0,
      meta: tax.meta || {},
    }));

    const taxesAmount = taxes.reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const netAmount = subtotal + taxesAmount;

    const grossAmount = incomingItems.reduce(
      (s, it) => s + (Number(it.qty) || 0) * (Number(it.salePrice) || 0),
      0
    );

    const newOrderQty = incomingItems.reduce(
      (sum, it) => sum + (Number(it.qty) || 0),
      0
    );
    const existingUsedQty = Number(existing.usedQty || 0);

    if (newOrderQty < existingUsedQty) {
      return res.status(400).json({
        success: false,
        message: `Cannot reduce order quantity below already used quantity. usedQty = ${existingUsedQty}, attempted orderQty = ${newOrderQty}`,
      });
    }

    const newBalQty = newOrderQty - existingUsedQty;

    // Snapshot old items BEFORE mutation for stock adjustment later
    const oldItems = (existing.items || []).map(it => ({
      itemName: it.itemName,
      sph: it.sph,
      cyl: it.cyl,
      add: it.add,
      eye: it.eye,
      qty: it.qty,
    }));

    const existingItems = existing.items || [];
    const existingByComb = new Map();
    const existingById = new Map();

    existingItems.forEach((it, idx) => {
      const cid = it.combinationId ? String(it.combinationId) : "";
      if (cid) existingByComb.set(cid, { item: it, idx });
      if (it._id) existingById.set(String(it._id), { item: it, idx });
    });

    const mergedItems = [];
    const seenExistingIdx = new Set();

    for (const it of incomingItems) {
      let matched = null;

      if (it.combinationId && existingByComb.has(it.combinationId)) {
        matched = existingByComb.get(it.combinationId);
      } else if (it._id && existingById.has(it._id)) {
        matched = existingById.get(it._id);
      }

      if (matched) {
        const base = matched.item._doc ? matched.item._doc : matched.item;
        const resolvedIsInvoiced = it.hasIsInvoiced
          ? parseBool(it.isInvoicedRaw)
          : base.isInvoiced === true
            ? true
            : false;

        const updated = {
          ...base,
          barcode: it.barcode,
          itemName: it.itemName,
          unit: it.unit,
          dia: it.dia,
          eye: it.eye,
          sph: it.sph,
          cyl: it.cyl,
          axis: it.axis,
          add: it.add,
          qty: it.qty,
          isInvoiced: resolvedIsInvoiced,
          isChallaned: it.isChallaned !== undefined ? it.isChallaned : (base.isChallaned || false),
          salePrice: it.salePrice,
          discount: it.discount,
          totalAmount: it.totalAmount,
          sellPrice: it.sellPrice,
          combinationId: it.combinationId,
          orderNo: it.orderNo || "",
          remark: it.remark || "",
          vendor: it.vendor || "",
          partyName: it.partyName || "",
          usageHistory:
            Array.isArray(it.usageHistory) && it.usageHistory.length
              ? it.usageHistory
              : base.usageHistory || [],
          itemStatus: it.itemStatus || base.itemStatus || "Pending", // Preserve or update item status
        };
        mergedItems.push(updated);
        seenExistingIdx.add(matched.idx);
      } else {
        const resolvedIsInvoiced = it.hasIsInvoiced
          ? parseBool(it.isInvoicedRaw)
          : false;
        mergedItems.push({
          barcode: it.barcode,
          itemName: it.itemName,
          unit: it.unit,
          dia: it.dia,
          eye: it.eye,
          sph: it.sph,
          cyl: it.cyl,
          axis: it.axis,
          add: it.add,
          qty: it.qty,
          isInvoiced: resolvedIsInvoiced,
          isChallaned: it.isChallaned || false,
          salePrice: it.salePrice,
          discount: it.discount,
          totalAmount: it.totalAmount,
          sellPrice: it.sellPrice,
          combinationId: it.combinationId,
          orderNo: it.orderNo || "",
          remark: it.remark || "",
          vendor: it.vendor || "",
          partyName: it.partyName || "",
          usageHistory: Array.isArray(it.usageHistory) ? it.usageHistory : [],
          itemStatus: it.itemStatus || "Pending", // Default for new items
        });
      }
    }

    existing.billData = data.billData || existing.billData || {};
    existing.partyData = data.partyData || existing.partyData || {};
    existing.items = mergedItems;
    existing.taxes = taxes;

    existing.grossAmount = grossAmount;
    existing.subtotal = subtotal;
    existing.taxesAmount = taxesAmount;
    existing.netAmount = netAmount;

    existing.orderQty = newOrderQty;
    existing.usedQty = existingUsedQty;
    existing.balQty = newBalQty;

    existing.remark = data.remark || existing.remark || "";
    existing.deliveryDate = data.deliveryDate || existing.deliveryDate;
    // Recalculate order status based on updated items
    existing.status = deriveOrderStatus(mergedItems, data.status || existing.status || "Pending");

    const newPaidAmount = Number(data.paidAmount ?? existing.paidAmount ?? 0);
    const newBalanceAmount = netAmount - newPaidAmount;

    existing.paidAmount = newPaidAmount;
    existing.dueAmount = newBalanceAmount;

    console.log('💾 Attempting to save order with', mergedItems.length, 'items...');

    const updated = await existing.save();

    // ── Stock Adjustment for Edit ────────────────────────────────────────────────
    try {
      const companyId = req.user?.companyId || null;
      const adjustResult = await adjustStockForEdit(
        oldItems,    // pre-mutation snapshot of the old items
        mergedItems, // new items after the edit
        companyId
      );
      if (!adjustResult.valid) {
        // Note: order is already saved. Return warning in response.
        const messages = adjustResult.errors.map(e => e.message).join(" | ");
        return res.status(200).json({
          success: true,
          message: "Sale order updated successfully (stock warning: " + messages + ")",
          data: updated,
          stockWarning: true,
          stockErrors: adjustResult.errors,
        });
      }
    } catch (stockErr) {
      console.error("[Stock] Adjustment error (non-fatal):", stockErr.message);
    }
    // ─────────────────────────────────────────────────────────────────────────────

    console.log('✅ Sale order updated successfully:', updated._id);

    return res.status(200).json({
      success: true,
      message: "Sale order updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("❌ Error updating sale order:", {
      message: err.message,
      stack: err.stack,
      code: err.code,
      name: err.name,
      keyPattern: err.keyPattern,
      validationErrors: err.errors
    });

    // Handle validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.entries(err.errors).map(([key, val]) => `${key}: ${val.message}`);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: errors.join('; '),
        details: err.errors
      });
    }

    // Handle duplicate key errors
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate entry error",
        error: `Duplicate value for field: ${Object.keys(err.keyPattern)[0]}`,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update sale order",
      error: err.message,
    });
  }
};

const removeLensSaleOrder = async (req, res) => {
  try {
    const { id } = req.params;

    let existing = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      existing = await LensSaleOrder.findById(id);
    }
    if (!existing) {
      existing = await LensSaleOrder.findOne({
        "billData.billNo": id,
        $or: [{ companyId: req.user?.companyId }, { companyId: null }]
      });
    }
    if (!existing) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (existing.status === "Done") {
      return res.status(400).json({
        success: false,
        message: "Order is already completed and cannot be deleted.",
      });
    }

    await LensSaleOrder.findByIdAndDelete(existing._id);

    // ── Restore Stock on Delete ──────────────────────────────────────────────────
    try {
      const companyId = req.user?.companyId || null;
      await restoreStock(existing.items || [], companyId);
    } catch (stockErr) {
      console.error("[Stock] Restore error on delete (non-fatal):", stockErr.message);
    }
    // ─────────────────────────────────────────────────────────────────────────────

    res.status(200).json({
      message: "Lens Sale Order deleted successfully",
    });
  } catch (error) {
    console.error("Delete Order Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const createLensInvoice = async (req, res) => {
  try {
    const data = req.body || {};
    const selectedItemIds = data.selectedItemIds || []; // IDs of items from sourceSaleId to be invoiced

    const items = (data.items || [])
      .filter((item) => selectedItemIds.includes(String(item._id)))
      .map((item) => {
        return {
          _id: item._id ? String(item._id) : undefined,
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
          salePrice: Number(item.salePrice) || 0,
          discount: Number(item.discount) || 0,
          totalAmount: Number(item.totalAmount) || 0,
          sellPrice: Number(item.sellPrice) || 0,
          combinationId: item.combinationId || "",
          orderNo: item.orderNo || "",
          remark: item.remark || "",
          isInvoiced: true,
          itemStatus: "Done", // Set status to Done for invoiced items
        };
      });

    const taxes = (data.taxes || []).map((tax) => ({
      taxName: tax.taxName || "",
      type: tax.type || "Additive",
      percentage: Number(tax.percentage) || 0,
      amount: Number(tax.amount) || 0,
      meta: tax.meta || {},
    }));

    if (!items.length) {
      return res.status(400).json({
        success: false,
        message: "At least one invoice item is required",
      });
    }

    // --- calculate totals ---
    const subtotal = items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0);
    const taxesAmount = taxes.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const netAmount = subtotal + taxesAmount;
    const paidAmount = Number(data.paidAmount) || 0;
    const dueAmount = netAmount - paidAmount;
    const grossAmount = items.reduce(
      (s, it) => s + (Number(it.qty) || 0) * (Number(it.salePrice) || 0),
      0
    );

    // --- compute summary ---
    const totalQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
    const totalAmount = items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0);

    // --- reduce stock ---
    for (const it of items) {
      if (it.combinationId && Number(it.qty) > 0) {
        const combId = new mongoose.Types.ObjectId(it.combinationId);
        const parent = await LensGroup.findOne(
          { "addGroups.combinations._id": combId }
        );
        if (!parent) {
          return res.status(400).json({
            success: false,
            message: `No lens combination found for ${it.combinationId}`,
          });
        }

        let matched = null;
        for (const ag of parent.addGroups) {
          const comb = ag.combinations.id(combId);
          if (comb) {
            matched = comb;
            break;
          }
        }

        if (!matched) {
          return res.status(400).json({
            success: false,
            message: `Combination ID ${it.combinationId} not found inside parent`,
          });
        }

        if ((matched.initStock || 0) < Number(it.qty)) {
          return res.status(400).json({
            success: false,
            message: `Not enough stock for ${it.itemName}. Available: ${matched.initStock}, Required: ${it.qty}`,
          });
        }

        matched.initStock -= Number(it.qty);
        await parent.save();
      }
    }

    // --- create invoice ---
    const invoiceBillData = {
      billSeries: data.billData?.billSeries || "",
      billNo: data.billData?.billNo || "",
      billType: data.billData?.billType || "",
      godown: data.billData?.godown || "",
      bookedBy: data.billData?.bookedBy || "",
      date: data.billData?.date || new Date(),
    };

    const newInvoice = new LensSale({
      billData: invoiceBillData,
      partyData: data.partyData || {},
      items,
      taxes,
      grossAmount,
      subtotal,
      taxesAmount,
      netAmount,
      paidAmount,
      dueAmount,
      summary: { totalQty, totalAmount }, // <--- include summary
      deliveryDate: data.deliveryDate || Date.now(),
      time: new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
      remark: data.remark || "",
      status: deriveOrderStatus(items, data.status || "Done"), // Derive status for invoice
      sourceSaleId: data.sourceSaleId || null,
    });

    const savedInvoice = await newInvoice.save();

    // --- update sale order usage history and item statuses ---
    if (data.sourceSaleId && items.length) {
      const saleOrder = await LensSaleOrder.findById(data.sourceSaleId);
      if (saleOrder) {
        let addedUsedQty = 0;
        saleOrder.items = saleOrder.items.map(sItem => {
          const invItem = items.find(cItem => String(cItem._id) === String(sItem._id));
          if (invItem && selectedItemIds.includes(String(sItem._id))) {
            sItem.isInvoiced = true;
            sItem.itemStatus = "Done"; // Mark as Done
            const qtyUsed = Number(invItem.qty) || 0;
            if (!sItem.usageHistory) sItem.usageHistory = [];
            sItem.usageHistory.push({
              invoiceId: savedInvoice._id.toString(),
              billNo: savedInvoice.billData.billNo || "",
              series: savedInvoice.billData.billSeries || "",
              qtyUsed,
              date: new Date(),
            });
            addedUsedQty += qtyUsed;
          }
          return sItem;
        });
        saleOrder.usedQty = (saleOrder.usedQty || 0) + addedUsedQty;
        saleOrder.balQty = Math.max(
          0,
          (saleOrder.orderQty || 0) - (saleOrder.usedQty || 0)
        );

        if (!saleOrder.usedIn) saleOrder.usedIn = [];
        if (!saleOrder.usedIn.some(u => u.type === 'SI' && u.number === savedInvoice.billData.billNo)) {
          saleOrder.usedIn.push({ type: 'SI', number: savedInvoice.billData.billNo });
        }

        saleOrder.status = deriveOrderStatus(saleOrder.items, saleOrder.status); // Recalculate order status
        await saleOrder.save();
      }
    }

    return res.status(201).json({
      success: true,
      message: "Invoice created successfully (stock reduced)",
      data: savedInvoice,
    });
  } catch (err) {
    console.error("Error creating lens invoice:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create invoice",
      error: err.message,
    });
  }
};

const createLensChallan = async (req, res) => {
  try {
    const data = req.body || {};
    const selectedItemIds = data.selectedItemIds || []; // IDs of items from sourceSaleId to be challaned

    console.log('📦 createLensChallan received:', {
      sourceSaleId: data.sourceSaleId,
      itemsCount: data.items?.length,
      selectedItemIds: data.selectedItemIds?.length,
      billDataKeys: Object.keys(data.billData || {}),
      partyDataKeys: Object.keys(data.partyData || {}),
      taxesCount: data.taxes?.length
    });

    const items = (data.items || [])
      .filter((item) => selectedItemIds.includes(String(item._id)))
      .map((item) => {
        return {
          _id: item._id ? String(item._id) : undefined,
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
          salePrice: Number(item.salePrice) || 0,
          discount: Number(item.discount) || 0,
          totalAmount: Number(item.totalAmount) || 0,
          sellPrice: Number(item.sellPrice) || 0,
          combinationId: item.combinationId || "",
          orderNo: item.orderNo || "",
          remark: item.remark || "",
          isChallaned: true,
          itemStatus: "In Progress",
        };
      });
    const taxes = (data.taxes || []).map((tax) => ({
      taxName: tax.taxName || "",
      type: tax.type || "Additive",
      percentage: Number(tax.percentage) || 0,
      amount: Number(tax.amount) || 0,
      meta: tax.meta || {},
    }));

    if (!items.length) {
      console.warn('❌ No items provided in challan request');
      return res.status(400).json({
        success: false,
        message: "At least one challan item is required",
      });
    }

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
    const totalQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
    for (const it of items) {
      if (it.combinationId && Number(it.qty) > 0) {
        try {
          const combId = new mongoose.Types.ObjectId(it.combinationId)
          const parent = await LensGroup.findOne(
            { "addGroups.combinations._id": combId }
          )
          if (!parent) {
            console.warn("⚠️ Combination Not Found:", it.combinationId, "- Skipping stock deduction")
            continue
          }
          let matched = null;
          for (const ag of parent.addGroups) {
            const comb = ag.combinations.id(combId)
            if (comb) {
              matched = comb;
              break;
            }
          }
          if (!matched) {
            console.warn(
              "⚠️ Combination ID found but not resolved:",
              it.combinationId,
              "- Skipping stock deduction"
            );
            continue;
          }
          const oldStock = Number(matched.initStock || 0)
          const qty = Number(it.qty || 0)

          console.log(`[STOCK_CHECK] item: ${it.itemName}, combId: ${it.combinationId}, oldStock: ${oldStock}, required: ${qty}`);

          if (oldStock < qty) {
            console.error(`❌ Insufficient stock for item: ${it.itemName}. Available: ${oldStock}, Required: ${qty}`);

            // Print diagnostics to identify where the stock actually is
            console.log(`[DIAGNOSTIC] Parent: ${parent.productName} (${parent._id})`);
            parent.addGroups.forEach(ag => {
              ag.combinations.forEach(c => {
                if (c.initStock > 0 || String(c._id) === String(it.combinationId)) {
                  console.log(`  -> Combo (Add:${ag.addValue}): SPH:${c.sph}, CYL:${c.cyl}, EYE:${c.eye}, Stock:${c.initStock}, ID:${c._id}`);
                }
              });
            });

            return res.status(400).json({
              success: false,
              message: `Insufficient stock for item "${it.itemName}". Available: ${oldStock}, Required: ${qty}`,
              itemName: it.itemName,
              available: oldStock,
              required: qty
            });
          }
          matched.initStock = oldStock - qty;
          await parent.save();
          console.log(`✅ Stock reduced for item: ${it.itemName}, Remaining: ${matched.initStock}`);
        }
        catch (err) {
          console.error("❌ Error reducing stock for", it.itemName, ":", err.message);
          // Don't fail the entire challan creation for stock issues with invalid combinationId
          continue;
        }
      }
    }
    const challanBillData = {
      billSeries: data.billData?.billSeries || "",
      billNo: data.billData?.billNo || "",
      billType: data.billData?.billType || "",
      godown: data.billData?.godown || "",
      bookedBy: data.billData?.bookedBy || "",
      date: data.billData?.date || new Date(),
    };
    const newChallan = new LensSaleChallan({
      billData: challanBillData,
      partyData: data.partyData || {},
      items,
      taxes,
      grossAmount,
      subtotal,
      taxesAmount,
      netAmount,
      paidAmount,
      dueAmount,
      orderQty: totalQty,
      balQty: totalQty,
      deliveryDate: data.deliveryDate || Date.now(),
      time: new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
      remark: data.remark || "",
      status: deriveOrderStatus(items, data.status || "In Progress"),
      parentStatus: deriveOrderStatus(items, data.status || "In Progress"),
      sourceSaleId: data.sourceSaleId || null,
      companyId: req.user?.companyId || null,
    });

    const savedChallan = await newChallan.save();
    console.log('✅ Challan saved successfully:', savedChallan._id);

    // Update the source sale order with new item statuses
    if (data.sourceSaleId && items.length) {
      try {
        const sale = await LensSaleOrder.findById(data.sourceSaleId);
        if (sale) {
          const selectedItemIds = data.selectedItemIds || items.map(i => String(i._id)).filter(Boolean);

          // Mark selected items as "In Progress" and update usage history
          sale.items = sale.items.map(sItem => {
            const challanItem = items.find(cItem => String(cItem._id) === String(sItem._id));
            if (challanItem && selectedItemIds.includes(String(sItem._id))) {
              sItem.isChallaned = true;
              sItem.itemStatus = "In Progress";
              const qtyUsed = Number(challanItem.qty) || 0;
              if (!sale.usageHistory) sale.usageHistory = [];
              sale.usageHistory.push({
                challanId: savedChallan._id.toString(),
                billNo: savedChallan.billData.billNo || "",
                series: savedChallan.billData.billSeries || "",
                qtyUsed,
                date: new Date(),
              });
            }
            return sItem;
          });

          // Update usedIn
          if (!sale.usedIn) sale.usedIn = [];
          if (!sale.usedIn.some(u => u.type === 'SC' && u.number === savedChallan.billData.billNo)) {
            sale.usedIn.push({ type: 'SC', number: savedChallan.billData.billNo });
          }

          // Calculate total used qty
          let addedUsedQty = 0;
          for (const chalItem of items) {
            if (chalItem._id) {
              addedUsedQty += Number(chalItem.qty) || 0;
            }
          }

          sale.usedQty = Number(sale.usedQty || 0) + addedUsedQty;
          const itemsTotalQty = Array.isArray(sale.items)
            ? sale.items.reduce((s, it) => s + (Number(it.qty) || 0), 0)
            : 0;

          sale.orderQty = Number(sale.orderQty ?? itemsTotalQty);
          sale.balQty = Math.max(
            0,
            Number(sale.orderQty || 0) - Number(sale.usedQty || 0)
          );

          // Derive and update order status from item statuses
          sale.status = deriveOrderStatus(sale.items, sale.status);

          await sale.save();
          console.log('✅ Sale order updated with new item statuses, parentStatus:', sale.parentStatus);
        }
      } catch (err) {
        console.warn(
          "⚠️ Could not update sale order with status:",
          err.message
        );
      }
    }
    return res.status(201).json({
      success: true,
      message: "Challan created successfully",
      data: savedChallan,
    });
  } catch (err) {
    console.error("Error creating lens challan:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create challan",
      error: err.message,
    });
  }
};
const updateSaleOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, cancelReason } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const validStatuses = ["pending", "in progress", "done", "cancelled", "on approval"];
    if (!validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const updatedOrder = await LensSaleOrder.findByIdAndUpdate(
      id,
      { status, cancelReason },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Sale Order not found",
      });
    }

    // Restore stock when order is cancelled
    if (status.toLowerCase() === "cancelled") {
      try {
        const orderForStock = await LensSaleOrder.findById(id);
        await restoreStock(orderForStock?.items || [], req.user?.companyId || null);
      } catch (stockErr) {
        console.error("[Stock] Restore error on cancel (non-fatal):", stockErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: updatedOrder,
    });
  } catch (err) {
    console.error("Error updating sale order status:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update status",
      error: err.message,
    });
  }
};

const updateCancelReason = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancelReason } = req.body;

    const updatedOrder = await LensSaleOrder.findByIdAndUpdate(
      id,
      { cancelReason },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Sale Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cancel reason updated successfully",
      data: updatedOrder,
    });
  } catch (err) {
    console.error("Error updating cancel reason:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update cancel reason",
      error: err.message,
    });
  }
};

const updateSaleOrderBookedBy = async (req, res) => {
  try {
    const { id } = req.params;
    const { bookedBy } = req.body;

    const updatedOrder = await LensSaleOrder.findByIdAndUpdate(
      id,
      { "billData.bookedBy": bookedBy },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Sale Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booked By updated successfully",
      data: updatedOrder,
    });
  } catch (err) {
    console.error("Error updating sale order bookedBy:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update bookedBy",
      error: err.message,
    });
  }
};

const getNextBillNumberForLensSaleOrder = async (req, res) => {
  try {
    const { partyName } = req.body;
    if (!partyName) {
      return res.status(400).json({
        success: false,
        message: "Party name is required",
        nextBillNumber: 1
      });
    }

    const allOrders = await LensSaleOrder.find({});
    const matchingOrders = (allOrders || []).filter(order =>
      (order.partyData?.partyAccount || "").toLowerCase() === partyName.toLowerCase()
    );

    const nextBillNumber = matchingOrders.length + 1;

    return res.status(200).json({
      success: true,
      nextBillNumber,
      count: matchingOrders.length
    });
  } catch (err) {
    console.error("Error fetching next bill number for Lens Sale Order:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch next bill number",
      nextBillNumber: 1
    });
  }
};

const updateOrderQuantities = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderQty, usedQty } = req.body;

    const order = await LensSaleOrder.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Sale Order not found",
      });
    }

    if (orderQty !== undefined) order.orderQty = Number(orderQty);
    if (usedQty !== undefined) order.usedQty = Number(usedQty);

    const oQty = order.orderQty !== undefined ? order.orderQty : 0;
    const uQty = order.usedQty !== undefined ? order.usedQty : 0;
    order.balQty = Math.max(0, oQty - uQty);

    const updatedOrder = await order.save();

    return res.status(200).json({
      success: true,
      message: "Quantities updated successfully",
      data: updatedOrder,
    });
  } catch (err) {
    console.error("Error updating sale order quantities:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update quantities",
      error: err.message,
    });
  }
};

const updateSaleOrderVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { vendor } = req.body;

    const order = await LensSaleOrder.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Sale Order not found",
      });
    }

    if (Array.isArray(order.items)) {
      order.items.forEach((item) => {
        item.vendor = vendor;
      });
    }

    const updatedOrder = await order.save();

    return res.status(200).json({
      success: true,
      message: "Vendor updated successfully",
      data: updatedOrder,
    });
  } catch (err) {
    console.error("Error updating sale order vendor:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update vendor",
      error: err.message,
    });
  }
};

// Status Management & Sync Functions

/**
 * Internal helper to sync order status across Challans and Invoices
 */
const syncOrderAcrossModulesInternal = async (orderId) => {
  const order = await LensSaleOrder.findById(orderId);
  if (!order) return;

  // Sync with Challans
  const challans = await LensSaleChallan.find({ sourceSaleId: orderId });
  for (const challan of challans) {
    let changed = false;
    challan.items = challan.items.map(cItem => {
      const oItem = order.items.find(oi =>
        String(oi._id) === String(cItem._id) ||
        (String(oi.barcode) === String(cItem.barcode) && oi.itemName === cItem.itemName)
      );
      if (oItem && oItem.itemStatus !== cItem.itemStatus) {
        cItem.itemStatus = oItem.itemStatus;
        changed = true;
      }
      return cItem;
    });
    if (changed) {
      challan.status = deriveOrderStatus(challan.items, challan.status);
      await challan.save();
    }
  }

  // Sync with Invoices
  const invoices = await LensSale.find({ sourceSaleId: orderId });
  for (const invoice of invoices) {
    let changed = false;
    invoice.items = invoice.items.map(iItem => {
      const oItem = order.items.find(oi =>
        String(oi._id) === String(iItem._id) ||
        (String(oi.barcode) === String(iItem.barcode) && oi.itemName === iItem.itemName)
      );
      if (oItem && oItem.itemStatus !== iItem.itemStatus) {
        iItem.itemStatus = oItem.itemStatus;
        changed = true;
      }
      return iItem;
    });
    if (changed) {
      invoice.status = deriveOrderStatus(invoice.items, invoice.status);
      await invoice.save();
    }
  }
};

const updateItemStatus = async (req, res) => {
  try {
    const { id: orderId } = req.params; // Get ID from params to match route structure
    const { itemIds, newStatus } = req.body;

    const order = await LensSaleOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const idSet = new Set(itemIds.map(id => String(id)));
    order.items = order.items.map(item => {
      if (idSet.has(String(item._id))) {
        item.itemStatus = newStatus;
      }
      return item;
    });

    order.status = deriveOrderStatus(order.items, order.status);
    await order.save();

    // After updating order, sync everything else
    await syncOrderAcrossModulesInternal(orderId);

    return res.status(200).json({
      success: true,
      message: "Item status(es) updated and synced",
      data: order
    });
  } catch (err) {
    console.error("Error in updateItemStatus:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

const recalculateOrderStatus = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const order = await LensSaleOrder.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const oldStatus = order.status;
    order.status = deriveOrderStatus(order.items, order.status);

    if (oldStatus !== order.status) {
      await order.save();
      await syncOrderAcrossModulesInternal(orderId);
    }

    return res.status(200).json({
      success: true,
      message: "Order status recalculated",
      status: order.status
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const syncOrderAcrossModules = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    await syncOrderAcrossModulesInternal(orderId);
    return res.status(200).json({ success: true, message: "Modules synced successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const updateOrderPlacementStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isOrderPlaced } = req.body;

    const order = await LensSaleOrder.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    order.isOrderPlaced = isOrderPlaced;
    order.orderPlacedAt = isOrderPlaced ? new Date() : null;

    // If order is placed, update status to "In Progress" if it was "Pending"
    if (isOrderPlaced) {
      if (order.status === "Pending") {
        order.status = "In Progress";
        if (order.parentStatus) order.parentStatus = "In Progress";
      }

      // Also update any "Pending" items to "In Progress" to satisfy deriveOrderStatus logic
      if (Array.isArray(order.items)) {
        order.items.forEach(item => {
          if (item.itemStatus === "Pending") {
            item.itemStatus = "In Progress";
          }
        });
      }
    }

    const updatedOrder = await order.save();
    return res.status(200).json({ success: true, data: updatedOrder });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const updateItemOrderNo = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const { itemId, orderNo } = req.body;

    const order = await LensSaleOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    order.items = order.items.map(item => {
      if (String(item._id) === String(itemId)) {
        item.orderNo = orderNo;
      }
      return item;
    });

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Item Order No updated",
      data: order
    });
  } catch (err) {
    console.error("Error in updateItemOrderNo:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
const updateSaleOrderRefNo = async (req, res) => {
  try {
    const { id } = req.params;
    const { refNo } = req.body;
    const order = await LensSaleOrder.findById(id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    order.refNo = refNo;
    await order.save();
    return res.status(200).json({ success: true, data: order });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const updateItemRemark = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const { itemId, remark } = req.body;

    const order = await LensSaleOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    order.items = order.items.map(item => {
      if (String(item._id) === String(itemId)) {
        item.remark = remark;
      }
      return item;
    });

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Item Remark updated",
      data: order
    });
  } catch (err) {
    console.error("Error in updateItemRemark:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Validate Account Credit Limit and Day Limit
 * @param {string} accountName - Name of the account
 * @param {number} transactionAmount - Transaction amount (netAmount)
 * @returns {object} Validation result with success flag and messages
 */
const validateAccountLimits = async (req, res) => {
    try {
        const { accountName, transactionAmount } = req.body;
        const companyId = req.user?.companyId;

        if (!accountName || transactionAmount === undefined) {
            return res.status(400).json({
                success: false,
                message: "Account name and transaction amount are required"
            });
        }

        const result = await validateAccountLimitsHelper(accountName, transactionAmount, companyId);
        
        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);

    } catch (err) {
        console.error("Error validating account limits:", err);
        return res.status(500).json({
            success: false,
            message: "Error validating account limits",
            error: err.message
        });
    }
};

export {
  addLensSaleOrder,
  getLensSaleOrder,
  getAllLensSaleOrder,
  removeLensSaleOrder,
  editLensSaleOrder,
  createLensInvoice,
  createLensChallan,
  updateSaleOrderStatus,
  updateSaleOrderBookedBy,
  getNextBillNumberForLensSaleOrder,
  updateOrderQuantities,
  updateSaleOrderVendor,
  updateItemStatus,
  recalculateOrderStatus,
  syncOrderAcrossModules,
  updateOrderPlacementStatus,
  updateItemOrderNo,
  updateSaleOrderRefNo,
  updateItemRemark,
  updateCancelReason,
  validateAccountLimits,
};
