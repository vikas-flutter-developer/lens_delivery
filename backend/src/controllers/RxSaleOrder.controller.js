import RxSaleOrder from "../models/RxSaleOrder.js";
import RxSale from "../models/RxSale.js";
import LensSale from "../models/LensSale.js";
import SaleChallan from "../models/LensSaleChallan.js";
import Account from "../models/Account.js";
import mongoose from "mongoose";
import { deriveOrderStatus } from "../utils/statusManager.js";
import { validateAccountLimitsHelper } from "../utils/accountValidator.js";

const addRxSaleOrder = async (req, res) => {
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
                customer: item.customer || "",
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

        const newOrder = new RxSaleOrder({
            companyId: req.user?.companyId,
            billData: data.billData || {},
            partyData: data.partyData || {},
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
            deliveryDate: data.deliveryDate || Date.now(),
            remark: data.remark || "",
            status: data.status || "Pending",
        });

        const savedOrder = await newOrder.save();

        return res.status(201).json({
            success: true,
            message: "Rx Sale Order added successfully",
            data: savedOrder,
        });
    } catch (err) {
        console.error("Error adding Rx sale order:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to add Rx sale order",
            error: err.message,
        });
    }
};

const getAllRxSaleOrder = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const saleOrders = await RxSaleOrder.find({
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
        console.error("Error fetching Rx sale Orders:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch Rx sale orders",
            error: err.message,
        });
    }
};

const getRxSaleOrder = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res
                .status(400)
                .json({ success: false, message: "Sale ID is required" });
        }
        let saleOrder = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            saleOrder = await RxSaleOrder.findById(id);
        }

        if (!saleOrder) {
            saleOrder = await RxSaleOrder.findOne({
                "billData.billNo": id,
                $or: [{ companyId: req.user?.companyId }, { companyId: null }]
            });
        }

        if (!saleOrder) {
            return res
                .status(404)
                .json({ success: false, message: "Rx sale order not found" });
        }
        return res.status(200).json({ success: true, data: saleOrder });
    } catch (err) {
        console.error("Error fetching Rx sale order:", err);
        return res
            .status(500)
            .json({ success: false, message: "Server error", error: err.message });
    }
};

const editRxSaleOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;

        if (!id) {
            return res
                .status(400)
                .json({ success: false, message: "Order ID is required" });
        }

        let existing = null;

        // Try to find by ID if it's a valid ObjectId
        if (mongoose.Types.ObjectId.isValid(id)) {
            existing = await RxSaleOrder.findById(id);
            if (!existing) {
                // If not found as Order ID, check if it's an Item ID within any order
                existing = await RxSaleOrder.findOne({ "items._id": id });
            }
        }

        // If still not found, try finding by billNo
        if (!existing) {
            existing = await RxSaleOrder.findOne({
                "billData.billNo": id,
                $or: [
                    { companyId: req.user?.companyId },
                    { companyId: null }
                ]
            });
        }

        if (!existing) {
            console.log(`Order not found for ID/BillNo: ${id}`);
            return res
                .status(404)
                .json({ success: false, message: "Order not found" });
        }

        // Security check: ensure order belongs to same company
        if (existing.companyId && req.user?.companyId && String(existing.companyId) !== String(req.user.companyId)) {
            return res.status(403).json({ success: false, message: "Unauthorized to edit this order" });
        }

        // If customerId is provided, fetch and update partyData
        if (data.customerId && mongoose.Types.ObjectId.isValid(data.customerId)) {
            const customer = await Account.findById(data.customerId);
            if (customer) {
                existing.partyData = {
                    partyAccount: customer.Name || "",
                    address: customer.Address || "",
                    contactNumber: customer.MobileNumber || "",
                    stateCode: customer.State || "",
                    creditLimit: customer.CreditLimit || 0,
                    CurrentBalance: customer.CurrentBalance || { amount: 0, type: "Dr" }
                };
            }
        }

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
            salePrice: Number(item.salePrice) || 0,
            discount: Number(item.discount) || 0,
            totalAmount: Number(item.totalAmount) || 0,
            sellPrice: Number(item.sellPrice) || 0,
            combinationId: item.combinationId || "",
            orderNo: item.orderNo || "",
            remark: item.remark || "",
            vendor: item.vendor || "",
            customer: item.customer || "",
            itemStatus: item.itemStatus || "Pending",
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

        existing.billData = data.billData || existing.billData || {};
        existing.partyData = data.partyData || existing.partyData || {};
        existing.items = incomingItems;
        existing.taxes = taxes;
        existing.grossAmount = grossAmount;
        existing.subtotal = subtotal;
        existing.taxesAmount = taxesAmount;
        existing.netAmount = netAmount;
        existing.orderQty = newOrderQty;
        existing.balQty = newBalQty;
        existing.remark = data.remark || existing.remark || "";
        existing.deliveryDate = data.deliveryDate || existing.deliveryDate;
        existing.status = data.status || existing.status || "Pending";

        const newPaidAmount = Number(data.paidAmount ?? existing.paidAmount ?? 0);
        existing.paidAmount = newPaidAmount;
        existing.dueAmount = netAmount - newPaidAmount;

        const updated = await existing.save();

        return res.status(200).json({
            success: true,
            message: "Rx sale order updated successfully",
            data: updated,
        });
    } catch (err) {
        console.error("Error updating Rx sale order:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update Rx sale order",
            error: err.message,
        });
    }
};

