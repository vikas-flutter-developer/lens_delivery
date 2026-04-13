import ContactLensPurchaseOrder from "../models/ContactLensPurchaseOrder.js";
import ContactLensSaleOrder from "../models/ContactLensSaleOrder.js";
import PurchaseChallan from "../models/LensPurchaseChallan.js";
import mongoose from "mongoose";
import { derivePurchaseOrderStatus } from "../utils/statusManager.js";

const addContactLensPurchaseOrder = async (req, res) => {
    try {
        const data = req.body;
        const items = (data.items || []).map((item) => ({
            barcode: item.barcode || "",
            itemName: item.itemName || "",
            unit: item.unit || "",
            qty: Number(item.qty) || 0,
            importDate: item.importDate || null,
            expiryDate: item.expiryDate || null,
            mrp: Number(item.mrp) || 0,
            purchasePrice: Number(item.purchasePrice) || 0,
            salePrice: Number(item.salePrice) || 0,
            discount: Number(item.discount) || 0,
            totalAmount: Number(item.totalAmount) || 0,
            isInvoiced: false,
            isChallaned: false,
            remark: item.remark || "",
            vendor: item.vendor || "",
            combinationId: item.combinationId || "",
            orderNo: item.orderNo || "",
            eye: item.eye || "",
            sph: item.sph || "",
            cyl: item.cyl || "",
            axis: item.axis || "",
            add: item.add || "",
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
                message: "At least one purchase order item is required",
            });
        }

        const subtotal = items.reduce((sum, it) => sum + (Number(it.totalAmount) || 0), 0);
        const taxesAmount = taxes.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const netAmount = subtotal + taxesAmount;
        const paidAmount = Number(data.paidAmount) || 0;
        const dueAmount = netAmount - paidAmount;
        const grossAmount = items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.purchasePrice) || 0), 0);
        const orderQty = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

        const newOrder = new ContactLensPurchaseOrder({
            billData: data.billData || {},
            partyData: data.partyData || {},
            items,
            taxes,
            orderQty,
            usedQty: 0,
            balQty: orderQty,
            grossAmount,
            subtotal,
            taxesAmount,
            netAmount,
            paidAmount,
            dueAmount,
            deliveryDate: data.deliveryDate || Date.now(),
            remark: data.remark || "",
            status: data.status || "Pending",
            sourceSaleId: data.sourceSaleId || "", // Store source sale ID
        });

        const savedOrder = await newOrder.save();

        // Update Source Sale Order if it exists
        if (data.sourceSaleId) {
            const saleOrder = await ContactLensSaleOrder.findById(data.sourceSaleId);
            if (saleOrder) {
                let updatedOrder = false;
                if (!saleOrder.usedIn) saleOrder.usedIn = [];
                // Check if already linked to avoid duplicates
                const poRef = `PO(${savedOrder.billData?.billNo || '?'})`;
                const exists = saleOrder.usedIn.some(u => u.type === 'PO' && u.number === (savedOrder.billData?.billNo || ''));

                if (!exists) {
                    saleOrder.usedIn.push({
                        type: 'PO',
                        number: savedOrder.billData?.billNo || ''
                    });
                    updatedOrder = true;
                }

                // Update item statuses to "In Progress" if they are linked
                let itemsChanged = false;
                const vendorName = data.partyData?.partyAccount || "";

                for (const pItem of (data.items || [])) {
                    // Try to find matching item in sale order
                    const sItem = saleOrder.items.find(i =>
                        (pItem.saleOrderItemId && String(i._id) === String(pItem.saleOrderItemId)) ||
                        (i.itemName === pItem.itemName && i.itemStatus === "Pending")
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
                    saleOrder.markModified("items");

                    // Derive overall order status
                    const { deriveOrderStatus } = await import("../utils/statusManager.js");
                    saleOrder.status = deriveOrderStatus(saleOrder.items, saleOrder.status);
                    if (saleOrder.parentStatus) saleOrder.parentStatus = saleOrder.status;
                }

                if (updatedOrder) {
                    await saleOrder.save();
                }
            }
        }

        return res.status(201).json({
            success: true,
            message: "Contact Lens Purchase Order added successfully",
            data: savedOrder,
        });
    } catch (err) {
        console.error("Error adding contact lens purchase order:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to add purchase order",
            error: err.message,
        });
    }
};

const getContactLensPurchaseOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const purchaseOrder = await ContactLensPurchaseOrder.findById(id);
        if (!purchaseOrder) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        return res.status(200).json({ success: true, data: purchaseOrder });
    } catch (err) {
        console.error("Error fetching contact lens purchase:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

const editContactLensPurchaseOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;

        const existing = await ContactLensPurchaseOrder.findById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const items = (data.items || []).map((item) => ({
            _id: item._id ? String(item._id) : undefined,
            barcode: item.barcode || "",
            itemName: item.itemName || "",
            unit: item.unit || "",
            qty: Number(item.qty) || 0,
            importDate: item.importDate || null,
            expiryDate: item.expiryDate || null,
            mrp: Number(item.mrp) || 0,
            purchasePrice: Number(item.purchasePrice) || 0,
            salePrice: Number(item.salePrice) || 0,
            discount: Number(item.discount) || 0,
            totalAmount: Number(item.totalAmount) || 0,
            isInvoiced: item.isInvoiced || false,
            isChallaned: item.isChallaned || false,
            remark: item.remark || "",
            vendor: item.vendor || "",
            combinationId: item.combinationId || "",
            orderNo: item.orderNo || "",
            eye: item.eye || "",
            sph: item.sph || "",
            cyl: item.cyl || "",
            axis: item.axis || "",
            add: item.add || "",
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
        const grossAmount = items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.purchasePrice) || 0), 0);
        const orderQty = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

        existing.billData = data.billData || existing.billData;
        existing.partyData = data.partyData || existing.partyData;
        existing.items = items;
        existing.taxes = taxes;
        existing.orderQty = orderQty;
        existing.balQty = orderQty - existing.usedQty; // basic update
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
            message: "Purchase order updated successfully",
            data: updated,
        });
    } catch (err) {
        console.error("Error updating contact lens purchase order:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update purchase order",
            error: err.message,
        });
    }
};

const getNextBillNo = async (req, res) => {
    try {
        const { partyAccount } = req.params;
        const lastOrder = await ContactLensPurchaseOrder.findOne({ "partyData.partyAccount": partyAccount }).sort({ createdAt: -1 });
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

const getNextPurchaseChallanBillNo = async (req, res) => {
    try {
        const { partyAccount } = req.params;
        // Search in PurchaseChallan collection since that's where the duplicate key error occurs
        const lastChallan = await PurchaseChallan.findOne().sort({ createdAt: -1 });
        let nextBillNo = 1;

        if (lastChallan && lastChallan.billData && lastChallan.billData.billNo) {
            const lastNo = parseInt(lastChallan.billData.billNo);
            if (!isNaN(lastNo)) {
                nextBillNo = lastNo + 1;
            }
        }

        return res.status(200).json({ success: true, nextBillNo });
    } catch (err) {
        console.error("Error fetching next challan bill no:", err);
        return res.status(500).json({ success: false, message: "Error fetching next challan bill no", error: err.message });
    }
};

const getAllContactLensPurchaseOrder = async (req, res) => {
    try {
        const purchaseOrders = await ContactLensPurchaseOrder.find().sort({ createdAt: -1 });
        return res.status(200).json({
            success: true,
            data: purchaseOrders,
        });
    } catch (err) {
        console.error("Error fetching contact lens purchase Orders:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch contact lens purchases",
            error: err.message,
        });
    }
};

const removeContactLensPurchaseOrder = async (req, res) => {
    try {
        const { id } = req.params;

        const existing = await ContactLensPurchaseOrder.findById(id);
        if (!existing) {
            return res.status(404).json({ message: "Order not found" });
        }

        await ContactLensPurchaseOrder.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: "Contact Lens Purchase Order deleted successfully",
        });
    } catch (error) {
        console.error("Delete Order Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const updateContactLensPurchaseOrderStatus = async (req, res) => {
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

        const updatedOrder = await ContactLensPurchaseOrder.findByIdAndUpdate(
            id,
            { status },
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

const updateContactLensPurchaseOrderBookedBy = async (req, res) => {
    try {
        const { id } = req.params;
        const { bookedBy } = req.body;

        const updatedOrder = await ContactLensPurchaseOrder.findByIdAndUpdate(
            id,
            { "billData.bookedBy": bookedBy },
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
            message: "Booked By updated successfully",
            data: updatedOrder,
        });
    } catch (err) {
        console.error("Error updating purchase order bookedBy:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update bookedBy",
            error: err.message,
        });
    }
};

const updateContactLensPurchaseOrderVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { vendor } = req.body;

        const order = await ContactLensPurchaseOrder.findById(id);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Purchase Order not found",
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
        console.error("Error updating purchase order vendor:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update vendor",
            error: err.message,
        });
    }
};

