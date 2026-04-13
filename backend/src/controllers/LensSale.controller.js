import LensSale from "../models/LensSale.js";
import LensGroup from "../models/LensGroup.js";
import LensSaleOrder from "../models/LensSaleOrder.js";
import LensSaleChallan from "../models/LensSaleChallan.js";
import mongoose from "mongoose";
import { logDeletion } from "../utils/logDeletion.js";
import { deriveOrderStatus, initializeItemStatuses } from "../utils/statusManager.js";
import { 
  validateStockAvailability, 
  deductStock, 
  restoreStock, 
  adjustStockForEdit 
} from "../utils/stockDeductionHelper.js";

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

const addLensSale = async (req, res) => {
  try {
    const data = req.body || {};

    const items = (data.items || []).map((item) => ({
      _id: item._id, // Preserve _id for matching
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
      itemStatus: item.itemStatus || "Pending", // Initialize item-level status
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
        message: "At least one sale item is required",
      });
    }

    // compute totals defensively
    const subtotal = items.reduce((sum, it) => sum + (Number(it.totalAmount) || 0), 0);
    const taxesAmount = taxes.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const netAmount = subtotal + taxesAmount;
    const paidAmount = Number(data.paidAmount) || 0;
    const dueAmount = netAmount - paidAmount;
    const grossAmount = items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.salePrice) || 0), 0);

    // compute sale-level summary
    const totalQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
    const totalAmount = items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0);

    // ── Stock Deduction Logic ────────────────────────────────────────────────
    if (!data.sourceSaleId && !data.sourceChallanId) {
       // Only validate and deduct stock if this is a DIRECT Sale
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

    // Create and save sale document with summary
    const invoiceStatus = deriveOrderStatus(items, data.status || "Pending");

    const newSale = new LensSale({
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
      deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : Date.now(),
      summary: { totalQty, totalAmount },
      time: new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
      remark: data.remark || "",
      status: invoiceStatus,
      parentStatus: invoiceStatus,
      sourceSaleId: data.sourceSaleId || null,
      companyId: req.user?.companyId, // Tenant isolation
    });

    const savedSale = await newSale.save();

    if (data.sourceSaleId && items.length) {
      try {
        const sale = await LensSaleOrder.findById(data.sourceSaleId);
        if (sale) {
          let addedUsedQty = 0;
          for (const invItem of items) {
            if (!invItem._id) continue;
            const sItem = sale.items.id(invItem._id);
            if (sItem && !sItem.isInvoiced) {
              sItem.isInvoiced = true;
              sItem.itemStatus = "Done"; // Mark as done when invoiced
              const qtyUsed = Number(invItem.qty) || 0;
              sale.usageHistory.push({
                invoiceId: savedSale._id.toString(),
                billNo: savedSale.billData.billNo || "",
                series: savedSale.billData.billSeries || "",
                qtyUsed,
                date: new Date(),
              });
              addedUsedQty += qtyUsed;
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
          sale.status = deriveOrderStatus(sale.items || [], sale.status);
          await sale.save();
        }
      } catch (err) {
        console.warn(
          "Could not update selected items invoice flags:",
          err.message
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: "Lens sale added successfully",
      data: savedSale,
    });
  } catch (err) {
    console.error("Error adding lens sale:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to add lens sale",
      error: err.message,
    });
  }
};


const getAllLensSale = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const sales = await LensSale.find({
      $or: [
        { companyId },
        { companyId: null }
      ]
    }).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      data: sales,
    });
  } catch (err) {
    console.error("Error fetching lens sales:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch lens sales",
      error: err.message,
    });
  }
};

const getLensSale = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Sale ID is required" });
    }
    const sale = await LensSale.findOne({ _id: id, companyId: req.user?.companyId });
    if (!sale) {
      return res
        .status(404)
        .json({ success: false, message: "Lens sale not found" });
    }
    return res.status(200).json({ success: true, data: sale });
  } catch (err) {
    console.error("Error fetching lens sale:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

const editLensSale = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "Sale ID is required" });
    }

    const existing = await LensSale.findOne({ _id: id, companyId: req.user?.companyId });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Sale not found" });
    }

    // sanitize/parse incoming items & taxes
    const newItemsRaw = (data.items || []).map((item) => ({
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
      combinationId: item.combinationId || item.CombinationId || "", // tolerate different key
      orderNo: item.orderNo || "",
      remark: item.remark || "",
    }));

    const taxes = (data.taxes || []).map((tax) => ({
      taxName: tax.taxName || "",
      type: tax.type || "Additive",
      percentage: Number(tax.percentage) || 0,
      amount: Number(tax.amount) || 0,
      meta: tax.meta || {},
    }));

    // compute totals defensively
    const subtotal = newItemsRaw.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);
    const taxesAmount = taxes.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const netAmount = subtotal + taxesAmount;
    const paidAmount = Number(data.paidAmount) || 0;
    const dueAmount = netAmount - paidAmount;
    const grossAmount = newItemsRaw.reduce(
      (s, i) => s + (Number(i.qty) || 0) * (Number(i.salePrice) || 0),
      0
    );

    // ── Stock Adjustment for Edit ───────────────────────────────────────────
    if (!existing.sourceSaleId && !existing.sourceChallanId) {
       // Only adjust if this is a direct sale
       const stockResult = await adjustStockForEdit(existing.items, newItemsRaw, req.user?.companyId);
       if (!stockResult.valid) {
          return res.status(400).json({
             success: false,
             message: "Insufficient stock for update",
             stockErrors: stockResult.errors
          });
       }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // -------------------------
    // All stock updates successful. Now update the LensSale document.
    // -------------------------
    existing.billData = data.billData || existing.billData || {};
    existing.partyData = data.partyData || existing.partyData || {};
    existing.items = newItemsRaw;
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

    return res.status(200).json({
      success: true,
      message: "Lens sale updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Error updating lens sale:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update lens sale",
      error: err.message,
    });
  }
};