const removeRxSaleOrder = async (req, res) => {
    try {
        const { id } = req.params;
        let existing = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            existing = await RxSaleOrder.findById(id);
        }

        if (!existing) {
            existing = await RxSaleOrder.findOne({
                "billData.billNo": id,
                $or: [{ companyId: req.user?.companyId }, { companyId: null }]
            });
        }

        if (!existing) {
            return res.status(404).json({ message: "Order not found" });
        }
        await RxSaleOrder.findByIdAndDelete(existing._id);
        res.status(200).json({
            success: true,
            message: "Rx Sale Order deleted successfully",
        });
    } catch (error) {
        console.error("Delete Rx Order Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const createRxInvoiceFromOrder = async (req, res) => {
    try {
        const data = req.body || {};
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
        const grossAmount = items.reduce(
            (s, it) => s + (Number(it.qty) || 0) * (Number(it.salePrice) || 0),
            0
        );

        const totalQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
        const totalAmount = subtotal;

        // Use LensSale model instead of RxSale as per user requirement
        const newInvoice = new LensSale({
            billData: data.billData,
            partyData: data.partyData,
            items,
            taxes,
            grossAmount,
            subtotal,
            taxesAmount,
            netAmount,
            paidAmount: data.paidAmount || 0,
            dueAmount: netAmount - (data.paidAmount || 0),
            summary: { totalQty, totalAmount },
            remark: data.remark || "",
            status: data.status || "Pending",
        });

        const savedInvoice = await newInvoice.save();

        if (data.sourceSaleId) {
            let saleOrder = null;
            if (mongoose.Types.ObjectId.isValid(data.sourceSaleId)) {
                saleOrder = await RxSaleOrder.findById(data.sourceSaleId);
            }
            if (!saleOrder) {
                saleOrder = await RxSaleOrder.findOne({ "billData.billNo": data.sourceSaleId });
            }
            if (saleOrder) {
                let addedUsedQty = 0;
                saleOrder.items = saleOrder.items.map(sItem => {
                    const invItem = items.find(cItem => String(cItem._id) === String(sItem._id));
                    if (invItem && !sItem.isInvoiced) {
                        sItem.isInvoiced = true;
                        sItem.itemStatus = "Done";
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

                if (!saleOrder.usedIn) saleOrder.usedIn = [];
                if (!saleOrder.usedIn.some(u => u.type === 'SI' && u.number === savedInvoice.billData.billNo)) {
                    saleOrder.usedIn.push({ type: 'SI', number: savedInvoice.billData.billNo });
                }

                saleOrder.usedQty = (saleOrder.usedQty || 0) + addedUsedQty;
                saleOrder.balQty = Math.max(0, (saleOrder.orderQty || 0) - (saleOrder.usedQty || 0));

                saleOrder.status = deriveOrderStatus(saleOrder.items, saleOrder.status);

                await saleOrder.save();
            }
        }

        return res.status(201).json({
            success: true,
            message: "Rx Invoice created successfully",
            data: savedInvoice,
        });
    } catch (err) {
        console.error("Error creating Rx invoice:", err);
        return res.status(500).json({ success: false, message: "Failed to create invoice", error: err.message });
    }
};

const getNextBillNumberForRxSaleOrder = async (req, res) => {
    try {
        const { partyName } = req.body;
        if (!partyName) {
            return res.status(400).json({
                success: false,
                message: "Party name is required",
                nextBillNumber: 1
            });
        }

        const allOrders = await RxSaleOrder.find({});
        const matchingOrders = (allOrders || []).filter(order =>
            order.partyData?.partyAccount?.toLowerCase() === partyName.toLowerCase()
        );

        const nextBillNumber = matchingOrders.length + 1;

        return res.status(200).json({
            success: true,
            nextBillNumber,
            count: matchingOrders.length
        });
    } catch (err) {
        console.error("Error fetching next bill number for Rx Sale Order:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch next bill number",
            nextBillNumber: 1
        });
    }
};

const updateRxSaleOrderStatus = async (req, res) => {
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

        let existing = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            existing = await RxSaleOrder.findById(id);
        }
        if (!existing) {
            existing = await RxSaleOrder.findOne({
                "billData.billNo": id,
                $or: [{ companyId: req.user?.companyId }, { companyId: null }]
            });
        }

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Rx Sale Order not found",
            });
        }

        existing.status = status;
        if (cancelReason !== undefined) existing.cancelReason = cancelReason;
        const updatedOrder = await existing.save();

        return res.status(200).json({
            success: true,
            message: "Status updated successfully",
            data: updatedOrder,
        });
    } catch (err) {
        console.error("Error updating rx sale order status:", err);
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
        let existing = await RxSaleOrder.findById(id);
        if (!existing) existing = await RxSaleOrder.findOne({ "billData.billNo": id });
        if (!existing) return res.status(404).json({ success: false, message: "RX Order not found" });
        existing.cancelReason = cancelReason;
        await existing.save();
        return res.status(200).json({ success: true, message: "Cancel reason updated", data: existing });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};

