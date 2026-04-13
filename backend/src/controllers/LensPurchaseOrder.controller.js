import LensPurchase from "../models/LensPurchase.js";
import LensGroup from "../models/LensGroup.js";
import LensPurchaseOrder from "../models/LensPurchaseOrder.js";
import LensPurchaseChallan from "../models/LensPurchaseChallan.js";
import mongoose from "mongoose";
import { derivePurchaseOrderStatus } from "../utils/statusManager.js";
const addLensPurchaseOrder = async (req, res) => {
  try {
    const data = req.body;
    let totalqty = 0;

    const items = (data.items || []).map((item) => {
      const qtyNum = Number(item.qty) || 0;
      totalqty += qtyNum;
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
        qty: qtyNum,
        purchasePrice: Number(item.purchasePrice) || 0,
        discount: Number(item.discount) || 0,
        totalAmount: Number(item.totalAmount) || 0,
        sellPrice: Number(item.sellPrice) || 0,
        combinationId: item.combinationId || "",
        orderNo: item.orderNo || "",
        remark: item.remark || "",
        isInvoiced: false,
        isChallaned: false,
        itemStatus: item.itemStatus || "Pending",
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
        message: "At least one purchase order item is required",
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
    const balQty = orderQty; // not received anything yet

    const netAmount = subtotal + taxesAmount;
    const paidAmount = Number(data.paidAmount) || 0;
    const dueAmount = netAmount - paidAmount;

    const grossAmount = items.reduce(
      (sum, it) =>
        sum + (Number(it.qty) || 0) * (Number(it.purchasePrice) || 0),
      0
    );

    const partyData = {
      partyAccount: data.partyData?.partyAccount || "",
      address: data.partyData?.address || "",
      contactNumber: data.partyData?.contactNumber || "",
      stateCode: data.partyData?.stateCode || "",
      creditLimit: Number(data.partyData?.creditLimit) || 0,
      CurrentBalance: {
        amount: Number(data.partyData?.CurrentBalance?.amount) || 0,
        type: data.partyData?.CurrentBalance?.type || "Dr",
      }
    };

    const newPurchase = new LensPurchaseOrder({
      billData: data.billData || {},
      partyData,
      items,
      taxes,
      orderQty,
      balQty,
      grossAmount,
      subtotal,
      taxesAmount,
      netAmount,
      paidAmount,
      dueAmount,
      deliveryDate: data.deliveryDate
        ? new Date(data.deliveryDate)
        : new Date(),
      remark: data.remark || "",
      status: derivePurchaseOrderStatus(items, "Pending"),
      parentStatus: derivePurchaseOrderStatus(items, "Pending"),
    });

    console.log("Saving new purchase order payload:", JSON.stringify(newPurchase, null, 2));
    const savedPurchase = await newPurchase.save();

    // Update source sale order if exists
    if (data.sourceSaleId) {
      try {
        const SaleOrder = (await import("../models/LensSaleOrder.js")).default;
        const RxSaleOrder = (await import("../models/RxSaleOrder.js")).default;

        // Try finding in both Lens and Rx Sale Orders
        let sourceOrder = await SaleOrder.findById(data.sourceSaleId);
        if (!sourceOrder) {
          sourceOrder = await RxSaleOrder.findById(data.sourceSaleId);
        }

        if (sourceOrder) {
          let updatedOrder = false;

          // Link the purchase order to the sale order
          if (!sourceOrder.usedIn) sourceOrder.usedIn = [];
          if (!sourceOrder.usedIn.some(u => u.type === 'P' && u.number === savedPurchase.billData.billNo)) {
            sourceOrder.usedIn.push({ type: 'P', number: savedPurchase.billData.billNo });
            updatedOrder = true;
          }

          // Automatically set vendor for matching items and update itemStatus to "In Progress"
          const vendorName = partyData.partyAccount || "";
          let itemsChanged = false;

          for (const pItem of (data.items || [])) {
            if (pItem.saleOrderItemId) {
              const sItem = sourceOrder.items.id?.(pItem.saleOrderItemId) || sourceOrder.items.find(i => String(i._id) === String(pItem.saleOrderItemId));
              if (sItem) {
                // Update vendor if empty
                if (!sItem.vendor || sItem.vendor.trim() === "") {
                  sItem.vendor = vendorName;
                  itemsChanged = true;
                }
                // Update item status to "In Progress"
                if (sItem.itemStatus === "Pending") {
                  sItem.itemStatus = "In Progress";
                  itemsChanged = true;
                }
              }
            } else {
              // Fallback matching by name and eye
              const sItem = sourceOrder.items.find(i =>
                i.itemName === pItem.itemName &&
                i.eye === pItem.eye &&
                i.itemStatus === "Pending"
              );
              if (sItem) {
                if (!sItem.vendor || sItem.vendor.trim() === "") {
                  sItem.vendor = vendorName;
                }
                sItem.itemStatus = "In Progress";
                itemsChanged = true;
              }
            }
          }

          if (itemsChanged) {
            updatedOrder = true;
            sourceOrder.markModified("items");

            // Derive overall order status
            const { deriveOrderStatus } = await import("../utils/statusManager.js");
            sourceOrder.status = deriveOrderStatus(sourceOrder.items, sourceOrder.status);
            if (sourceOrder.parentStatus) sourceOrder.parentStatus = sourceOrder.status;
          }

          if (updatedOrder) {
            await sourceOrder.save();
          }
        }
      } catch (err) {
        console.warn("Could not update source sale order usedIn or vendor:", err.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Purchase Order added successfully",
      data: savedPurchase,
    });
  } catch (err) {
    console.error("Error adding purchase order:", err);
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate Bill Number: This Bill Number already exists in the database. Please use a unique Bill Number.",
        error: err.message
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to add purchase order",
      error: err.message || "Unknown error",
      details: err.errors ? Object.keys(err.errors).reduce((acc, key) => {
        acc[key] = err.errors[key].message;
        return acc;
      }, {}) : null
    });
  }
};


const getAllLensPurchaseOrder = async (req, res) => {
  try {
    console.log("Fetching all lens purchase orders...");
    const purchaseOrders = await LensPurchaseOrder.find().sort({ createdAt: -1 });
    console.log(`Successfully fetched ${purchaseOrders.length} orders.`);
    return res.status(200).json({
      success: true,
      data: purchaseOrders,
    });
  } catch (err) {
    console.error("Error fetching lens purchase Orders:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch lens purchase orders",
      error: err.message,
    });
  }
};
const getLensPurchaseOrder = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Purchase ID is required" });
    }
    const purchaseOrder = await LensPurchaseOrder.findById(id);
    if (!purchaseOrder) {
      return res
        .status(404)
        .json({ success: false, message: "Lens purchase not found" });
    }
    return res.status(200).json({ success: true, data: purchaseOrder });
  } catch (err) {
    console.error("Error fetching lens purchase:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

const removeLensPurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await LensPurchaseOrder.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (existing.status === "Done") {
      return res.status(400).json({
        success: false,
        message: "Order is already completed and cannot be deleted.",
      });
    }

    await LensPurchaseOrder.findByIdAndDelete(id);

    res.status(200).json({
      message: "Lens Purchase Order deleted successfully",
    });
  } catch (error) {
    console.error("Delete Order Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const editLensPurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Purchase Order ID is required" });
    }

    const existing = await LensPurchaseOrder.findById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Purchase order not found" });
    }

    if (existing.status === "Done") {
      return res.status(400).json({
        success: false,
        message: "Order is already completed and cannot be modified.",
      });
    }

    // safe boolean parser
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
      // keep raw + flag so we don't accidentally overwrite existing value
      isInvoicedRaw: item.hasOwnProperty("isInvoiced")
        ? item.isInvoiced
        : undefined,
      hasisInvoiced: item.hasOwnProperty("isInvoiced"),
      purchasePrice: Number(item.purchasePrice) || 0,
      discount: Number(item.discount) || 0,
      totalAmount: Number(item.totalAmount) || 0,
      sellPrice: Number(item.sellPrice) || 0,
      combinationId: item.combinationId
        ? String(item.combinationId)
        : item.CombinationId
          ? String(item.CombinationId)
          : "",
      orderNo: item.orderNo || "",
      itemStatus: item.itemStatus || "Pending",
      remark: item.remark || "",
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
      (s, it) => s + (Number(it.qty) || 0) * (Number(it.purchasePrice) || 0),
      0
    );

    const newOrderQty = incomingItems.reduce(
      (sum, it) => sum + (Number(it.qty) || 0),
      0
    );
    // for purchase, use receivedQty (items already received)
    const existingUsedQty = Number(existing.usedQty || 0);

    const newBalQty = Math.max(0, newOrderQty - existingUsedQty);

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

        // resolve isInvoiced: prefer incoming if explicitly provided, otherwise preserve DB value
        const resolvedisInvoiced = it.hasisInvoiced
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
          isInvoiced: resolvedisInvoiced,
          purchasePrice: it.purchasePrice,
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
        const resolvedisInvoiced = it.hasisInvoiced ? parseBool(it.isInvoicedRaw) : false;
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
          isInvoiced: resolvedisInvoiced,
          purchasePrice: it.purchasePrice,
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

    const partyData = data.partyData ? {
      partyAccount: data.partyData.partyAccount || "",
      address: data.partyData.address || "",
      contactNumber: data.partyData.contactNumber || "",
      stateCode: data.partyData.stateCode || "",
      creditLimit: Number(data.partyData.creditLimit) || 0,
      CurrentBalance: {
        amount: Number(data.partyData.CurrentBalance?.amount) || 0,
        type: data.partyData.CurrentBalance?.type || "Dr",
      }
    } : (existing.partyData || {});

    existing.billData = data.billData || existing.billData || {};
    existing.partyData = partyData;
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

    // Recalculate status based on items
    existing.status = derivePurchaseOrderStatus(existing.items, data.status || existing.status);
    existing.parentStatus = existing.status;

    const newPaidAmount = Number(data.paidAmount ?? existing.paidAmount ?? 0);
    const newBalanceAmount = netAmount - newPaidAmount;

    existing.paidAmount = newPaidAmount;
    existing.dueAmount = newBalanceAmount;

    const updated = await existing.save();

    return res.status(200).json({
      success: true,
      message: "Purchase order updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Error updating purchase order:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update purchase order",
      error: err.message,
    });
  }
};


