import RxPurchaseOrder from "../models/RxPurchaseOrder.js";
import RxSaleOrder from "../models/RxSaleOrder.js";
import RxPurchase from "../models/RxPurchase.js";
import PurchaseChallan from "../models/LensPurchaseChallan.js";
import mongoose from "mongoose";
import { derivePurchaseOrderStatus } from "../utils/statusManager.js";

const addRxPurchaseOrder = async (req, res) => {
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
                purchasePrice: Number(item.purchasePrice) || 0,
                discount: Number(item.discount) || 0,
                totalAmount: Number(item.totalAmount) || 0,
                sellPrice: Number(item.sellPrice) || 0,
                combinationId: item.combinationId || "",
                orderNo: item.orderNo || "",
                remark: item.remark || "",
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

        const subtotal = items.reduce((sum, it) => sum + (Number(it.totalAmount) || 0), 0);
        const taxesAmount = taxes.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const netAmount = subtotal + taxesAmount;
        const paidAmount = Number(data.paidAmount) || 0;
        const dueAmount = netAmount - paidAmount;
        const grossAmount = items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.purchasePrice) || 0), 0);

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

        const newOrder = new RxPurchaseOrder({
            billData: data.billData || {},
            partyData,
            items,
            taxes,
            orderQty: totalqty,
            balQty: totalqty,
            grossAmount,
            subtotal,
            taxesAmount,
            netAmount,
            paidAmount,
            dueAmount,
            deliveryDate: data.deliveryDate || Date.now(),
            remark: data.remark || "",
            status: derivePurchaseOrderStatus(items, data.status || "Pending"),
            parentStatus: derivePurchaseOrderStatus(items, data.status || "Pending"),
            sourceSaleId: data.sourceSaleId || null,
        });

        const savedOrder = await newOrder.save();

        // Sync with source Rx Sale Order
        if (data.sourceSaleId) {
            try {
                const rxSaleOrder = await RxSaleOrder.findById(data.sourceSaleId);
                if (rxSaleOrder) {
                    let updatedOrder = false;

                    // Link the purchase order to the sale order
                    if (!rxSaleOrder.usedIn) rxSaleOrder.usedIn = [];
                    if (!rxSaleOrder.usedIn.some(u => u.type === 'RPO' && u.number === savedOrder.billData.billNo)) {
                        rxSaleOrder.usedIn.push({ type: 'RPO', number: savedOrder.billData.billNo });
                        updatedOrder = true;
                        console.log(`[SYNC] Updated Rx Sale Order ${data.sourceSaleId} with RPO: ${savedOrder.billData.billNo}`);
                    }

                    // Update item statuses to "In Progress" if they are linked
                    let itemsChanged = false;
                    const vendorName = partyData.partyAccount || "";

                    for (const pItem of (data.items || [])) {
                        const sItem = rxSaleOrder.items.find(i =>
                            (pItem.saleOrderItemId && String(i._id) === String(pItem.saleOrderItemId)) ||
                            (i.itemName === pItem.itemName && i.eye === pItem.eye && i.itemStatus === "Pending")
                        );

                        if (sItem) {
                            if (sItem.itemStatus === "Pending") {
                                sItem.itemStatus = "In Progress";
                                itemsChanged = true;
                            }
                            if (vendorName && (!sItem.vendor || sItem.vendor.trim() === "")) {
                                sItem.vendor = vendorName;
                                itemsChanged = true;
                            }
                        }
                    }

                    if (itemsChanged) {
                        updatedOrder = true;
                        rxSaleOrder.markModified("items");

                        // Derive overall order status
                        const { deriveOrderStatus } = await import("../utils/statusManager.js");
                        rxSaleOrder.status = deriveOrderStatus(rxSaleOrder.items, rxSaleOrder.status);
                        if (rxSaleOrder.parentStatus) rxSaleOrder.parentStatus = rxSaleOrder.status;
                    }

                    if (updatedOrder) {
                        await rxSaleOrder.save();
                    }
                }
            } catch (err) {
                console.warn("[SYNC] Could not sync with Rx Sale Order:", err.message);
            }
        }

        return res.status(201).json({
            success: true,
            message: "Rx Purchase Order added successfully",
            data: savedOrder,
        });
    } catch (err) {
        console.error("Error adding Rx purchase order:", err);
        return res.status(500).json({ success: false, message: "Failed to add Rx purchase order", error: err.message });
    }
};

const getAllRxPurchaseOrder = async (req, res) => {
    try {
        const orders = await RxPurchaseOrder.find().sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: orders });
    } catch (err) {
        console.error("Error fetching Rx purchase orders:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch orders", error: err.message });
    }
};