const updateRxSaleOrderBookedBy = async (req, res) => {
    try {
        const { id } = req.params;
        const { bookedBy } = req.body;

        let existing = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            existing = await RxSaleOrder.findById(id);
        }
        if (!existing) {
            existing = await RxSaleOrder.findOne({
                "billData.billNo": id,
                $or: [{ companyId: req.user?.companyId }, { companyId: null }]
            });
        }

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Rx Sale Order not found",
            });
        }

        existing.billData.bookedBy = bookedBy;
        const updatedOrder = await existing.save();

        return res.status(200).json({
            success: true,
            message: "Booked By updated successfully",
            data: updatedOrder,
        });
    } catch (err) {
        console.error("Error updating rx sale order bookedBy:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update bookedBy",
            error: err.message,
        });
    }
};

const updateRxSaleOrderVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { vendor } = req.body;

        let order = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            order = await RxSaleOrder.findById(id);
        }
        if (!order) {
            order = await RxSaleOrder.findOne({
                "billData.billNo": id,
                $or: [{ companyId: req.user?.companyId }, { companyId: null }]
            });
        }
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Rx Sale Order not found",
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
        console.error("Error updating rx sale order vendor:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update vendor",
            error: err.message,
        });
    }
};

const createRxChallan = async (req, res) => {
    try {
        const data = req.body || {};
        const selectedItemIds = data.selectedItemIds || [];

        console.log('📦 createRxChallan received:', {
            sourceSaleId: data.sourceSaleId,
            itemsCount: data.items?.length,
            selectedItemIds: data.selectedItemIds?.length,
        });

        // --- Purchase Validation (Workflow Restriction) ---
        if (data.sourceSaleId) {
            const sourceOrder = await RxSaleOrder.findById(data.sourceSaleId);
            if (sourceOrder && sourceOrder.status !== "Done") {
                const unpurchasedItems = [];
                for (const selectedId of selectedItemIds) {
                    const originalItem = sourceOrder.items.id(selectedId);
                    if (originalItem && !originalItem.isPurchased && (originalItem.itemStatus || "Pending").toLowerCase() === "pending") {
                        unpurchasedItems.push(originalItem.itemName || selectedId);
                    }
                }

                if (unpurchasedItems.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Please complete purchase before creating challan.",
                        details: `Unpurchased items: ${unpurchasedItems.join(", ")}`
                    });
                }
            }
        }

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
                sellPrice: Number(item.sellPrice) || 0,
                combinationId: item.combinationId || "",
                orderNo: item.orderNo || "",
                remark: item.remark || "",
                vendor: item.vendor || "",
                customer: item.customer || "",
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
            console.warn('❌ No items provided in challan request');
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

        // Create challan payload
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
            orderType: "RX",
        };

        // Import SaleChallan model dynamically
        const newChallan = new SaleChallan(challanData);
        const savedChallan = await newChallan.save();
        console.log('✅ RX Challan saved successfully:', savedChallan._id);

        // Update the source RX sale order with new item statuses
        if (data.sourceSaleId && items.length) {
            try {
                let rxSaleOrder = null;
                if (mongoose.Types.ObjectId.isValid(data.sourceSaleId)) {
                    rxSaleOrder = await RxSaleOrder.findById(data.sourceSaleId);
                }
                if (!rxSaleOrder) {
                    rxSaleOrder = await RxSaleOrder.findOne({ "billData.billNo": data.sourceSaleId });
                }
                if (rxSaleOrder) {
                    rxSaleOrder.items = rxSaleOrder.items.map(sItem => {
                        const challanItem = items.find(cItem => String(cItem._id) === String(sItem._id));
                        if (challanItem && selectedItemIds.includes(String(sItem._id))) {
                            sItem.isChallaned = true;
                            sItem.itemStatus = "In Progress";
                        }
                        return sItem;
                    });

                    let addedUsedQty = 0;
                    for (const chalItem of items) {
                        if (chalItem._id) {
                            addedUsedQty += Number(chalItem.qty) || 0;
                        }
                    }

                    rxSaleOrder.usedQty = Number(rxSaleOrder.usedQty || 0) + addedUsedQty;
                    const itemsTotalQty = Array.isArray(rxSaleOrder.items)
                        ? rxSaleOrder.items.reduce((s, it) => s + (Number(it.qty) || 0), 0)
                        : 0;

                    rxSaleOrder.orderQty = Number(rxSaleOrder.orderQty ?? itemsTotalQty);
                    rxSaleOrder.balQty = Math.max(
                        0,
                        Number(rxSaleOrder.orderQty || 0) - Number(rxSaleOrder.usedQty || 0)
                    );

                    if (!rxSaleOrder.usedIn) rxSaleOrder.usedIn = [];
                    if (!rxSaleOrder.usedIn.some(u => u.type === 'SC' && u.number === savedChallan.billData.billNo)) {
                        rxSaleOrder.usedIn.push({ type: 'SC', number: savedChallan.billData.billNo });
                    }

                    rxSaleOrder.status = deriveOrderStatus(rxSaleOrder.items, rxSaleOrder.status);

                    if (!rxSaleOrder.usedIn) rxSaleOrder.usedIn = [];
                    if (!rxSaleOrder.usedIn.some(u => u.type === 'SC' && u.number === savedChallan.billData.billNo)) {
                        rxSaleOrder.usedIn.push({ type: 'SC', number: savedChallan.billData.billNo });
                    }

                    await rxSaleOrder.save();
                    console.log('✅ RX Sale order updated with new item statuses');
                }
            } catch (err) {
                console.warn("⚠️ Could not update RX sale order with status:", err.message);
            }
        }

        return res.status(201).json({
            success: true,
            message: "RX Challan created successfully",
            data: savedChallan,
        });
    } catch (err) {
        console.error("Error creating RX challan:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to create RX challan",
            error: err.message,
        });
    }
};

const updateRxItemStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { itemIds, newStatus } = req.body;

        if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Item IDs array is required",
            });
        }

        let order = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            order = await RxSaleOrder.findById(id);
        }
        if (!order) {
            order = await RxSaleOrder.findOne({
                "billData.billNo": id,
                $or: [{ companyId: req.user?.companyId }, { companyId: null }]
            });
        }
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "RX Sale Order not found",
            });
        }

        order.items = order.items.map(item => {
            if (itemIds.includes(String(item._id))) {
                item.itemStatus = newStatus;
            }
            return item;
        });

        order.status = deriveOrderStatus(order.items, order.status);

        const updatedOrder = await order.save();

        return res.status(200).json({
            success: true,
            message: "Item status updated successfully",
            data: {
                data: updatedOrder,
                status: updatedOrder.status
            },
        });
    } catch (err) {
        console.error("Error updating RX item status:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update item status",
            error: err.message,
        });
    }
};

const updateOrderPlacementStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isOrderPlaced } = req.body;

        const order = await RxSaleOrder.findById(id);
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

        const order = await RxSaleOrder.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "RX Order not found" });
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
            message: "RX Item Order No updated",
            data: order
        });
    } catch (err) {
        console.error("Error in updateItemOrderNo (RX):", err);
        return res.status(500).json({ success: false, error: err.message });
    }
};

const updateItemRemark = async (req, res) => {
    try {
        const { id: orderId } = req.params;
        const { itemId, remark } = req.body;

        const order = await RxSaleOrder.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "RX Order not found" });
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
            message: "RX Item Remark updated",
            data: order
        });
    } catch (err) {
        console.error("Error in updateItemRemark (RX):", err);
        return res.status(500).json({ success: false, error: err.message });
    }
};

const updateRxSaleOrderRefNo = async (req, res) => {
    try {
        const { id } = req.params;
        const { refNo } = req.body;
        const order = await RxSaleOrder.findById(id);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        order.refNo = refNo;
        await order.save();
        return res.status(200).json({ success: true, data: order });
    } catch (err) {
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
    console.error("Error validating account limits (Rx):", err);
    return res.status(500).json({
      success: false,
      message: "Error validating account limits",
      error: err.message
    });
  }
};

export {
    addRxSaleOrder,
    getAllRxSaleOrder,
    getRxSaleOrder,
    editRxSaleOrder,
    removeRxSaleOrder,
    createRxInvoiceFromOrder,
    getNextBillNumberForRxSaleOrder,
    updateRxSaleOrderStatus,
    updateRxSaleOrderBookedBy,
    updateRxSaleOrderVendor,
    createRxChallan,
    updateRxItemStatus,
    updateOrderPlacementStatus,
    updateItemOrderNo,
    updateItemRemark,
    updateRxSaleOrderRefNo,
    updateCancelReason,
    validateAccountLimits,
};
