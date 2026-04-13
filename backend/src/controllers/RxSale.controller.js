import RxSale from "../models/RxSale.js";
import Account from "../models/Account.js";
import mongoose from "mongoose";

const parseNumber = (v, fallback = 0) => {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const getAllVendors = async (req, res) => {
  try {
    const { companyId } = req.user;
    const vendors = await Account.find({
      companyId,
      AccountType: { $in: ["Purchase", "Both"] }
    }).sort({ Name: 1 });

    const mappedVendors = vendors.map(v => ({
      _id: v._id,
      name: v.Name,
      email: v.Email,
      phone: v.MobileNumber || v.TelNumber,
      gstNo: v.GSTIN,
      address: v.Address,
      remark: v.Remark,
      tags: v.Tags
    }));

    return res.status(200).json({
      data: mappedVendors,
      success: true,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch Vendors (from Accounts)",
      error: err.message,
    });
  }
};
const addRxSale = async (req, res) => {
  try {
    const payload = req.body ?? {};

    const billData = {
      billSeries: payload.billData?.billSeries ?? "",
      billNo: payload.billData?.billNo ?? "",
      date: payload.billData?.date
        ? new Date(payload.billData.date)
        : new Date(),
      billType: payload.billData?.billType ?? "",
      godown: payload.billData?.godown ?? "",
      bookedBy: payload.billData?.bookedBy ?? "",
    };

    const partyData = {
      partyAccount: payload.partyData?.partyAccount ?? "",
      address: payload.partyData?.address ?? "",
      contactNumber: payload.partyData?.contactNumber ?? "",
      stateCode: payload.partyData?.stateCode ?? "",
      creditLimit: parseNumber(payload.partyData?.creditLimit, 0),
      CurrentBalance: {
        amount: parseNumber(payload.partyData?.CurrentBalance?.amount, 0),
        type: payload.partyData?.CurrentBalance?.type === "Cr" ? "Cr" : "Dr",
      },
    };

    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const items = rawItems.map((it) => {
      const qty = parseNumber(it.qty, 0);
      const salePrice = parseNumber(it.salePrice, 0);
      const discount = parseNumber(it.discount, 0);

      const computedTotal = qty * salePrice - discount;

      const remark = it.remark ?? it.reamrk ?? "";
      const vendorRaw = it.vendor ?? null;
      let vendor = null;
      if (vendorRaw) {
        try {
          vendor = mongoose.Types.ObjectId.isValid(vendorRaw)
            ? mongoose.Types.ObjectId(String(vendorRaw))
            : null;
        } catch {
          vendor = null;
        }
      }

      return {
        barcode: it.barcode ?? "",
        itemName: it.itemName ?? "",
        unit: it.unit ?? "",
        dia: it.dia ?? "",
        eye: it.eye ?? "",
        sph: parseNumber(it.sph, 0),
        cyl: parseNumber(it.cyl, 0),
        axis: parseNumber(it.axis, 0),
        add: parseNumber(it.add, 0),
        qty,
        salePrice,
        discount,
        totalAmount: parseNumber(it.totalAmount, computedTotal),
        sellPrice: salePrice,
        remark,
        vendor,
        refId: parseNumber(it.refId, 0),
        combinationId: it.combinationId ?? "",
      };
    });

    let subtotal = 0;
    let grossAmount = 0;

    for (const it of items) {
      subtotal += parseNumber(it.totalAmount, 0);
      grossAmount +=
        parseNumber(it.qty, 0) * parseNumber(it.salePrice, 0) -
        parseNumber(it.discount, 0);
    }

    const rawTaxes = Array.isArray(payload.taxes) ? payload.taxes : [];
    const taxes = rawTaxes.map((t) => ({
      taxName: t.taxName ?? "",
      type: t.type ?? "Additive",
      percentage: parseNumber(t.percentage, 0),
      amount: parseNumber(t.amount, 0),
      meta: t.meta ?? {},
    }));

    const taxesAmount = taxes.reduce((s, t) => s + parseNumber(t.amount, 0), 0);

    const netAmount = subtotal + taxesAmount;
    const paidAmount = parseNumber(payload.paidAmount, 0);
    const dueAmount = netAmount - paidAmount;

    const saved = await RxSale.create({
      billData,
      partyData,
      items,
      taxes,
      grossAmount,
      subtotal,
      taxesAmount,
      netAmount,
      paidAmount,
      dueAmount,
      remark: payload.remark ?? "",
      status: payload.status ?? "Pending",
    });

    return res.status(201).json({
      success: true,
      message: "Rx Sale created successfully",
      data: saved,
    });
  } catch (err) {
    console.error("addRxSale error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create Rx Sale",
      error: err.message,
    });
  }
};

/* ================= GET ONE ================= */
const getRxSale = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Valid RxSale ID required",
      });
    }

    const rxSale = await RxSale.findById(id);
    if (!rxSale) {
      return res.status(404).json({
        success: false,
        message: "Rx Sale not found",
      });
    }

    return res.status(200).json({ success: true, data: rxSale });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

const getAllRxSale = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const data = await RxSale.find({
      $or: [
        { companyId },
        { companyId: null }
      ]
    }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch Rx Sales",
      error: err.message,
    });
  }
};