const getRxPurchaseOrder = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ message: "ID is required" });
        let purchaseOrder = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            purchaseOrder = await RxPurchaseOrder.findById(id);
        }
        if (!purchaseOrder) {
            purchaseOrder = await RxPurchaseOrder.findOne({
                "billData.billNo": id,
                $or: [{ companyId: req.user?.companyId }, { companyId: null }]
            });
        }
        if (!purchaseOrder) return res.status(404).json({ message: "Purchase order not found" });
        return res.status(200).json({ success: true, data: purchaseOrder });
    } catch (err) {
        console.error("Error fetching Rx purchase order:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

const editRxPurchaseOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;
        if (!id) return res.status(400).json({ message: "Order ID is required" });
        let existing = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            existing = await RxPurchaseOrder.findById(id);
        }
        if (!existing) {
            existing = await RxPurchaseOrder.findOne({
                "billData.billNo": id,
                $or: [{ companyId: req.user?.companyId }, { companyId: null }]
            });
        }
        if (!existing) return res.status(404).json({ message: "Order not found" });

        const incomingItems = (data.items || []).map((item) => ({
            _id: item._id ? String(item._id) : undefined,
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
            orderNo: item.orderNo || "",
            remark: item.remark || "",
        }));

        const subtotal = incomingItems.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0);
        const taxes = (data.taxes || []).map((tax) => ({
            taxName: tax.taxName || "",
            type: tax.type || "Additive",
            percentage: Number(tax.percentage) || 0,
            amount: Number(tax.amount) || 0,
        }));
        const taxesAmount = taxes.reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const netAmount = subtotal + taxesAmount;
        const grossAmount = incomingItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.purchasePrice) || 0), 0);
        const newOrderQty = incomingItems.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

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

        existing.billData = data.billData || existing.billData;
        existing.partyData = partyData;
        existing.items = incomingItems;
        existing.taxes = taxes;
        existing.grossAmount = grossAmount;
        existing.subtotal = subtotal;
        existing.taxesAmount = taxesAmount;
        existing.netAmount = netAmount;
        existing.orderQty = newOrderQty;
        existing.balQty = newOrderQty - (existing.usedQty || 0);
        existing.remark = data.remark || existing.remark;
        existing.deliveryDate = data.deliveryDate || existing.deliveryDate;
        existing.status = derivePurchaseOrderStatus(incomingItems, data.status || existing.status);
        existing.parentStatus = existing.status;
        existing.paidAmount = Number(data.paidAmount ?? existing.paidAmount ?? 0);
        existing.dueAmount = netAmount - existing.paidAmount;

        const updated = await existing.save();
        return res.status(200).json({ success: true, message: "Rx purchase order updated successfully", data: updated });
    } catch (err) {
        console.error("Error updating Rx purchase order:", err);
        return res.status(500).json({ success: false, message: "Failed to update", error: err.message });
    }
};

const removeRxPurchaseOrder = async (req, res) => {
    try {
        await RxPurchaseOrder.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Rx Purchase Order deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

const createRxPurchaseInvoiceFromOrder = async (req, res) => {
    try {
        const data = req.body || {};
        const items = (data.items || []).map((item) => ({
            _id: item._id ? String(item._id) : undefined,
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
            orderNo: item.orderNo || "",
            remark: item.remark || "",
        }));

        const taxes = (data.taxes || []).map((tax) => ({
            taxName: tax.taxName || "",
            type: tax.type || "Additive",
            percentage: Number(tax.percentage) || 0,
            amount: Number(tax.amount) || 0,
        }));

        const subtotal = items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0);
        const taxesAmount = taxes.reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const netAmount = subtotal + taxesAmount;
        const grossAmount = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.purchasePrice) || 0), 0);

        const newInvoice = new RxPurchase({
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
            summary: { totalQty: items.reduce((s, it) => s + it.qty, 0), totalAmount: subtotal },
            remark: data.remark || "",
            status: data.status || "Pending",
        });

        const savedInvoice = await newInvoice.save();

        if (data.sourcePurchaseId) {
            let order = null;
            if (mongoose.Types.ObjectId.isValid(data.sourcePurchaseId)) {
                order = await RxPurchaseOrder.findById(data.sourcePurchaseId);
            }
            if (!order) {
                order = await RxPurchaseOrder.findOne({ "billData.billNo": data.sourcePurchaseId });
            }
            if (order) {
                let addedUsedQty = 0;
                const invoicedItemIds = items.map(it => String(it._id));
                order.items = order.items.map(oItem => {
                    if (invoicedItemIds.includes(String(oItem._id))) {
                        oItem.itemStatus = "Done";
                        oItem.isInvoiced = true;
                        addedUsedQty += Number(oItem.qty) || 0;
                    }
                    return oItem;
                });

                if (!order.usedIn) order.usedIn = [];
                if (!order.usedIn.some(u => u.type === 'PI' && u.number === savedInvoice.billData.billNo)) {
                    order.usedIn.push({ type: 'PI', number: savedInvoice.billData.billNo });
                }

                order.usedQty = (order.usedQty || 0) + addedUsedQty;
                order.balQty = Math.max(0, (order.orderQty || 0) - (order.usedQty || 0));

                order.status = derivePurchaseOrderStatus(order.items, order.status);
                order.parentStatus = order.status;

                await order.save();
            }
        }

        return res.status(201).json({ success: true, message: "Rx Purchase Invoice created", data: savedInvoice });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to create invoice", error: err.message });
    }
};