const createContactLensPurchaseChallan = async (req, res) => {
    try {
        const data = req.body || {};
        const selectedItemIds = data.selectedItemIds || [];

        const items = (data.items || []).map((item) => ({
            _id: item._id ? String(item._id) : undefined,
            barcode: item.barcode || "",
            itemName: item.itemName || "",
            unit: item.unit || "",
            qty: Number(item.qty) || 0,
            importDate: item.importDate ? new Date(item.importDate) : null,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            mrp: Number(item.mrp) || 0,
            purchasePrice: Number(item.purchasePrice) || 0,
            salePrice: Number(item.salePrice) || 0,
            discount: Number(item.discount) || 0,
            totalAmount: Number(item.totalAmount) || 0,
            combinationId: item.combinationId || "",
            orderNo: item.orderNo || "",
            eye: item.eye || "",
            sph: item.sph ?? "",
            cyl: item.cyl ?? "",
            axis: item.axis ?? "",
            add: item.add ?? "",
            remark: item.remark || "",
            vendor: item.vendor || "",
            itemStatus: "In Progress"
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
                message: "At least one item is required",
            });
        }

        const subtotal = items.reduce((sum, it) => sum + (Number(it.totalAmount) || 0), 0);
        const taxesAmount = taxes.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
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
                        console.log(`[BACKEND_RESOLVE_CONTACT] attempt for ${it.itemName}, SPH:${it.sph}, CYL:${it.cyl}, ADD:${it.add}, EYE:${it.eye}`);
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
                                    console.log(`[BACKEND_RESOLVE_CONTACT] Found ID: ${combId}`);
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
            orderType: "CONTACT",
        };

        const newChallan = new PurchaseChallan(challanData);
        const savedChallan = await newChallan.save();

        if (data.sourcePurchaseId && items.length) {
            try {
                const contactPurchaseOrder = await ContactLensPurchaseOrder.findById(data.sourcePurchaseId);
                if (contactPurchaseOrder) {
                    let addedUsedQty = 0;
                    for (const chalItem of items) {
                        if (!chalItem._id) continue;
                        const sItem = contactPurchaseOrder.items.id(chalItem._id);
                        if (sItem && !sItem.isChallaned) {
                            sItem.isChallaned = true;
                            sItem.itemStatus = "In Progress";
                            const qtyUsed = Number(chalItem.qty) || 0;
                            contactPurchaseOrder.usageHistory = contactPurchaseOrder.usageHistory || [];
                            contactPurchaseOrder.usageHistory.push({
                                challanId: savedChallan._id.toString(),
                                billNo: savedChallan.billData.billNo || "",
                                series: savedChallan.billData.billSeries || "",
                                qtyUsed,
                                date: new Date(),
                            });
                            addedUsedQty += qtyUsed;
                        }
                    }

                    contactPurchaseOrder.usedQty = Number(contactPurchaseOrder.usedQty || 0) + addedUsedQty;
                    const itemsTotalQty = Array.isArray(contactPurchaseOrder.items)
                        ? contactPurchaseOrder.items.reduce((s, it) => s + (Number(it.qty) || 0), 0)
                        : 0;
                    contactPurchaseOrder.orderQty = Number(contactPurchaseOrder.orderQty ?? itemsTotalQty);
                    contactPurchaseOrder.balQty = Math.max(0, Number(contactPurchaseOrder.orderQty || 0) - Number(contactPurchaseOrder.usedQty || 0));

                    if (!contactPurchaseOrder.usedIn) contactPurchaseOrder.usedIn = [];
                    if (!contactPurchaseOrder.usedIn.some(u => u.type === 'PC' && u.number === savedChallan.billData.billNo)) {
                        contactPurchaseOrder.usedIn.push({ type: 'PC', number: savedChallan.billData.billNo });
                    }

                    contactPurchaseOrder.status = derivePurchaseOrderStatus(contactPurchaseOrder.items, contactPurchaseOrder.status);
                    contactPurchaseOrder.parentStatus = contactPurchaseOrder.status;
                    await contactPurchaseOrder.save();
                }
            } catch (err) {
                console.warn("[SYNC] Could not sync with Contact Lens Purchase Order:", err.message);
            }
        }

        return res.status(201).json({
            success: true,
            message: "Contact Lens Purchase Challan created successfully",
            data: savedChallan,
        });

    } catch (err) {
        console.error("Error creating Contact Lens Purchase Challan:", err.message);
        console.error("Full error stack:", err.stack);
        console.error("Error name:", err.name);
        if (err.errors) {
            console.error("Validation errors:", JSON.stringify(err.errors, null, 2));
        }
        return res.status(500).json({ success: false, message: "Failed to create challan", error: err.message, details: err.errors });
    }
};

export {
    getAllContactLensPurchaseOrder,
    removeContactLensPurchaseOrder,
    updateContactLensPurchaseOrderStatus,
    updateContactLensPurchaseOrderBookedBy,
    addContactLensPurchaseOrder,
    getContactLensPurchaseOrder,
    editContactLensPurchaseOrder,
    getNextBillNo,
    getNextPurchaseChallanBillNo,
    updateContactLensPurchaseOrderVendor,
    createContactLensPurchaseChallan
};