const editRxSale = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid RxSale ID",
      });
    }
    const payload = req.body ?? {};
    const billData = {
      billSeries: payload.billData?.billSeries ?? "",
      billNo: payload.billData?.billNo ?? "",
      date: payload.billData?.date
        ? new Date(payload.billData.date)
        : new Date(),
      billType: payload.billData?.billType ?? "",
      godown: payload.billData?.godown ?? "",
      bookedBy: payload.billData?.bookedBy ?? "",
    };

    /* -------- PARTY DATA -------- */
    const partyData = {
      partyAccount: payload.partyData?.partyAccount ?? "",
      address: payload.partyData?.address ?? "",
      contactNumber: payload.partyData?.contactNumber ?? "",
      stateCode: payload.partyData?.stateCode ?? "",
      creditLimit: parseNumber(payload.partyData?.creditLimit, 0),
      CurrentBalance: {
        amount: parseNumber(payload.partyData?.CurrentBalance?.amount, 0),
        type: payload.partyData?.CurrentBalance?.type === "Cr" ? "Cr" : "Dr",
      },
    };

    /* -------- ITEMS -------- */
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const items = rawItems.map((it) => {
      const qty = parseNumber(it.qty, 0);
      const salePrice = parseNumber(it.salePrice, 0);
      const discount = parseNumber(it.discount, 0);

      const computedTotal = qty * salePrice - discount;

      const remark = it.remark ?? it.reamrk ?? "";
      const vendorRaw = it.vendor ?? null;
      let vendor = null;
      if (vendorRaw) {
        try {
          vendor = mongoose.Types.ObjectId.isValid(vendorRaw)
            ? mongoose.Types.ObjectId(String(vendorRaw))
            : null;
        } catch {
          vendor = null;
        }
      }

      return {
        barcode: it.barcode ?? "",
        itemName: it.itemName ?? "",
        unit: it.unit ?? "",
        dia: it.dia ?? "",
        eye: it.eye ?? "",
        sph: parseNumber(it.sph, 0),
        cyl: parseNumber(it.cyl, 0),
        axis: parseNumber(it.axis, 0),
        add: parseNumber(it.add, 0),
        qty,
        salePrice,
        discount,
        totalAmount: parseNumber(it.totalAmount, computedTotal),
        sellPrice: salePrice,
        remark,
        vendor,
        refId: parseNumber(it.refId, 0),
        combinationId: it.combinationId ?? "",
      };
    });

    /* -------- TOTALS -------- */
    let subtotal = 0;
    let grossAmount = 0;

    for (const it of items) {
      subtotal += parseNumber(it.totalAmount, 0);
      grossAmount +=
        parseNumber(it.qty, 0) * parseNumber(it.salePrice, 0) -
        parseNumber(it.discount, 0);
    }

    /* -------- TAXES -------- */
    const rawTaxes = Array.isArray(payload.taxes) ? payload.taxes : [];
    const taxes = rawTaxes.map((t) => ({
      taxName: t.taxName ?? "",
      type: t.type ?? "Additive",
      percentage: parseNumber(t.percentage, 0),
      amount: parseNumber(t.amount, 0),
      meta: t.meta ?? {},
    }));

    const taxesAmount = taxes.reduce((s, t) => s + parseNumber(t.amount, 0), 0);

    const netAmount = subtotal + taxesAmount;
    const paidAmount = parseNumber(payload.paidAmount, 0);
    const dueAmount = netAmount - paidAmount;

    /* -------- FINAL DOC -------- */
    const updatedDoc = {
      billData,
      partyData,
      items,
      taxes,
      grossAmount,
      subtotal,
      taxesAmount,
      netAmount,
      paidAmount,
      dueAmount,
      remark: payload.remark ?? "",
      status: payload.status ?? "Pending",
    };

    const updated = await RxSale.findByIdAndUpdate(id, updatedDoc, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Rx Sale not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Rx Sale updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("editRxSale error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update Rx Sale",
      error: err.message,
    });
  }
};
const removeRxSale = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid RxSale ID",
      });
    }

    await RxSale.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Rx Sale deleted successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete Rx Sale",
      error: err.message,
    });
  }
};

const updateRxSaleStatus = async (req, res) => {
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

    const updatedSale = await RxSale.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedSale) {
      return res.status(404).json({
        success: false,
        message: "Rx Sale not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: updatedSale,
    });
  } catch (err) {
    console.error("Error updating rx sale status:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update status",
      error: err.message,
    });
  }
};

const getNextBillNumberForRxSale = async (req, res) => {
  try {
    const { partyName } = req.body;
    if (!partyName) {
      return res.status(400).json({
        success: false,
        message: "Party name is required",
        nextBillNumber: 1
      });
    }

    const allSales = await RxSale.find({});
    const matchingSales = (allSales || []).filter(sale =>
      sale.partyData?.partyAccount?.toLowerCase() === partyName.toLowerCase()
    );

    const nextBillNumber = matchingSales.length + 1;

    return res.status(200).json({
      success: true,
      nextBillNumber,
      count: matchingSales.length
    });
  } catch (err) {
    console.error("Error fetching next bill number for Rx Sale:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch next bill number",
      nextBillNumber: 1
    });
  }
};

const updateItemRemark = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const { itemId, remark } = req.body;

    const order = await RxSale.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Rx Sale not found" });
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
    console.error("Error in updateItemRemark (RxSale):", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

const updateDeliveryPerson = async (req, res) => {
  try {
    const { id } = req.params;
    const { deliveryPerson } = req.body;

    const updatedSale = await RxSale.findByIdAndUpdate(
      id,
      { deliveryPerson },
      { new: true }
    );

    if (!updatedSale) {
      return res.status(404).json({
        success: false,
        message: "Rx Sale not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: updatedSale,
    });
  } catch (err) {
    console.error("Error updating delivery person (RxSale):", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update delivery person",
      error: err.message,
    });
  }
};

export { 
  getAllVendors, 
  addRxSale, 
  getRxSale, 
  getAllRxSale, 
  editRxSale, 
  removeRxSale, 
  updateRxSaleStatus, 
  getNextBillNumberForRxSale, 
  updateItemRemark,
  updateDeliveryPerson 
};