const updateRxPurchaseOrderStatus = async (req, res) => {
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

        let updatedOrder = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            updatedOrder = await RxPurchaseOrder.findByIdAndUpdate(
                id,
                { status },
                { new: true }
            );
        }
        if (!updatedOrder) {
            updatedOrder = await RxPurchaseOrder.findOneAndUpdate(
                { "billData.billNo": id },
                { status },
                { new: true }
            );
        }

        if (!updatedOrder) {
            return res.status(404).json({
                success: false,
                message: "Rx Purchase Order not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Status updated successfully",
            data: updatedOrder,
        });
    } catch (err) {
        console.error("Error updating rx purchase order status:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update status",
            error: err.message,
        });
    }
};

const getNextBillNumberForRxPurchaseOrder = async (req, res) => {
    try {
        const { partyName } = req.body;
        if (!partyName) {
            return res.status(400).json({
                success: false,
                message: "Party name is required",
                nextBillNumber: 1
            });
        }

        const allOrders = await RxPurchaseOrder.find({});
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
        console.error("Error fetching next bill number for Rx Purchase Order:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch next bill number",
            nextBillNumber: 1
        });
    }
};

const createRxPurchaseChallan = async (req, res) => {
    try {
        const data = req.body || {};
        const selectedItemIds = data.selectedItemIds || [];

        const items = (data.items || []).map((item) => ({
            _id: item._id ? String(item._id) : undefined,
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
            orderNo: item.orderNo || "",
            remark: item.remark || "",
            itemStatus: "In Progress",
        }));

        const taxes = (data.taxes || []).map((tax) => ({
            taxName: tax.taxName || "",
            type: tax.type || "Additive",
            percentage: Number(tax.percentage) || 0,
            amount: Number(tax.amount) || 0,
        }));

        if (!items.length) {
            return res.status(400).json({
                success: false,
                message: "At least one item is required",
            });
        }

        const subtotal = items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0);
        const taxesAmount = taxes.reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const netAmount = subtotal + taxesAmount;
        const grossAmount = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.purchasePrice) || 0), 0);

        // --- Stock Addition ---
        const LensGroup = (await import("../models/LensGroup.js")).default;
        for (const it of items) {
            if (Number(it.qty) > 0) {
                try {
                    let combId = it.combinationId;

                    // FALLBACK: If combinationId is missing, try to resolve it by power
                    if (!combId) {
                        console.log(`[BACKEND_RESOLVE_RX] attempt for ${it.itemName}, SPH:${it.sph}, CYL:${it.cyl}, ADD:${it.add}, EYE:${it.eye}`);
                        const lookup = await LensGroup.findOne({ productName: it.itemName });
                        if (lookup && lookup.addGroups) {
                            const ag = lookup.addGroups.find(g => Number(g.addValue) === Number(it.add || 0));
                            if (ag && ag.combinations) {
                                const matchedComb = ag.combinations.find(c =>
                                    Number(c.sph) === Number(it.sph || 0) &&
                                    Number(c.cyl) === Number(it.cyl || 0) &&
                                    (it.eye === "RL" ? (c.eye === "R" || c.eye === "L" || c.eye === "RL") : c.eye === it.eye)
                                );
                                if (matchedComb) {
                                    combId = matchedComb._id;
                                    console.log(`[BACKEND_RESOLVE_RX] Found ID: ${combId}`);
                                }
                            }
                        }
                    }

                    if (!combId) {
                        console.warn("⚠️ skipping stock increase: combinationId missing and could not be resolved for", it.itemName);
                        continue;
                    }

                    const resolvedId = new mongoose.Types.ObjectId(combId);
                    const parent = await LensGroup.findOne({ "addGroups.combinations._id": resolvedId });

                    if (!parent) {
                        console.warn("⚠️ Combination Parent Not Found", combId);
                        continue;
                    }

                    let matched = null;
                    for (const ag of parent.addGroups) {
                        const comb = ag.combinations.id(resolvedId);
                        if (comb) {
                            matched = comb;
                            break;
                        }
                    }

                    if (!matched) {
                        console.warn("⚠️ Combination Subdoc Not Found:", combId);
                        continue;
                    }

                    const oldStock = Number(matched.initStock || 0);
                    const qty = Number(it.qty || 0);
                    matched.initStock = oldStock + qty;
                    await parent.save();
                    console.log(`✅ Stock increased for item: ${it.itemName}, New Stock: ${matched.initStock}`);
                } catch (err) {
                    console.error("❌ Error increasing stock for", it.itemName, ":", err.message);
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

        const challanData = {
            billData: challanBillData,
            partyData: data.partyData || {},
            items,
            taxes,
            grossAmount,
            subtotal,
            taxesAmount,
            netAmount,
            paidAmount: Number(data.paidAmount) || 0,
            dueAmount: netAmount - (Number(data.paidAmount) || 0),
            orderQty: items.reduce((s, it) => s + (Number(it.qty) || 0), 0),
            balQty: items.reduce((s, it) => s + (Number(it.qty) || 0), 0),
            deliveryDate: data.deliveryDate || Date.now(),
            time: new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
            remark: data.remark || "",
            status: "In Progress",
            parentStatus: "In Progress",
            sourcePurchaseId: data.sourcePurchaseId || null,
            orderType: "RX",
        };

        const newChallan = new PurchaseChallan(challanData);
        const savedChallan = await newChallan.save();

        if (data.sourcePurchaseId && items.length) {
            try {
                let rxPurchaseOrder = null;
                if (mongoose.Types.ObjectId.isValid(data.sourcePurchaseId)) {
                    rxPurchaseOrder = await RxPurchaseOrder.findById(data.sourcePurchaseId);
                }
                if (!rxPurchaseOrder) {
                    rxPurchaseOrder = await RxPurchaseOrder.findOne({ "billData.billNo": data.sourcePurchaseId });
                }
                if (rxPurchaseOrder) {
                    let addedUsedQty = 0;
                    for (const chalItem of items) {
                        if (!chalItem._id) continue;
                        const sItem = rxPurchaseOrder.items.id(chalItem._id);
                        if (sItem && !sItem.isChallaned) {
                            sItem.isChallaned = true;
                            sItem.itemStatus = "In Progress";
                            const qtyUsed = Number(chalItem.qty) || 0;
                            rxPurchaseOrder.usageHistory = rxPurchaseOrder.usageHistory || [];
                            rxPurchaseOrder.usageHistory.push({
                                challanId: savedChallan._id.toString(),
                                billNo: savedChallan.billData.billNo || "",
                                series: savedChallan.billData.billSeries || "",
                                qtyUsed,
                                date: new Date(),
                            });
                            addedUsedQty += qtyUsed;
                        }
                    }

                    rxPurchaseOrder.usedQty = Number(rxPurchaseOrder.usedQty || 0) + addedUsedQty;
                    const itemsTotalQty = Array.isArray(rxPurchaseOrder.items)
                        ? rxPurchaseOrder.items.reduce((s, it) => s + (Number(it.qty) || 0), 0)
                        : 0;
                    rxPurchaseOrder.orderQty = Number(rxPurchaseOrder.orderQty ?? itemsTotalQty);
                    rxPurchaseOrder.balQty = Math.max(0, Number(rxPurchaseOrder.orderQty || 0) - Number(rxPurchaseOrder.usedQty || 0));

                    if (!rxPurchaseOrder.usedIn) rxPurchaseOrder.usedIn = [];
                    if (!rxPurchaseOrder.usedIn.some(u => u.type === 'PC' && u.number === savedChallan.billData.billNo)) {
                        rxPurchaseOrder.usedIn.push({ type: 'PC', number: savedChallan.billData.billNo });
                    }

                    rxPurchaseOrder.status = derivePurchaseOrderStatus(rxPurchaseOrder.items, rxPurchaseOrder.status);
                    rxPurchaseOrder.parentStatus = rxPurchaseOrder.status;

                    await rxPurchaseOrder.save();
                }
            } catch (err) {
                console.warn("[SYNC] Could not sync with Rx Purchase Order:", err.message);
            }
        }

        return res.status(201).json({
            success: true,
            message: "Rx Purchase Challan created successfully",
            data: savedChallan,
        });
    } catch (err) {
        console.error("Error creating Rx Purchase Challan:", err);
        return res.status(500).json({ success: false, message: "Failed to create challan", error: err.message });
    }
};

export {
    addRxPurchaseOrder,
    getAllRxPurchaseOrder,
    getRxPurchaseOrder,
    editRxPurchaseOrder,
    removeRxPurchaseOrder,
    createRxPurchaseInvoiceFromOrder,
    updateRxPurchaseOrderStatus,
    getNextBillNumberForRxPurchaseOrder,
    createRxPurchaseChallan
};