const removeLensSale = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Sale ID is required" });
    }

    // fetch sale first (we need its items)
    const existing = await LensSale.findOne({ _id: id, companyId: req.user?.companyId });

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Lens sale not found" });
    }

    if (!existing.sourceSaleId && !existing.sourceChallanId) {
       // Only restore for direct sales
       await restoreStock(existing.items, req.user?.companyId);
    }

    await logDeletion({
      type: "transaction",
      name: `Lens Sale - ${existing.billData?.billNo || 'N/A'}`,
      originalData: existing
    });

    // finally delete the sale
    await LensSale.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Lens sale deleted & stock restored successfully",
      data: existing,
    });
  } catch (err) {
    console.error("Error deleting lens sale:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete lens sale",
      error: err.message,
    });
  }
};

const updateSaleInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

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

    const updatedSale = await LensSale.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedSale) {
      return res.status(404).json({
        success: false,
        message: "Sale Invoice not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: updatedSale,
    });
  } catch (err) {
    console.error("Error updating sale invoice status:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update status",
      error: err.message,
    });
  }
};

const updateItemStatus = async (req, res) => {
  try {
    const { id: invoiceId } = req.params;
    const { itemIds, newStatus } = req.body;

    const invoice = await LensSale.findById(invoiceId);
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    const idSet = new Set(itemIds.map(id => String(id)));
    invoice.items = invoice.items.map(item => {
      if (idSet.has(String(item._id))) {
        item.itemStatus = newStatus;
      }
      return item;
    });

    invoice.status = deriveOrderStatus(invoice.items, invoice.status);
    await invoice.save();

    // Sync with Sale Order if exists
    if (invoice.sourceSaleId) {
      const order = await LensSaleOrder.findById(invoice.sourceSaleId);
      if (order) {
        order.items = order.items.map(oItem => {
          if (idSet.has(String(oItem._id))) {
            oItem.itemStatus = newStatus;
          }
          return oItem;
        });
        order.status = deriveOrderStatus(order.items, order.status);
        await order.save();

        // Sync with Challans
        const challans = await LensSaleChallan.find({ sourceSaleId: invoice.sourceSaleId });
        for (const ch of challans) {
          ch.items = ch.items.map(chi => {
            if (idSet.has(String(chi._id))) chi.itemStatus = newStatus;
            return chi;
          });
          ch.status = deriveOrderStatus(ch.items, ch.status);
          await ch.save();
        }

        // Sync with other Invoices
        const otherInvoices = await LensSale.find({ sourceSaleId: invoice.sourceSaleId, _id: { $ne: invoiceId } });
        for (const inv of otherInvoices) {
          inv.items = inv.items.map(ivi => {
            if (idSet.has(String(ivi._id))) ivi.itemStatus = newStatus;
            return ivi;
          });
          inv.status = deriveOrderStatus(inv.items, inv.status);
          await inv.save();
        }
      }
    }

    return res.status(200).json({ success: true, data: invoice });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const updateItemRemark = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const { itemId, remark } = req.body;

    const order = await LensSale.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
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
    console.error("Error in updateItemRemark (LensSale):", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

const updateDeliveryPerson = async (req, res) => {
  try {
    const { id } = req.params;
    const { deliveryPerson } = req.body;

    const updatedSale = await LensSale.findByIdAndUpdate(
      id,
      { deliveryPerson },
      { new: true }
    );

    if (!updatedSale) {
      return res.status(404).json({
        success: false,
        message: "Sale Invoice not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: updatedSale,
    });
  } catch (err) {
    console.error("Error updating delivery person (LensSale):", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update delivery person",
      error: err.message,
    });
  }
};

export {
  addLensSale,
  getLensSale,
  getAllLensSale,
  removeLensSale,
  editLensSale,
  updateSaleInvoiceStatus,
  updateItemStatus,
  updateItemRemark,
  updateDeliveryPerson,
};
