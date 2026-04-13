import LensSale from "../models/LensSale.js";
import LensGroup from "../models/LensGroup.js";
import LensSaleChallan from "../models/LensSaleChallan.js";
import LensSaleOrder from "../models/LensSaleOrder.js";
import Account from "../models/Account.js";
import mongoose from "mongoose";
import { parseDuration } from "../jobs/autoInvoiceJob.js";
import { deriveOrderStatus } from "../utils/statusManager.js";
import { sendWhatsAppMessage } from "../utils/notificationService.js";
import { 
  validateStockAvailability, 
  deductStock, 
  restoreStock, 
  adjustStockForEdit 
} from "../utils/stockDeductionHelper.js";

const addLensSaleChallan = async (req, res) => {
  try {
    const data = req.body;

    if (!Array.isArray(data.items) || !data.items.length) {
      return res.status(400).json({
        success: false,
        message: "At least one sale challan item is required",
      });
    }

    let totalQty = 0;
    const items = [];

    // ── Barcode Integrity Check (Server Side) ─────────────────────────────────
    if (data.sourceSaleId) {
      const saleOrder = await LensSaleOrder.findById(data.sourceSaleId);
      if (!saleOrder) {
        return res.status(404).json({ success: false, message: "Source Sale Order not found" });
      }
      
      const validBarcodes = new Set(saleOrder.items.map(it => it.barcode).filter(b => b));
      for (const item of data.items) {
        if (item.barcode && !validBarcodes.has(item.barcode)) {
          return res.status(400).json({
            success: false,
            message: `Invalid barcode detected: ${item.barcode} does not belong to Sale Order ${saleOrder.billData?.billNo || data.sourceSaleId}`
          });
        }
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    // ── Stock Deduction Logic ────────────────────────────────────────────────
    if (!data.sourceSaleId) {
       // Only validate and deduct stock if this is NOT created from a Sale Order
       const stockValidation = await validateStockAvailability(data.items, req.user?.companyId);
       if (!stockValidation.valid) {
          return res.status(400).json({
             success: false,
             message: "Insufficient stock for one or more items",
             stockErrors: stockValidation.errors
          });
       }
       await deductStock(data.items, req.user?.companyId);
    }
    // ──────────────────────────────────────────────────────────────────────────

    for (const item of data.items) {
      const qty = Number(item.qty || 0);
      totalQty += qty;

      items.push({
        _id: item._id,
        barcode: item.barcode || "",
        itemName: item.itemName || "",
        unit: item.unit || "",
        dia: item.dia || "",
        eye: item.eye || "",
        sph: Number(item.sph) || 0,
        cyl: Number(item.cyl) || 0,
        axis: Number(item.axis) || 0,
        add: Number(item.add) || 0,
        qty,
        salePrice: Number(item.salePrice) || 0,
        discount: Number(item.discount) || 0,
        totalAmount: Number(item.totalAmount) || 0,
        sellPrice: Number(item.sellPrice) || 0,
        combinationId: item.combinationId || "",
        orderNo: item.orderNo || "",
        remark: item.remark || "",
        isInvoiced: false,
        isChallaned: true,
      });
    }

    const subtotal = items.reduce((sum, it) => sum + (it.totalAmount || 0), 0);
    const taxes = (data.taxes || []).map((t) => ({
      taxName: t.taxName || "",
      type: t.type || "Additive",
      percentage: Number(t.percentage) || 0,
      amount: Number(t.amount) || 0,
      meta: t.meta || {},
    }));
    const taxesAmount = taxes.reduce((sum, t) => sum + (t.amount || 0), 0);

    const netAmount = subtotal + taxesAmount;
    const paidAmount = Number(data.paidAmount || 0);
    const dueAmount = netAmount - paidAmount;

    const grossAmount = items.reduce(
      (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.salePrice) || 0),
      0
    );

    const newChallan = new LensSaleChallan({
      billData: data.billData || {},
      partyData: data.partyData || {},
      items,
      taxes,
      orderQty: totalQty,
      balQty: totalQty,
      grossAmount,
      subtotal,
      taxesAmount,
      netAmount,
      paidAmount,
      dueAmount,
      deliveryDate: data.deliveryDate || Date.now(),
      remark: data.remark || "",
      status: data.status || "Pending",
      parentStatus: data.status || "Pending",
      sourceSaleId: data.sourceSaleId || null,
      companyId: req.user?.companyId || null,
    });

    // Set auto invoice date (Requirement: 30 days after Bill Date)
    const baseDate = data.billData?.date ? new Date(data.billData.date) : new Date();
    const durationStr = process.env.AUTO_INVOICE_DURATION || '30d';
    const durationMs = parseDuration(durationStr);
    newChallan.autoInvoiceDate = new Date(baseDate.getTime() + durationMs);

    const savedChallan = await newChallan.save();

    if (data.sourceSaleId && items.length) {
      try {
        const sale = await LensSaleOrder.findById(data.sourceSaleId);
        if (sale) {
          let addedUsedQty = 0;
          for (const invItem of items) {
            if (!invItem._id) continue;
            const sItem = sale.items.id(invItem._id);
            if (sItem) {
              sItem.isChallaned = true;
              sItem.itemStatus = "In Progress";
              const qtyUsed = Number(invItem.qty) || 0;
              sale.usageHistory.push({
                challanId: savedChallan._id.toString(),
                billNo: savedChallan.billData.billNo || "",
                series: savedChallan.billData.billSeries || "",
                qtyUsed,
                date: new Date(),
              });
              addedUsedQty += qtyUsed;
            }
          }
          sale.usedQty = Number(sale.usedQty || 0) + addedUsedQty;

          if (!sale.usedIn) sale.usedIn = [];
          if (!sale.usedIn.some(u => u.type === 'SC' && u.number === savedChallan.billData.billNo)) {
            sale.usedIn.push({ type: 'SC', number: savedChallan.billData.billNo });
          }

          sale.status = deriveOrderStatus(sale.items, sale.status);
          await sale.save();
        }
      } catch (err) {
        console.warn(
          "Could not update selected items challan flags:",
          err.message
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: "Sale challan added successfully",
      data: savedChallan,
    });
  } catch (err) {
    console.error("Error adding sale challan:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to add sale challan",
      error: err.message,
    });
  }
};


const getAllLensSaleChallan = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const salechallans = await LensSaleChallan.find({
      $or: [
        { companyId },
        { companyId: null }
      ]
    }).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      data: salechallans,
    });
  } catch (err) {
    console.error("Error fetching lens sale Challans:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch lens sale Challans",
      error: err.message,
    });
  }
};

