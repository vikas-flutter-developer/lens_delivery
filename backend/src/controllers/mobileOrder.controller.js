import LensSaleOrder from "../models/LensSaleOrder.js";
import RxSaleOrder from "../models/RxSaleOrder.js";
import ContactLensSaleOrder from "../models/ContactLensSaleOrder.js";
import mongoose from "mongoose";

/**
 * Update the status of an order (checks all 3 sale order types)
 * PATCH /api/mobile/orders/:orderId/status
 */
export const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        const companyId = req.user?.companyId;

        if (!status) {
            return res.status(400).json({ success: false, message: "Status is required" });
        }

        // Validate status value (case-insensitive for convenience, but matching enum)
        const allowedStatuses = ["Pending", "In Progress", "Done", "Shipped", "Delivered", "Cancelled"];
        const normalizedStatus = allowedStatuses.find(s => s.toLowerCase() === status.toLowerCase());

        if (!normalizedStatus) {
            return res.status(400).json({ success: false, message: "Invalid status value" });
        }

        const query = { _id: orderId, companyId };
        const update = {
            $set: {
                status: normalizedStatus,
                parentStatus: normalizedStatus // Sync parentStatus as well if applicable
            }
        };

        // Try updating in each model
        let updatedOrder = await LensSaleOrder.findOneAndUpdate(query, update, { new: true });

        if (!updatedOrder) {
            updatedOrder = await RxSaleOrder.findOneAndUpdate(query, update, { new: true });
        }

        if (!updatedOrder) {
            updatedOrder = await ContactLensSaleOrder.findOneAndUpdate(query, update, { new: true });
        }

        if (!updatedOrder) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        res.status(200).json({
            success: true,
            message: `Order status updated to ${normalizedStatus}`,
            data: updatedOrder
        });

    } catch (error) {
        console.error("[MobileOrderController] updateOrderStatus error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

/**
 * Get count of orders in each status for the dashboard
 * GET /api/mobile/orders/status-summary
 */
export const getOrderStatusSummary = async (req, res) => {
    try {
        const companyId = req.user?.companyId;

        if (!companyId) {
            return res.status(401).json({ success: false, message: "User companyId not found" });
        }

        // Fetch counts from all 3 order models
        const models = [LensSaleOrder, RxSaleOrder, ContactLensSaleOrder];

        const statusMap = {
            "Pending": 0,
            "In Progress": 0,
            "Done": 0,
            "Shipped": 0,
            "Delivered": 0,
            "Cancelled": 0
        };

        let totalOrders = 0;

        for (const model of models) {
            const results = await model.aggregate([
                { $match: { companyId: new mongoose.Types.ObjectId(companyId) } },
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]);

            results.forEach(res => {
                if (res._id && statusMap[res._id] !== undefined) {
                    statusMap[res._id] += res.count;
                }
                totalOrders += res.count;
            });
        }

        res.status(200).json({
            success: true,
            data: {
                pending: statusMap["Pending"],
                inProgress: statusMap["In Progress"],
                done: statusMap["Done"],
                shipped: statusMap["Shipped"],
                delivered: statusMap["Delivered"],
                cancelled: statusMap["Cancelled"],
                all: totalOrders
            }
        });

    } catch (error) {
        console.error("[MobileOrderController] getOrderStatusSummary error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};