const createLensPurchaseInvoice = async (req, res) => {
  try {
    const data = req.body || {};

    if (!Array.isArray(data.items) || !data.items.length) {
      return res.status(400).json({
        success: false,
        message: "At least one purchase invoice item is required",
      });
    }

    const items = (data.items || []).map((item) => ({
      _id: item._id || undefined,
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
      orderNo: item.orderNo || "",
      remark: item.remark || "",
      isInvoiced: true,
      // <-- set purchasedAt per item (use provided value or now)
      purchasedAt: item.purchasedAt ? new Date(item.purchasedAt) : new Date(),
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

    // compute invoice-level summary
    const totalQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
    const totalAmount = items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0);

    const invoiceBillData = {
      billSeries: "",
      billNo: "",
      billType: "",
      godown: "",
      bookedBy: "",
    };

    const newInvoice = new LensPurchase({
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
      summary: { totalQty, totalAmount }, // <-- summary set
      deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : Date.now(),
      time: new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
      remark: data.remark || "",
      status: derivePurchaseOrderStatus(items, "Done"),
      parentStatus: derivePurchaseOrderStatus(items, "Done"),
      sourcePurchaseId: data.sourcePurchaseId || null,
    });

    const savedInvoice = await newInvoice.save();

    if (data.sourcePurchaseId && items.length) {
      try {
        const challan = await LensPurchaseOrder.findById(data.sourcePurchaseId);
        console.log(challan)
        if (challan) {
          let addedUsedQty = 0;
          for (const invItem of items) {
            if (!invItem._id) continue;
            const pItem = challan.items.id(invItem._id);
            if (pItem && !pItem.isInvoiced) {
              pItem.isInvoiced = true;
              const qtyUsed = Number(invItem.qty) || 0;
              challan.usageHistory = challan.usageHistory || [];
              challan.usageHistory.push({
                invoiceId: savedInvoice._id.toString(),
                billNo: savedInvoice.billData.billNo || "",
                series: savedInvoice.billData.billSeries || "",
                qtyUsed,
                date: new Date(),
              });
              addedUsedQty += qtyUsed;
            }
          }

          challan.usedQty = Number(challan.usedQty || 0) + addedUsedQty;
          const itemsTotalQty = Array.isArray(challan.items)
            ? challan.items.reduce((s, it) => s + (Number(it.qty) || 0), 0)
            : 0;

          challan.orderQty = Number(challan.orderQty ?? itemsTotalQty);
          challan.balQty = Math.max(0, Number(challan.orderQty || 0) - Number(challan.usedQty || 0));

          // Set item statuses to Done in items array too
          const invoicedItemIds = items.map(it => String(it._id));
          challan.items = challan.items.map(sItem => {
            if (invoicedItemIds.includes(String(sItem._id))) {
              sItem.itemStatus = "Done";
              sItem.isInvoiced = true;
            }
            return sItem;
          });

          challan.status = derivePurchaseOrderStatus(challan.items, challan.status);
          challan.parentStatus = challan.status;

          if (!challan.usedIn) challan.usedIn = [];
          if (!challan.usedIn.some(u => u.type === 'PI' && u.number === savedInvoice.billData.billNo)) {
            challan.usedIn.push({ type: 'PI', number: savedInvoice.billData.billNo });
          }

          await challan.save();
        }
      } catch (err) {
        console.warn("Could not update selected items invoice flags for purchase challan:", err.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Purchase invoice created successfully",
      data: savedInvoice,
    });
  } catch (err) {
    console.error("Error creating purchase invoice:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create purchase invoice",
      error: err.message,
    });
  }
};


const createLensPurchaseChallan = async (req, res) => {
  try {
    let data = req.body || {};

    // If only orderId is sent (e.g. Postman), auto-fetch order + items
    if (data.orderId && (!data.items || data.items.length === 0)) {
      let sourceOrder;
      try { sourceOrder = await LensPurchaseOrder.findById(data.orderId); }
      catch (e) { return res.status(400).json({ success: false, message: "Invalid orderId: " + e.message }); }
      if (!sourceOrder) {
        return res.status(404).json({ success: false, message: "Order not found: " + data.orderId });
      }
      const unchallanedItems = sourceOrder.items
        .filter((item) => !item.isChallaned)
        .map(item => (item.toObject ? item.toObject() : Object.assign({}, item)));
      console.log("[createLensPurchaseChallan] unchallaned:", unchallanedItems.length);
      if (!unchallanedItems.length) {
        return res.status(400).json({ success: false, message: "All items are already challaned." });
      }
      data = Object.assign({}, data, {
        sourcePurchaseId: data.orderId,
        billData: sourceOrder.billData,
        partyData: sourceOrder.partyData,
        taxes: sourceOrder.taxes || [],
        items: unchallanedItems,
        selectedItemIds: unchallanedItems.map((item) => String(item._id)),
      });
    }

    const selectedItemIds = (data.selectedItemIds || []).map(String);
    const rawItems = data.items || [];
    const filteredItems = selectedItemIds.length > 0
      ? rawItems.filter((item) => selectedItemIds.includes(String(item._id)))
      : rawItems;

    const items = filteredItems.map((item) => ({
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
      purchasePrice: Number(item.purchasePrice) || 0,
      discount: Number(item.discount) || 0,
      totalAmount: Number(item.totalAmount) || 0,
      sellPrice: Number(item.sellPrice) || 0,
      combinationId: item.combinationId || "",
      orderNo: item.orderNo || "",
      remark: item.remark || "",
      isChallaned: true,
      itemStatus: "In Progress",
    }));

    const taxes = (data.taxes || []).map((tax) => ({
      taxName: tax.taxName || "",
      type: tax.type || "Additive",
      percentage: Number(tax.percentage) || 0,
      amount: Number(tax.amount) || 0,
      meta: tax.meta || {},
    }));

    console.log("[createLensPurchaseChallan] final items count:", items.length);

    if (!items.length) {
      return res.status(400).json({ success: false, message: "At least one challan item is required" });
    }

    const subtotal = items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0);
    const taxesAmount = taxes.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const netAmount = subtotal + taxesAmount;
    const paidAmount = Number(data.paidAmount) || 0;
    const dueAmount = netAmount - paidAmount;
    const grossAmount = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.purchasePrice) || 0), 0);

    for (const it of items) {
      if (Number(it.qty) > 0) {
        try {
          let combId = it.combinationId;
          if (!combId) {
            const lookup = await LensGroup.findOne({ productName: it.itemName });
            if (lookup && lookup.addGroups) {
              const ag = lookup.addGroups.find(g => Number(g.addValue) === Number(it.add || 0));
              if (ag && ag.combinations) {
                const mc = ag.combinations.find(c =>
                  Number(c.sph) === Number(it.sph || 0) && Number(c.cyl) === Number(it.cyl || 0) &&
                  (it.eye === "RL" ? (c.eye === "R" || c.eye === "L" || c.eye === "RL") : c.eye === it.eye));
                if (mc) combId = mc._id;
              }
            }
          }
          if (!combId) { console.warn("skipping stock: no combinationId for", it.itemName); continue; }
          const resolvedId = new mongoose.Types.ObjectId(combId);
          const parent = await LensGroup.findOne({ "addGroups.combinations._id": resolvedId });
          if (!parent) { continue; }
          let matched = null;
          for (const ag of parent.addGroups) { const comb = ag.combinations.id(resolvedId); if (comb) { matched = comb; break; } }
          if (!matched) { continue; }
          matched.initStock = Number(matched.initStock || 0) + Number(it.qty || 0);
          await parent.save();
        } catch (err) { console.error("Error stock for", it.itemName, err.message); continue; }
      }
    }

    const challanBillData = {
      billSeries: (data.billData && data.billData.billSeries) || "",
      billNo: (data.billData && data.billData.billNo) || "",
      billType: (data.billData && data.billData.billType) || "",
      godown: (data.billData && data.billData.godown) || "",
      bookedBy: (data.billData && data.billData.bookedBy) || "",
      date: (data.billData && data.billData.date) || new Date(),
    };

    const newChallan = new LensPurchaseChallan({
      billData: challanBillData, partyData: data.partyData || {}, items, taxes,
      grossAmount, subtotal, taxesAmount, netAmount, paidAmount, dueAmount,
      deliveryDate: data.deliveryDate || Date.now(), time: new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
      remark: data.remark || "", status: derivePurchaseOrderStatus(items, "In Progress"),
      parentStatus: derivePurchaseOrderStatus(items, "In Progress"),
      sourcePurchaseId: data.sourcePurchaseId || null, orderType: "LENS",
    });

    const savedChallan = await newChallan.save();

    if (data.sourcePurchaseId && items.length) {
      try {
        const order = await LensPurchaseOrder.findById(data.sourcePurchaseId);
        if (order) {
          let addedUsedQty = 0;
          for (const invItem of items) {
            if (!invItem._id) continue;
            const sItem = order.items.id(invItem._id);
            if (sItem && !sItem.isChallaned) {
              sItem.isChallaned = true;
              const qtyUsed = Number(invItem.qty) || 0;
              order.usageHistory.push({ challanId: savedChallan._id.toString(), billNo: savedChallan.billData.billNo || "", series: savedChallan.billData.billSeries || "", qtyUsed, date: new Date() });
              addedUsedQty += qtyUsed;
            }
          }
          order.usedQty = Number(order.usedQty || 0) + addedUsedQty;
          const itTotalQty = Array.isArray(order.items) ? order.items.reduce((s, it) => s + (Number(it.qty) || 0), 0) : 0;
          order.orderQty = Number(order.orderQty != null ? order.orderQty : itTotalQty);
          order.balQty = Math.max(0, Number(order.orderQty || 0) - Number(order.usedQty || 0));
          order.items = order.items.map(sItem => {
            if (selectedItemIds.includes(String(sItem._id))) { sItem.itemStatus = "In Progress"; sItem.isChallaned = true; }
            return sItem;
          });
          order.status = derivePurchaseOrderStatus(order.items, order.status);
          order.parentStatus = order.status;
          if (!order.usedIn) order.usedIn = [];
          if (!order.usedIn.some(u => u.type === "PC" && u.number === savedChallan.billData.billNo)) {
            order.usedIn.push({ type: "PC", number: savedChallan.billData.billNo });
          }
          await order.save();
        }
      } catch (err) { console.warn("Could not update challan flags:", err.message); }
    }

    return res.status(201).json({ success: true, message: "Challan created successfully", data: savedChallan });
  } catch (err) {
    console.error("Error creating lens challan:", err);
    return res.status(500).json({ success: false, message: "Failed to create challan", error: err.message });
  }
};

