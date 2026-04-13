import RxPurchaseReturn from "../models/RxPurchaseReturn.js";

const addRxPurchaseReturn = async (req, res) => {
  try {
    const data = req.body;

    const items = (data.items || []).map((item) => ({
      barcode: item.barcode || "",
      itemName: item.itemName || "",
      unit: item.unit || "",
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
    }));

    const grossAmount = items.reduce(
      (g, it) => g + it.qty * it.purchasePrice,
      0
    );

    const subtotal = items.reduce(
      (s, it) => s + it.totalAmount,
      0
    );

    const taxesAmount = taxes.reduce(
      (t, tax) => t + tax.amount,
      0
    );

    const netAmount = subtotal + taxesAmount;
    const paidAmount = Number(data.paidAmount) || 0;
    const dueAmount = netAmount - paidAmount;

    const purchaseReturn = new RxPurchaseReturn({
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
      status: data.status || "Pending",
      returnType: "RX", // future safe
      dcId: data.dcId || "",
      companyId: req.user?.companyId
    });

    const saved = await purchaseReturn.save();

    return res.status(201).json({
      success: true,
      message: "RX Purchase Return added successfully",
      data: saved,
    });
  } catch (err) {
    console.error("RX Purchase Return error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to add RX Purchase Return",
      error: err.message,
    });
  }
};

const getAllRxPurchaseReturn = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const list = await RxPurchaseReturn.find({ companyId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: list,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch RX Purchase Returns",
      error: err.message,
    });
  }
};

const getRxPurchaseReturn = async (req, res) => {
  try {
    const { id } = req.body;
    const companyId = req.user?.companyId;
    const purchaseReturn = await RxPurchaseReturn.findOne({ _id: id, companyId });
    if (!purchaseReturn) {
      return res.status(404).json({
        success: false,
        message: "RX Purchase Return not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: purchaseReturn,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch RX Purchase Return",
      error: err.message,
    });
  }
};

const editRxPurchaseReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const companyId = req.user?.companyId;

    const existing = await RxPurchaseReturn.findOne({ _id: id, companyId });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "RX Purchase Return not found",
      });
    }

    existing.billData = data.billData || existing.billData;
    existing.partyData = data.partyData || existing.partyData;
    existing.items = data.items || existing.items;
    existing.taxes = data.taxes || existing.taxes;
    existing.grossAmount = data.grossAmount || existing.grossAmount;
    existing.subtotal = data.subtotal || existing.subtotal;
    existing.taxesAmount = data.taxesAmount || existing.taxesAmount;
    existing.netAmount = data.netAmount || existing.netAmount;
    existing.paidAmount = data.paidAmount || existing.paidAmount;
    existing.dueAmount = data.dueAmount || existing.dueAmount;
    existing.remark = data.remark || existing.remark;
    existing.status = data.status || existing.status;
    existing.dcId = data.dcId || existing.dcId || "";

    const updated = await existing.save();

    return res.status(200).json({
      success: true,
      message: "RX Purchase Return updated successfully",
      data: updated,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to edit RX Purchase Return",
      error: err.message,
    });
  }
};

const removeRxPurchaseReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;

    const deleted = await RxPurchaseReturn.findOneAndDelete({ _id: id, companyId });
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "RX Purchase Return not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "RX Purchase Return deleted successfully",
      data: deleted,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete RX Purchase Return",
      error: err.message,
    });
  }
};

const getNextBillNumber = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    // Filter by companyId
    const allReturns = await RxPurchaseReturn.find({ companyId })
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
    });
  } catch (err) {
    console.error("Error fetching next bill number for RX Purchase Return:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch next bill number",
      nextBillNumber: 1
    });
  }
};

const updateRxPurchaseReturnFields = async (req, res) => {
  try {
    const { id } = req.params;
    const { dcId } = req.body;
    const companyId = req.user?.companyId;

    const existing = await RxPurchaseReturn.findOne({ _id: id, companyId });
    if (!existing) return res.status(404).json({ success: false, message: "Not found" });

    if (dcId !== undefined) existing.dcId = dcId;

    await existing.save();
    return res.status(200).json({ success: true, message: "Fields updated", data: existing });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export {
  addRxPurchaseReturn,
  getAllRxPurchaseReturn,
  getRxPurchaseReturn,
  editRxPurchaseReturn,
  removeRxPurchaseReturn,
  getNextBillNumber,
  updateRxPurchaseReturnFields,
};
