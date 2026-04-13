import RxSaleReturn from "../models/RxSaleReturn.js"
const addRxSaleReturn = async (req, res) => {
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
      salePrice: Number(item.salePrice) || 0,
      discount: Number(item.discount) || 0,
      totalAmount: Number(item.totalAmount) || 0,
      remark: item.remark || "",
    }));

    const taxes = (data.taxes || []).map((tax) => ({
      taxName: tax.taxName || "",
      type: tax.type || "Additive",
      percentage: Number(tax.percentage) || 0,
      amount: Number(tax.amount) || 0,
    }));

    const grossAmount = items.reduce(
      (g, it) => g + (it.qty * it.salePrice),
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

    const saleReturn = new RxSaleReturn({
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
      returnType: "RX",
      companyId: req.user?.companyId || null,
    });

    const saved = await saleReturn.save();

    return res.status(201).json({
      success: true,
      message: "RX Sale Return added successfully",
      data: saved,
    });
  } catch (err) {
    console.error("FULL ERROR IN addRxSaleReturn:", err);
    if (err.stack) console.error("STACK TRACE:", err.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to add RX Sale Return",
      error: err.message,
      stack: err.stack
    });
  }
};

const getAllRxSaleReturn = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const list = await RxSaleReturn.find({ companyId }).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      data: list,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch RX Sale Returns",
      error: err.message,
    });
  }
};

const getRxSaleReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;

    const saleReturn = await RxSaleReturn.findOne({ _id: id, companyId });
    if (!saleReturn) {
      return res.status(404).json({
        success: false,
        message: "RX Sale Return not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: saleReturn,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch RX Sale Return",
      error: err.message,
    });
  }
};

const editRxSaleReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const companyId = req.user?.companyId;

    const existing = await RxSaleReturn.findOne({ _id: id, companyId });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "RX Sale Return not found",
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

    const updated = await existing.save();

    return res.status(200).json({
      success: true,
      message: "RX Sale Return updated successfully",
      data: updated,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to edit RX Sale Return",
      error: err.message,
    });
  }
};

const removeRxSaleReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;

    const deleted = await RxSaleReturn.findOneAndDelete({ _id: id, companyId });
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "RX Sale Return not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "RX Sale Return deleted successfully",
      data: deleted,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete RX Sale Return",
      error: err.message,
    });
  }
};

const getNextBillNumber = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    // Filter by companyId
    const allReturns = await RxSaleReturn.find({ companyId })
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
    console.error("Error fetching next bill number for RX Sale Return:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch next bill number",
      nextBillNumber: 1
    });
  }
};

export {
  getAllRxSaleReturn,
  editRxSaleReturn,
  addRxSaleReturn,
  removeRxSaleReturn,
  getRxSaleReturn,
  getNextBillNumber
}