import RxPurchase from "../models/RxPurchase.js";
import LensGroup from "../models/LensGroup.js";
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
    
    // Map to vendor-like structure if needed, but usually frontend just needs the list
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
const addRxPurchase = async (req, res) => {
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

      const qty = parseNumber(it.qty, 0);
      const purchasePrice = parseNumber(it.purchasePrice, 0);
      const salePrice = parseNumber(it.salePrice, 0);
      const discount = parseNumber(it.discount, 0);
      const clientTotal = it.totalAmount;
      const computedTotal = qty * purchasePrice - discount;
      const totalAmount =
        typeof clientTotal !== "undefined" &&
          clientTotal !== null &&
          clientTotal !== ""
          ? parseNumber(clientTotal, computedTotal)
          : computedTotal;

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
        purchasePrice,
        salePrice,
        discount,
        totalAmount,
        sellPrice: parseNumber(it.sellPrice, 0),
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
        parseNumber(it.qty, 0) * parseNumber(it.purchasePrice, 0) -
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
    const doc = {
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

    const saved = await RxPurchase.create(doc);

    return res.status(201).json({
      success: true,
      message: "RxPurchase created",
      data: saved,
    });
  } catch (err) {
    console.error("addRxPurchase error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create RxPurchase",
      error: err?.message ?? String(err),
    });
  }
};

const getRxPurchase = async (req, res) => {
  try {
    const { id } = req.body;
    console.log(id);
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Rx Purchase ID is required" });
    }
    const rxpurchase = await RxPurchase.findById(id);
    if (!rxpurchase) {
      return res
        .status(404)
        .json({ success: false, message: "Lens purchase not found" });
    }

    return res.status(200).json({ success: true, data: rxpurchase });
  } catch (err) {
    console.error("Error fetching lens purchase:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};
const getAllRxPurchase = async (req, res) => {
  try {
    const rxpurchases = await RxPurchase.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: rxpurchases,
    });
  } catch (err) {
    console.error("Error fetching Rx purchases:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch Rx purchases",
      error: err.message,
    });
  }
};
const editRxPurchase = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid RxPurchase ID",
      });
    }

    const payload = req.body ?? {};

    // -- sanitize billData
    const billData = {
      billSeries: payload.billData?.billSeries ?? "",
      billNo: payload.billData?.billNo ?? "",
      date: payload.billData?.date ? new Date(payload.billData.date) : new Date(),
      billType: payload.billData?.billType ?? "",
      godown: payload.billData?.godown ?? "",
      bookedBy: payload.billData?.bookedBy ?? "",
    };

    // -- sanitize partyData
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

    // -- sanitize items
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const items = rawItems.map((it) => {
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

      const qty = parseNumber(it.qty, 0);
      const purchasePrice = parseNumber(it.purchasePrice, 0);
      const discount = parseNumber(it.discount, 0);

      const clientTotal = it.totalAmount;
      const computedTotal = qty * purchasePrice - discount;
      const totalAmount =
        clientTotal !== undefined && clientTotal !== null && clientTotal !== ""
          ? parseNumber(clientTotal, computedTotal)
          : computedTotal;

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
        purchasePrice,
        salePrice: parseNumber(it.salePrice, 0),
        discount,
        totalAmount,
        sellPrice: parseNumber(it.sellPrice, 0),
        remark,
        vendor,
        refId: parseNumber(it.refId, 0),
        combinationId: it.combinationId ?? "",
      };
    });

    // compute totals
    let subtotal = 0;
    let grossAmount = 0;
    for (const it of items) {
      subtotal += parseNumber(it.totalAmount, 0);
      grossAmount +=
        parseNumber(it.qty, 0) * parseNumber(it.purchasePrice, 0) -
        parseNumber(it.discount, 0);
    }

    // sanitize taxes
    const rawTaxes = Array.isArray(payload.taxes) ? payload.taxes : [];
    const taxes = rawTaxes.map((t) => ({
      taxName: t.taxName ?? "",
      type: t.type ?? "Additive",
      percentage: parseNumber(t.percentage, 0),
      amount: parseNumber(t.amount, 0),
      meta: t.meta ?? {},
    }));

    const taxesAmount = taxes.reduce(
      (sum, t) => sum + parseNumber(t.amount, 0),
      0
    );

    const netAmount = subtotal + taxesAmount;
    const paidAmount = parseNumber(payload.paidAmount, 0);
    const dueAmount = netAmount - paidAmount;

    // final updated object
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

    const updated = await RxPurchase.findByIdAndUpdate(id, updatedDoc, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "RxPurchase not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "RxPurchase updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("editRxPurchase error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to update RxPurchase",
      error: err?.message ?? String(err),
    });
  }
};

const removeRxPurchase = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "RxPurchase ID is required" });
    }
    const rxpurchase = await RxPurchase.findById(id)
    if (!rxpurchase) {
      return res
        .status(404)
        .json({ success: false, message: "RxPurchase not found" });
    }
    await RxPurchase.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "RxPurchase deleted successfully",
    });
  } catch (err) {
    console.error("removeRxPurchase error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to delete RxPurchase",
      error: err.message,
    });
  }
};
const getNextBillNumberForRxPurchase = async (req, res) => {
  try {
    const { partyName } = req.body;
    if (!partyName) {
      return res.status(400).json({
        success: false,
        message: "Party name is required",
        nextBillNumber: 1
      });
    }

    const allPurchases = await RxPurchase.find({});
    const matchingPurchases = (allPurchases || []).filter(purchase =>
      purchase.partyData?.partyAccount?.toLowerCase() === partyName.toLowerCase()
    );

    const nextBillNumber = matchingPurchases.length + 1;

    return res.status(200).json({
      success: true,
      nextBillNumber,
      count: matchingPurchases.length
    });
  } catch (err) {
    console.error("Error fetching next bill number for Rx Purchase:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch next bill number",
      nextBillNumber: 1
    });
  }
};

const patchRxPurchaseDcId = async (req, res) => {
  try {
    const { id } = req.params;
    const { dcId } = req.body;
    if (!id) return res.status(400).json({ success: false, message: "ID required" });
    const updated = await RxPurchase.findByIdAndUpdate(id, { dcId }, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: "RxPurchase not found" });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export {
  getAllVendors,
  addRxPurchase,
  getRxPurchase,
  getAllRxPurchase,
  removeRxPurchase,
  editRxPurchase,
  getNextBillNumberForRxPurchase,
  patchRxPurchaseDcId
};