const getLensSaleChallan = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Sale ID is required" });
    }
    const saleChallan = await LensSaleChallan.findOne({ _id: id, companyId: req.user?.companyId });
    if (!saleChallan) {
      return res
        .status(404)
        .json({ success: false, message: "Lens sale not found" });
    }
    return res.status(200).json({ success: true, data: saleChallan });
  } catch (err) {
    console.error("Error fetching lens sale:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

const editLensSaleChallan = async (req, res) => {
  try {
    console.log("editLensSaleChallan called with params:", req.params);
    console.log("editLensSaleChallan body sample:", {
      billData: req.body.billData,
      partyData: req.body.partyData,
      itemsLength: Array.isArray(req.body.items) ? req.body.items.length : 0,
    });
    const { id } = req.params;
    const data = req.body;

    // Validate incoming payload early to avoid runtime errors and return clear 4xx
    if (!data || !Array.isArray(data.items)) {
      console.warn("editLensSaleChallan: invalid payload - items must be an array", { id, hasBody: !!data });
      return res.status(400).json({
        success: false,
        message: "Invalid payload: 'items' array is required for updating challan",
      });
    }

    for (const [idx, it] of (data.items || []).entries()) {
      if (it == null) {
        return res.status(400).json({ success: false, message: `Invalid item at index ${idx}` });
      }
      const qty = Number(it.qty);
      if (!Number.isFinite(qty) || qty < 0) {
        return res.status(400).json({ success: false, message: `Invalid qty for item at index ${idx}` });
      }
    }

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Challan ID is required" });
    }
    const companyId = req.user?.companyId;

    const existing = await LensSaleChallan.findOne({ _id: id, companyId });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Challan not found" });
    }

    // ── Barcode Integrity Check (Server Side) ─────────────────────────────────
    const effectiveSourceId = data.sourceSaleId || existing.sourceSaleId;
    if (effectiveSourceId) {
      const saleOrder = await LensSaleOrder.findById(effectiveSourceId);
      if (saleOrder) {
        const validBarcodes = new Set(saleOrder.items.map(it => it.barcode).filter(b => b));
        for (const item of data.items) {
          if (item.barcode && !validBarcodes.has(item.barcode)) {
            return res.status(400).json({
              success: false,
              message: `Invalid barcode detected: ${item.barcode} does not belong to source Sale Order`
            });
          }
        }
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    if (existing.status === "Done" || existing.status === "Received") {
      return res.status(400).json({
        success: false,
        message: "Challan is already completed and cannot be modified.",
      });
    }

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
      salePrice: Number(item.salePrice) || 0,
      discount: Number(item.discount) || 0,
      totalAmount: Number(item.totalAmount) || 0,
      sellPrice: Number(item.sellPrice) || 0,
      combinationId: item.combinationId
        ? String(item.combinationId)
        : item.CombinationId
          ? String(item.CombinationId)
          : "",
      orderNo: item.orderNo || "",
      usageHistory: Array.isArray(item.usageHistory) ? item.usageHistory : [],
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
          salePrice: it.salePrice,
          discount: it.discount,
          totalAmount: it.totalAmount,
          sellPrice: it.sellPrice,
          combinationId: it.combinationId,
          orderNo: it.orderNo || "",
          remark: it.remark || "",
          usageHistory:
            Array.isArray(it.usageHistory) && it.usageHistory.length
              ? it.usageHistory
              : base.usageHistory || [],
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
          salePrice: it.salePrice,
          discount: it.discount,
          totalAmount: it.totalAmount,
          sellPrice: it.sellPrice,
          combinationId: it.combinationId,
          orderNo: it.orderNo || "",
          remark: it.remark || "",
          usageHistory: Array.isArray(it.usageHistory) ? it.usageHistory : [],
        });
      }
    }

    existing.billData = data.billData || existing.billData || {};
    existing.partyData = data.partyData || existing.partyData || {};

    // Clear and repopulate items array (proper Mongoose subdocument handling)
    existing.items = [];
    for (const mi of mergedItems) {
      existing.items.push(mi);
    }

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

    // Normalize status to match schema enum ["Pending", "Shipped", "Received"]
    const statusMap = {
      pending: "Pending",
      shipped: "Shipped",
      received: "Received",
      Pending: "Pending",
      Shipped: "Shipped",
      Received: "Received",
    };
    const incomingStatus = data.status || existing.status || "Pending";
    existing.status = statusMap[incomingStatus] || "Pending";

    const newPaidAmount = Number(data.paidAmount ?? existing.paidAmount ?? 0);
    const newBalanceAmount = netAmount - newPaidAmount;

    // ── Stock Adjustment for Edit ───────────────────────────────────────────
    if (!existing.sourceSaleId && !data.sourceSaleId) {
       // Only adjust if there's no source order (i.e. this is a direct challan)
       const stockResult = await adjustStockForEdit(existing.items, incomingItems, companyId);
       if (!stockResult.valid) {
          return res.status(400).json({
             success: false,
             message: "Insufficient stock for update",
             stockErrors: stockResult.errors
          });
       }
    }
    // ─────────────────────────────────────────────────────────────────────────

    existing.paidAmount = newPaidAmount;
    existing.dueAmount = newBalanceAmount;

    const updated = await existing.save();

    return res.status(200).json({
      success: true,
      message: "Sale challan updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Error updating sale challan:", err);
    if (err && err.stack) console.error(err.stack);

    // Provide more detailed error info for debugging
    let errorDetail = err.message || "Unknown error";
    if (err.name === "ValidationError") {
      errorDetail = `Validation error: ${Object.keys(err.errors).join(", ")}`;
    } else if (err.name === "MongoError") {
      errorDetail = `Database error: ${err.message}`;
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update sale challan",
      error: errorDetail,
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const removeLensSaleChallan = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;

    const existing = await LensSaleChallan.findOne({ _id: id, companyId });
    if (!existing) {
      return res.status(404).json({ message: "Challan not found or unauthorized" });
    }

    if (existing.status === "Done" || existing.status === "Received") {
      return res.status(400).json({
        success: false,
        message: "Challan is already completed and cannot be deleted.",
      });
    }
    if (!existing.sourceSaleId) {
       // Restore stock only for direct challans
       await restoreStock(existing.items, companyId);
    }

    await LensSaleChallan.findOneAndDelete({ _id: id, companyId });

    res.status(200).json({
      message: "Lens Sale Challan deleted successfully",
    });
  } catch (error) {
    console.error("Delete Challan Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const createLensInvoice = async (req, res) => {
  try {
    const data = req.body || {};
    console.log(data);

    const items = (data.items || []).map((item) => ({
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
      itemStatus: "Done",
      // purchasedAt optional if needed
    }));

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

    const subtotal = items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0);
    const taxesAmount = taxes.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const netAmount = subtotal + taxesAmount;
    const paidAmount = Number(data.paidAmount) || 0;
    const dueAmount = netAmount - paidAmount;
    const grossAmount = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.salePrice) || 0), 0);

    // compute invoice-level summary
    const totalQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
    const totalAmount = items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0);

    const invoiceBillData = {
      billSeries: data.billData?.billSeries || "",
      billNo: data.billData?.billNo || "",
      billType: data.billData?.billType || "",
      godown: data.billData?.godown || "",
      bookedBy: data.billData?.bookedBy || "",
      date: data.billData?.date || new Date(),
    };

    // Always save in Lens Sale section as per USER requirement
    const InvoiceModel = LensSale;

    const newInvoice = new InvoiceModel({
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
      summary: { totalQty, totalAmount },
      deliveryDate: data.deliveryDate || Date.now(),
      time: new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
      remark: data.remark || "",
      status: deriveOrderStatus(items, "Done"),
      parentStatus: deriveOrderStatus(items, "Done"),
      sourceSaleId: data.sourceSaleId || null,
      sourceChallanId: data.sourceChallanId || null,
      companyId: req.user?.companyId,
    });

    const savedInvoice = await newInvoice.save();

    if (data.sourceChallanId && items.length) {
      try {
        const challan = await LensSaleChallan.findById(data.sourceChallanId);
        if (challan) {
          let addedUsedQty = 0;
          const invoicedItemIds = items.map(it => String(it._id));

          challan.items = challan.items.map(chItem => {
            if (invoicedItemIds.includes(String(chItem._id)) && !chItem.isInvoiced) {
              chItem.isInvoiced = true;
              chItem.itemStatus = "Done"; // Mark as Done
              const invItem = items.find(it => String(it._id) === String(chItem._id));
              const qtyUsed = Number(invItem?.qty) || 0;

              if (!challan.usageHistory) challan.usageHistory = [];
              challan.usageHistory.push({
                invoiceId: savedInvoice._id.toString(),
                billNo: savedInvoice.billData.billNo || "",
                series: savedInvoice.billData.billSeries || "",
                qtyUsed,
                date: new Date(),
              });
              addedUsedQty += qtyUsed;
            }
            return chItem;
          });

          challan.usedQty = Number(challan.usedQty || 0) + addedUsedQty;
          const itemsTotalQty = Array.isArray(challan.items)
            ? challan.items.reduce((s, it) => s + (Number(it.qty) || 0), 0)
            : 0;

          challan.orderQty = Number(challan.orderQty ?? itemsTotalQty);
          challan.balQty = Math.max(0, Number(challan.orderQty || 0) - Number(challan.usedQty || 0));

          // Recalculate challan status
          challan.status = deriveOrderStatus(challan.items, challan.status);

          // If all items are invoiced, mark top-level flag
          if (challan.items.every(it => it.isInvoiced)) {
            challan.isInvoiced = true;
            challan.invoiceId = savedInvoice._id;
          }

          challan.markModified('items');
          await challan.save();
          console.log(`[LEDGER] Updated Sale Challan ${data.sourceChallanId} with invoiced items`);

          // Update usedIn
          try {
            if (!challan.usedIn) challan.usedIn = [];
            if (!challan.usedIn.some(u => u.type === 'SI' && u.number === savedInvoice.billData.billNo)) {
              challan.usedIn.push({ type: 'SI', number: savedInvoice.billData.billNo });
              await challan.save();
            }
          } catch (err) {
            console.warn("Could not update challan usedIn:", err.message);
          }

          // Sync with Sale Order if exists - use appropriate model based on orderType
          if (challan.sourceSaleId) {
            if (challan.orderType === 'RX') {
              const RxSaleOrder = (await import("../models/RxSaleOrder.js")).default;
              const rxSaleOrder = await RxSaleOrder.findById(challan.sourceSaleId);
              if (rxSaleOrder) {
                rxSaleOrder.items = rxSaleOrder.items.map(sItem => {
                  if (invoicedItemIds.includes(String(sItem._id))) {
                    sItem.isInvoiced = true;
                    sItem.itemStatus = "Done";
                  }
                  return sItem;
                });
                rxSaleOrder.status = deriveOrderStatus(rxSaleOrder.items, rxSaleOrder.status);
                if (!rxSaleOrder.usedIn) rxSaleOrder.usedIn = [];
                if (!rxSaleOrder.usedIn.some(u => u.type === 'SI' && u.number === savedInvoice.billData.billNo)) {
                  rxSaleOrder.usedIn.push({ type: 'SI', number: savedInvoice.billData.billNo });
                }
                await rxSaleOrder.save();
                console.log(`[SYNC] Updated RX Sale Order ${challan.sourceSaleId} from Challan -> Invoice flow`);
              }
            } else if (challan.orderType === 'CONTACT') {
              const ContactLensSaleOrder = (await import("../models/ContactLensSaleOrder.js")).default;
              const contactOrder = await ContactLensSaleOrder.findById(challan.sourceSaleId);
              if (contactOrder) {
                contactOrder.items = contactOrder.items.map(sItem => {
                  if (invoicedItemIds.includes(String(sItem._id))) {
                    sItem.isInvoiced = true;
                    sItem.itemStatus = "Done";
                  }
                  return sItem;
                });
                contactOrder.status = deriveOrderStatus(contactOrder.items, contactOrder.status);
                if (!contactOrder.usedIn) contactOrder.usedIn = [];
                if (!contactOrder.usedIn.some(u => u.type === 'SI' && u.number === savedInvoice.billData.billNo)) {
                  contactOrder.usedIn.push({ type: 'SI', number: savedInvoice.billData.billNo });
                }
                await contactOrder.save();
                console.log(`[SYNC] Updated Contact Lens Sale Order ${challan.sourceSaleId} from Challan -> Invoice flow`);
              }
            } else {
              const saleOrder = await LensSaleOrder.findById(challan.sourceSaleId);
              if (saleOrder) {
                saleOrder.items = saleOrder.items.map(sItem => {
                  if (invoicedItemIds.includes(String(sItem._id))) {
                    sItem.isInvoiced = true;
                    sItem.itemStatus = "Done";
                  }
                  return sItem;
                });
                saleOrder.status = deriveOrderStatus(saleOrder.items, saleOrder.status);
                if (!saleOrder.usedIn) saleOrder.usedIn = [];
                if (!saleOrder.usedIn.some(u => u.type === 'SI' && u.number === savedInvoice.billData.billNo)) {
                  saleOrder.usedIn.push({ type: 'SI', number: savedInvoice.billData.billNo });
                }
                await saleOrder.save();
                console.log(`[SYNC] Updated Lens Sale Order ${challan.sourceSaleId} from Challan -> Invoice flow`);
              }
            }
          }
        }
      } catch (err) {
        console.warn("Could not update source docs flags:", err.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Lens Invoice created successfully (stock not deducted)",
      data: savedInvoice,
    });
  } catch (err) {
    console.error("Error creating lens invoice:", err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        error: Object.values(err.errors).map(e => e.message).join(', ')
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to create invoice",
      error: err.message,
    });
  }
};