const updatePurchaseOrderStatus = async (req, res) => {
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

    const updatedOrder = await LensPurchaseOrder.findByIdAndUpdate(
      id,
      { status, cancelReason },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: updatedOrder,
    });
  } catch (err) {
    console.error("Error updating purchase order status:", err);
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
    const updated = await LensPurchaseOrder.findByIdAndUpdate(id, { cancelReason }, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: "Purchase Order not found" });
    return res.status(200).json({ success: true, message: "Cancel reason updated", data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to update", error: err.message });
  }
};

const updateOrderQuantities = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderQty, usedQty } = req.body;

    const order = await LensPurchaseOrder.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
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
    console.error("Error updating purchase order quantities:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update quantities",
      error: err.message,
    });
  }
};


/**
 * Update individual item quantity in Purchase Order
 */
const updateItemQty = async (req, res) => {
  try {
    const { orderId, itemId, newQty } = req.body;

    if (!orderId || !itemId || newQty === undefined) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: orderId, itemId, newQty",
      });
    }

    const order = await LensPurchaseOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found in order",
      });
    }

    // Update quantity
    const oldQty = Number(item.qty) || 0;
    const qty = Number(newQty);

    if (qty < 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity cannot be negative",
      });
    }

    item.qty = qty;

    // Recalculate item total amount if needed (assuming logic: qty * purchasePrice - discount)
    // Note: If you have complex logic for totalAmount, replicate it here.
    // Generally: totalAmount = (qty * purchasePrice) - discount
    // Ensure purchasePrice and discount are numbers
    const purchasePrice = Number(item.purchasePrice) || 0;
    const discount = Number(item.discount) || 0;
    item.totalAmount = (qty * purchasePrice) - discount;

    // Recalculate Order Totals
    const items = order.items;

    // Order Qty
    order.orderQty = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

    // Gross Amount
    order.grossAmount = items.reduce(
      (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.purchasePrice) || 0),
      0
    );

    // Subtotal
    order.subtotal = items.reduce(
      (sum, it) => sum + (Number(it.totalAmount) || 0),
      0
    );

    // Taxes
    const taxesAmount = (order.taxes || []).reduce(
      (s, t) => s + (Number(t.amount) || 0),
      0
    );
    order.taxesAmount = taxesAmount;

    // Net Amount
    order.netAmount = order.subtotal + order.taxesAmount;

    // Due Amount
    const paidAmount = Number(order.paidAmount) || 0;
    order.dueAmount = order.netAmount - paidAmount;

    // Balance Qty (Order Qty - Used Qty)
    const usedQty = Number(order.usedQty) || 0;
    order.balQty = Math.max(0, order.orderQty - usedQty);

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Item quantity updated successfully",
      data: order,
    });

  } catch (err) {
    console.error("Error updating item quantity:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update item quantity",
      error: err.message,
    });
  }
};

