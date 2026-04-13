import ContactLensSaleOrder from "../models/ContactLensSaleOrder.js";
import SaleChallan from "../models/LensSaleChallan.js";
import mongoose from "mongoose";
import { deriveOrderStatus } from "../utils/statusManager.js";
import { validateAccountLimitsHelper } from "../utils/accountValidator.js";

const addContactLensSaleOrder = async (req, res) => {
    try {
        const data = req.body;
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
            importDate: item.importDate || null,
            expiryDate: item.expiryDate || null,
            mrp: Number(item.mrp) || 0,
            salePrice: Number(item.salePrice) || 0,
            discount: Number(item.discount) || 0,
            totalAmount: Number(item.totalAmount) || 0,
            isInvoiced: item.isInvoiced || false,
            isChallaned: item.isChallaned || false,
            combinationId: item.combinationId || "",
            orderNo: item.orderNo || "",
            remark: item.remark || "",
            vendor: item.vendor || "",
            itemStatus: item.itemStatus || "Pending",
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
                message: "At least one sale order item is required",
            });
        }

        const subtotal = items.reduce((sum, it) => sum + (Number(it.totalAmount) || 0), 0);
        const taxesAmount = taxes.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const netAmount = subtotal + taxesAmount;
        const paidAmount = Number(data.paidAmount) || 0;
        const dueAmount = netAmount - paidAmount;
        const grossAmount = items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.salePrice) || 0), 0);

        const newOrder = new ContactLensSaleOrder({
            companyId: req.user?.companyId,
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
            deliveryDate: data.deliveryDate || Date.now(),
            remark: data.remark || "",
            status: data.status || "Pending",
        });

        const savedOrder = await newOrder.save();

        return res.status(201).json({
            success: true,
            message: "Sale Order added successfully",
            data: savedOrder,
        });
    } catch (err) {
        console.error("Error adding contact lens sale order:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to add sale order",
            error: err.message,
        });
    }
};

const getContactLensSaleOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const saleOrder = await ContactLensSaleOrder.findById(id);
        if (!saleOrder) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        return res.status(200).json({ success: true, data: saleOrder });
    } catch (err) {
        console.error("Error fetching contact lens sale:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

const editContactLensSaleOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;

        const existing = await ContactLensSaleOrder.findById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

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
            importDate: item.importDate || null,
            expiryDate: item.expiryDate || null,
            mrp: Number(item.mrp) || 0,
            salePrice: Number(item.salePrice) || 0,
            discount: Number(item.discount) || 0,
            totalAmount: Number(item.totalAmount) || 0,
            isInvoiced: item.isInvoiced || false,
            isChallaned: item.isChallaned || false,
            combinationId: item.combinationId || "",
            orderNo: item.orderNo || "",
            remark: item.remark || "",
            vendor: item.vendor || "",
            itemStatus: item.itemStatus || "Pending",
        }));

        const subtotal = items.reduce((sum, it) => sum + (Number(it.totalAmount) || 0), 0);
        const taxes = (data.taxes || []).map((tax) => ({
            taxName: tax.taxName || "",
            type: tax.type || "Additive",
            percentage: Number(tax.percentage) || 0,
            amount: Number(tax.amount) || 0,
            meta: tax.meta || {},
        }));
        const taxesAmount = taxes.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const netAmount = subtotal + taxesAmount;
        const grossAmount = items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.salePrice) || 0), 0);

        existing.billData = data.billData || existing.billData;
        existing.partyData = data.partyData || existing.partyData;
        existing.items = items;
        existing.taxes = taxes;
        existing.grossAmount = grossAmount;
        existing.subtotal = subtotal;
        existing.taxesAmount = taxesAmount;
        existing.netAmount = netAmount;
        existing.paidAmount = Number(data.paidAmount) || 0;
        existing.dueAmount = netAmount - (Number(data.paidAmount) || 0);
        existing.remark = data.remark || existing.remark;
        existing.status = data.status || existing.status;

        const updated = await existing.save();

        return res.status(200).json({
            success: true,
            message: "Sale order updated successfully",
            data: updated,
        });
    } catch (err) {
        console.error("Error updating contact lens sale order:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update sale order",
            error: err.message,
        });
    }
};