const createChallanFromInvoice = async (req, res) => {
  try {
    const data = req.body || {};
    const { invoiceId, items } = data;

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({
        success: false,
        message: "At least one item is required",
      });
    }

    // Map invoice items to challan items
    const challanItems = items.map((item) => ({
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
      isInvoiced: false,
      salePrice: Number(item.salePrice) || 0,
      discount: Number(item.discount) || 0,
      totalAmount: Number(item.totalAmount) || 0,
      sellPrice: Number(item.sellPrice) || 0,
      combinationId: item.combinationId || "",
      orderNo: item.orderNo || "",
      remark: item.remark || "",
    }));

    const totalQty = challanItems.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

    const taxes = (data.taxes || []).map((t) => ({
      taxName: t.taxName || "",
      type: t.type || "Additive",
      percentage: Number(t.percentage) || 0,
      amount: Number(t.amount) || 0,
      meta: t.meta || {},
    }));

    const subtotal = challanItems.reduce((sum, it) => sum + (Number(it.totalAmount) || 0), 0);
    const taxesAmount = taxes.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const netAmount = subtotal + taxesAmount;
    const paidAmount = Number(data.paidAmount || 0);
    const dueAmount = netAmount - paidAmount;
    const grossAmount = challanItems.reduce(
      (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.salePrice) || 0),
      0
    );

    const newChallan = new LensSaleChallan({
      billData: data.billData || {},
      partyData: data.partyData || {},
      items: challanItems,
      taxes,
      orderQty: totalQty,
      balQty: totalQty,
      usedQty: 0,
      grossAmount,
      subtotal,
      taxesAmount,
      netAmount,
      paidAmount,
      dueAmount,
      deliveryDate: data.deliveryDate || Date.now(),
      remark: data.remark || "",
      status: data.status || "Pending",
      isInvoiced: false,
    });

    const savedChallan = await newChallan.save();

    return res.status(201).json({
      success: true,
      message: "Challan created successfully from invoice",
      data: savedChallan,
    });
  } catch (err) {
    console.error("Error creating challan from invoice:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create challan",
      error: err.message,
    });
  }
};

const updateSaleChallanStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, cancelReason } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const validStatuses = ["pending", "in-process", "done", "cancelled"];
    if (!validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const updatedChallan = await LensSaleChallan.findByIdAndUpdate(
      id,
      { status, cancelReason },
      { new: true }
    );

    if (!updatedChallan) {
      return res.status(404).json({
        success: false,
        message: "Sale Challan not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: updatedChallan,
    });
  } catch (err) {
    console.error("Error updating sale challan status:", err);
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

    const updated = await LensSaleChallan.findByIdAndUpdate(
      id,
      { cancelReason },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Sale Challan not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cancel reason updated successfully",
      data: updated,
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

const updateDeliveryPerson = async (req, res) => {
  try {
    const { id } = req.params;
    const { deliveryPerson } = req.body;

    if (!deliveryPerson || typeof deliveryPerson !== "string") {
      return res.status(400).json({
        success: false,
        message: "Delivery person name is required and must be a string",
      });
    }

    const updatedChallan = await LensSaleChallan.findByIdAndUpdate(
      id,
      { 
        deliveryPerson: deliveryPerson.trim(),
        deliveryPersonAssignedAt: new Date()
      },
      { new: true }
    );

    if (!updatedChallan) {
      return res.status(404).json({
        success: false,
        message: "Sale Challan not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Delivery person updated successfully",
      data: updatedChallan,
    });
  } catch (err) {
    console.error("Error updating delivery person:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update delivery person",
      error: err.message,
    });
  }
};

const updateItemStatus = async (req, res) => {
  try {
    const { id: challanId } = req.params;
    const { itemIds, newStatus } = req.body;

    const challan = await LensSaleChallan.findById(challanId);
    if (!challan) return res.status(404).json({ success: false, message: "Challan not found" });

    const idSet = new Set(itemIds.map(id => String(id)));
    challan.items = challan.items.map(item => {
      if (idSet.has(String(item._id))) {
        item.itemStatus = newStatus;
      }
      return item;
    });

    challan.status = deriveOrderStatus(challan.items, challan.status);
    await challan.save();

    // Sync with Sale Order if exists
    if (challan.sourceSaleId) {
      const order = await LensSaleOrder.findById(challan.sourceSaleId);
      if (order) {
        order.items = order.items.map(oItem => {
          if (idSet.has(String(oItem._id))) {
            oItem.itemStatus = newStatus;
          }
          return oItem;
        });
        order.status = deriveOrderStatus(order.items, order.status);
        await order.save();

        // Now sync other challans/invoices for this order
        const otherChallans = await LensSaleChallan.find({ sourceSaleId: challan.sourceSaleId, _id: { $ne: challanId } });
        for (const oc of otherChallans) {
          oc.items = oc.items.map(oci => {
            if (idSet.has(String(oci._id))) oci.itemStatus = newStatus;
            return oci;
          });
          oc.status = deriveOrderStatus(oc.items, oc.status);
          await oc.save();
        }

        const invoices = await LensSale.find({ sourceSaleId: challan.sourceSaleId });
        for (const inv of invoices) {
          inv.items = inv.items.map(ivi => {
            if (idSet.has(String(ivi._id))) ivi.itemStatus = newStatus;
            return ivi;
          });
          inv.status = deriveOrderStatus(inv.items, inv.status);
          await inv.save();
        }
      }
    }

    return res.status(200).json({ success: true, data: challan });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const updateItemRemark = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const { itemId, remark } = req.body;

    const order = await LensSaleChallan.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Challan not found" });
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
    console.error("Error in updateItemRemark (LensSaleChallan):", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Manually send a WhatsApp reminder for a specific challan.
 * Only sends if dueAmount > 0.
 */
const sendChallanWhatsAppReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;

    const challan = await LensSaleChallan.findOne({ _id: id, companyId });
    if (!challan) {
      return res.status(404).json({ success: false, message: "Challan not found" });
    }

    const dueAmount = Number(challan.dueAmount || 0);
    if (dueAmount <= 0) {
      return res.status(200).json({ success: false, message: "No pending amount. WhatsApp not sent." });
    }

    // Look up the party account by name (strict tenant isolation)
    const partyName = challan.partyData?.partyAccount || "";
    const account = await Account.findOne({
      companyId,
      $or: [
        { Name: partyName },
        { PrintName: partyName },
        { AccountId: partyName },
      ],
    });

    const rawPhone = account?.MobileNumber || challan.partyData?.contactNumber || "";
    const cleanPhone = rawPhone.replace(/\D/g, "");
    const phone = cleanPhone
      ? cleanPhone.startsWith("91") && cleanPhone.length >= 12
        ? cleanPhone
        : `91${cleanPhone}`
      : null;

    if (!phone) {
      return res.status(400).json({ success: false, message: "No phone number found for this party." });
    }

    const challanNo = challan.billData?.billNo || "";
    const displayName = account?.PrintName || account?.Name || partyName;

    const message = `Dear ${displayName},\nThis is a reminder that payment for your Sale Challan is still pending.\n\nVoucher No: ${challanNo}\nPending Amount: ₹${dueAmount}\n\nPlease clear the payment before the invoice is automatically generated.\n\nThank you.`;

    const result = await sendWhatsAppMessage(phone, message);

    // Mark reminder sent
    await LensSaleChallan.updateOne(
      { _id: challan._id },
      {
        $set: {
          reminderSent: true,
          reminderSentAt: new Date(),
          reminderType: "WhatsApp",
          whatsappStatus: result.status,
          whatsappResponse: result.response,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: result.status === "Success" ? "WhatsApp reminder sent successfully." : "WhatsApp send attempted (check credentials).",
      whatsappStatus: result.status,
      phone,
    });
  } catch (err) {
    console.error("[sendChallanWhatsAppReminder] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to send reminder.", error: err.message });
  }
};

export {
  addLensSaleChallan,
  getLensSaleChallan,
  getAllLensSaleChallan,
  removeLensSaleChallan,
  editLensSaleChallan,
  createLensInvoice,
  createChallanFromInvoice,
  updateSaleChallanStatus,
  updateDeliveryPerson,
  updateItemStatus,
  sendChallanWhatsAppReminder,
  updateItemRemark,
  updateCancelReason,
};