export {
  addLensPurchaseOrder,
  getLensPurchaseOrder,
  getAllLensPurchaseOrder,
  removeLensPurchaseOrder,
  editLensPurchaseOrder,
  createLensPurchaseInvoice,
  createLensPurchaseChallan,
  updatePurchaseOrderStatus,
  updateOrderQuantities,
  updatePurchaseItemStatus,
  syncPurchaseOrderAcrossModulesInternal,
  updateItemQty,
  updatePurchaseOrderItemsQty,
  updateCancelReason,
};

/**
 * Bulk Update Item Quantities for an Order
 */
const updatePurchaseOrderItemsQty = async (req, res) => {
  try {
    const { orderId, items } = req.body;
    // items: [{ itemId, qty }, ...]

    if (!orderId || !items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: orderId, items array",
      });
    }

    const order = await LensPurchaseOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    let modified = false;

    items.forEach(({ itemId, qty }) => {
      const item = order.items.id(itemId);
      if (item) {
        const newVal = Number(qty);
        if (!isNaN(newVal) && newVal >= 0) {
          item.qty = newVal;
          // Recalculate item total
          const purchasePrice = Number(item.purchasePrice) || 0;
          const discount = Number(item.discount) || 0;
          item.totalAmount = (newVal * purchasePrice) - discount;
          modified = true;
        }
      }
    });

    if (modified) {
      // Recalculate Order Totals
      const allItems = order.items;

      // Order Qty
      order.orderQty = allItems.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

      // Gross Amount
      order.grossAmount = allItems.reduce(
        (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.purchasePrice) || 0),
        0
      );

      // Subtotal
      order.subtotal = allItems.reduce(
        (sum, it) => sum + (Number(it.totalAmount) || 0),
        0
      );

      // Taxes
      const taxesAmount = (order.taxes || []).reduce(
        (s, t) => s + (Number(t.amount) || 0),
        0
      );
      order.taxesAmount = taxesAmount;

      // Net Amount
      order.netAmount = order.subtotal + order.taxesAmount;

      // Due Amount
      const paidAmount = Number(order.paidAmount) || 0;
      order.dueAmount = order.netAmount - paidAmount;

      // Balance Qty (Order Qty - Used Qty)
      const usedQty = Number(order.usedQty) || 0;
      order.balQty = Math.max(0, order.orderQty - usedQty);

      await order.save();
    }

    return res.status(200).json({
      success: true,
      message: "Quantities updated successfully",
      data: order,
    });

  } catch (err) {
    console.error("Error bulk updating item quantities:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update quantities",
      error: err.message,
    });
  }
};