const getNextBillNo = async (req, res) => {
    try {
        const { partyAccount } = req.params;
        const lastOrder = await ContactLensSaleOrder.findOne({ "partyData.partyAccount": partyAccount }).sort({ createdAt: -1 });
        let nextBillNo = 1;

        if (lastOrder && lastOrder.billData && lastOrder.billData.billNo) {
            const lastNo = parseInt(lastOrder.billData.billNo);
            if (!isNaN(lastNo)) {
                nextBillNo = lastNo + 1;
            }
        }

        return res.status(200).json({ success: true, nextBillNo });
    } catch (err) {
        console.error("Error fetching next bill no:", err);
        return res.status(500).json({ success: false, message: "Error fetching next bill no", error: err.message });
    }
};

const getAllContactLensSaleOrder = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const saleOrders = await ContactLensSaleOrder.find({
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
        console.error("Error fetching contact lens sale Orders:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch contact lens sales",
            error: err.message,
        });
    }
};

const removeContactLensSaleOrder = async (req, res) => {
    try {
        const { id } = req.params;

        const existing = await ContactLensSaleOrder.findById(id);
        if (!existing) {
            return res.status(404).json({ message: "Order not found" });
        }

        await ContactLensSaleOrder.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: "Contact Lens Sale Order deleted successfully",
        });
    } catch (error) {
        console.error("Delete Order Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const updateContactLensSaleOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

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

        const updatedOrder = await ContactLensSaleOrder.findByIdAndUpdate(
            id,
            { status },
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

const updateContactLensSaleOrderBookedBy = async (req, res) => {
    try {
        const { id } = req.params;
        const { bookedBy } = req.body;

        const updatedOrder = await ContactLensSaleOrder.findByIdAndUpdate(
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

const updateContactLensSaleOrderVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { vendor } = req.body;

        const order = await ContactLensSaleOrder.findById(id);
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

const createContactLensChallan = async (req, res) => {
    try {
        const data = req.body || {};
        const selectedItemIds = data.selectedItemIds || [];

        const items = (data.items || [])
            .filter((item) => selectedItemIds.includes(String(item._id)))
            .map((item) => ({
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
                combinationId: item.combinationId || "",
                orderNo: item.orderNo || "",
                remark: item.remark || "",
                vendor: item.vendor || "",
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

        if (!items.length) {
            return res.status(400).json({
                success: false,
                message: "At least one challan item is required",
            });
        }

        const subtotal = items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0);
        const taxesAmount = taxes.reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const netAmount = subtotal + taxesAmount;
        const paidAmount = Number(data.paidAmount) || 0;
        const dueAmount = netAmount - paidAmount;
        const grossAmount = items.reduce(
            (s, it) => s + (Number(it.qty) || 0) * (Number(it.salePrice) || 0),
            0
        );
        const totalQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);

        // --- Stock Validation & Deduction ---
        const LensGroup = (await import("../models/LensGroup.js")).default;
        for (const it of items) {
            if (it.combinationId && Number(it.qty) > 0) {
                try {
                    const combId = new mongoose.Types.ObjectId(it.combinationId);
                    const parent = await LensGroup.findOne(
                        { "addGroups.combinations._id": combId }
                    );
                    if (!parent) {
                        console.warn("⚠️ Combination Not Found:", it.combinationId, "- Skipping stock deduction");
                        continue;
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
                        console.warn("⚠️ Combination ID found but not resolved:", it.combinationId, "- Skipping stock deduction");
                        continue;
                    }
                    const oldStock = Number(matched.initStock || 0);
                    const qty = Number(it.qty || 0);
                    if (oldStock < qty) {
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
                } catch (err) {
                    console.error("❌ Error reducing stock for", it.itemName, ":", err.message);
                    continue;
                }
            }
        }

        const challanData = {
            billData: {
                billSeries: data.billData?.billSeries || "",
                billNo: data.billData?.billNo || "",
                billType: data.billData?.billType || "",
                godown: data.billData?.godown || "",
                bookedBy: data.billData?.bookedBy || "",
                date: data.billData?.date || new Date(),
            },
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
            status: "In Progress",
            sourceSaleId: data.sourceSaleId || null,
            orderType: "CONTACT",
        };

        const newChallan = new SaleChallan(challanData);
        const savedChallan = await newChallan.save();

        if (data.sourceSaleId && items.length) {
            const saleOrder = await ContactLensSaleOrder.findById(data.sourceSaleId);
            if (saleOrder) {
                saleOrder.items = saleOrder.items.map(sItem => {
                    const challanItem = items.find(cItem => String(cItem._id) === String(sItem._id));
                    if (challanItem && selectedItemIds.includes(String(sItem._id))) {
                        sItem.isChallaned = true;
                        sItem.itemStatus = "In Progress";
                    }
                    return sItem;
                });

                if (!saleOrder.usedIn) saleOrder.usedIn = [];
                if (!saleOrder.usedIn.some(u => u.type === 'SC' && u.number === savedChallan.billData.billNo)) {
                    saleOrder.usedIn.push({ type: 'SC', number: savedChallan.billData.billNo });
                }

                saleOrder.status = deriveOrderStatus(saleOrder.items, saleOrder.status);
                await saleOrder.save();
            }
        }

        return res.status(201).json({
            success: true,
            message: "Contact Lens Challan created successfully",
            data: savedChallan,
        });
    } catch (err) {
        console.error("Error creating contact lens challan:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to create contact lens challan",
            error: err.message,
        });
    }
};

const updateContactLensItemStatus = async (req, res) => {
    try {
        const { id: orderId } = req.params;
        const { itemIds, newStatus } = req.body;

        const order = await ContactLensSaleOrder.findById(orderId);
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

        return res.status(200).json({
            success: true,
            message: "Item status(es) updated",
            data: order
        });
    } catch (err) {
        console.error("Error in updateContactLensItemStatus:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
};

const updateOrderPlacementStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isOrderPlaced } = req.body;

        const order = await ContactLensSaleOrder.findById(id);
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

        const order = await ContactLensSaleOrder.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Contact Lens Order not found" });
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
            message: "Contact Lens Item Order No updated",
            data: order
        });
    } catch (err) {
        console.error("Error in updateItemOrderNo (Contact Lens):", err);
        return res.status(500).json({ success: false, error: err.message });
    }
};

const updateContactLensSaleOrderRefNo = async (req, res) => {
    try {
        const { id } = req.params;
        const { refNo } = req.body;
        const order = await ContactLensSaleOrder.findById(id);
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

        const order = await ContactLensSaleOrder.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Contact Lens Order not found" });
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
        console.error("Error in updateItemRemark (ContactLens):", err);
        return res.status(500).json({ success: false, error: err.message });
    }
};

/**
 * Validate Account Credit Limit and Day Limit
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
    console.error("Error validating account limits (Contact Lens):", err);
    return res.status(500).json({
      success: false,
      message: "Error validating account limits",
      error: err.message
    });
  }
};

export {
    getAllContactLensSaleOrder,
    removeContactLensSaleOrder,
    updateContactLensSaleOrderStatus,
    updateContactLensSaleOrderBookedBy,
    addContactLensSaleOrder,
    getContactLensSaleOrder,
    editContactLensSaleOrder,
    getNextBillNo,
    updateContactLensSaleOrderVendor,
    createContactLensChallan,
    updateContactLensItemStatus,
    updateOrderPlacementStatus,
    updateItemOrderNo,
    updateContactLensSaleOrderRefNo,
    updateItemRemark,
    validateAccountLimits,
};