/**
 * Manual Item Status Update
 */
async function updatePurchaseItemStatus(req, res) {
  try {
    const { orderId, itemIds, newStatus } = req.body;
    const order = await LensPurchaseOrder.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    order.items = order.items.map(item => {
      if (itemIds.includes(String(item._id))) {
        item.itemStatus = newStatus;
      }
      return item;
    });

    order.status = derivePurchaseOrderStatus(order.items, order.status);
    order.parentStatus = order.status;
    await order.save();

    // Sync across modules
    await syncPurchaseOrderAcrossModulesInternal(orderId);

    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Sync logic
 */
async function syncPurchaseOrderAcrossModulesInternal(orderId) {
  const order = await LensPurchaseOrder.findById(orderId);
  if (!order) return;

  // Sync with Challans
  const challans = await LensPurchaseChallan.find({ sourcePurchaseId: orderId });
  for (const challan of challans) {
    let changed = false;
    challan.items = challan.items.map(cItem => {
      const oItem = order.items.find(oi => String(oi._id) === String(cItem._id));
      if (oItem && oItem.itemStatus !== cItem.itemStatus) {
        cItem.itemStatus = oItem.itemStatus;
        changed = true;
      }
      return cItem;
    });
    if (changed) {
      challan.status = derivePurchaseOrderStatus(challan.items, challan.status);
      challan.parentStatus = challan.status;
      await challan.save();
    }
  }

  // Sync with Invoices
  const invoices = await LensPurchase.find({ sourcePurchaseId: orderId });
  for (const invoice of invoices) {
    let changed = false;
    invoice.items = invoice.items.map(iItem => {
      const oItem = order.items.find(oi => String(oi._id) === String(iItem._id));
      if (oItem && oItem.itemStatus !== iItem.itemStatus) {
        iItem.itemStatus = oItem.itemStatus;
        changed = true;
      }
      return iItem;
    });
    if (changed) {
      invoice.status = derivePurchaseOrderStatus(invoice.items, invoice.status);
      invoice.parentStatus = invoice.status;
      await invoice.save();
    }
  }
}
