import ApiClient from "../ApiClient";

export const addRxSaleOrder = async (data) => {
    try {
        const res = await ApiClient.post("/rxSaleOrder/createRxSaleOrder", data);
        return res.data;
    } catch (err) {
        console.log(err);
        return err?.response?.data;
    }
};

export const getAllRxSaleOrder = async () => {
    try {
        const res = await ApiClient.get("/rxSaleOrder/getAllRxSaleOrder");
        return res.data || { success: false, data: [] };
    } catch (err) {
        console.log(err);
        return { success: false, data: [] };
    }
};

export const getRxSaleOrder = async (id) => {
    try {
        const res = await ApiClient.post("/rxSaleOrder/getRxSaleOrder", { id });
        return { success: true, data: res.data, status: res.status };
    } catch (err) {
        const message = err?.response?.data?.message || err?.message || "Error";
        const status = err?.response?.status;
        return { success: false, error: message, status };
    }
};

export const editRxSaleOrder = async (id, data) => {
    try {
        const res = await ApiClient.put(`/rxSaleOrder/editRxSaleOrder/${id}`, data);
        return res.data;
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Failed to update",
            status: err?.response?.status,
        };
    }
};

export const removeRxSaleOrder = async (id) => {
    try {
        const res = await ApiClient.delete(`/rxSaleOrder/deleteRxSaleOrder/${id}`);
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Delete failed",
        };
    }
};

export const createRxInvoice = async (data) => {
    try {
        const res = await ApiClient.post("/rxSaleOrder/createRxInvoice", data);
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Creating invoice failed",
        };
    }
};

export const createRxChallan = async (data) => {
    try {
        const res = await ApiClient.post("/rxSaleOrder/createRxChallan", data);
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            message: err?.response?.data?.message || "Creating challan failed",
            details: err?.response?.data?.details || err?.message,
        };
    }
};

export const getNextBillNumberForRxSaleOrder = async (partyName) => {
    try {
        console.log("Fetching bill number for party:", partyName);
        const res = await ApiClient.post("/rxSaleOrder/getNextBillNumber", { partyName });
        if (res?.data && typeof res.data.nextBillNumber === 'number') {
            console.log(`Party "${partyName}" found ${res.data.count} times, next bill number: ${res.data.nextBillNumber}`);
            return res.data.nextBillNumber;
        }
        console.log("Invalid response format:", res);
        return 1;
    } catch (err) {
        console.error("Error fetching next bill number:", err);
        return 1;
    }
};

export const updateRxSaleOrderStatus = async (id, status, cancelReason) => {
    try {
        const res = await ApiClient.patch(`/rxSaleOrder/updateStatus/${id}`, { status, cancelReason });
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Failed to update status",
        };
    }
};

export const updateRxSaleOrderCancelReason = async (id, cancelReason) => {
    try {
        const res = await ApiClient.patch(`/rxSaleOrder/updateCancelReason/${id}`, { cancelReason });
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Failed to update cancel reason",
        };
    }
};

export const updateRxSaleOrderBookedBy = async (id, bookedBy) => {
    try {
        const res = await ApiClient.patch(`/rxSaleOrder/updateBookedBy/${id}`, { bookedBy });
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Failed to update booked by",
        };
    }
};

export const updateRxSaleOrderVendor = async (id, vendor) => {
    try {
        const res = await ApiClient.patch(`/rxSaleOrder/updateVendor/${id}`, { vendor });
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Failed to update vendor",
        };
    }
};

export const updateRxItemStatus = async (orderId, itemIds, newStatus) => {
    try {
        const res = await ApiClient.patch(`/rxSaleOrder/updateItemStatus/${orderId}`, {
            itemIds,
            newStatus
        });
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Failed to update item status",
        };
    }
};

export const updateOrderPlacementStatus = async (id, isOrderPlaced) => {
    try {
        const res = await ApiClient.patch(`/rxSaleOrder/updateOrderPlacementStatus/${id}`, { isOrderPlaced });
        return res.data;
    } catch (err) {
        return err?.response?.data || { success: false, message: "Failed to update placement status" };
    }
};

export const updateRxItemRemark = async (orderId, itemId, remark) => {
    try {
        const res = await ApiClient.patch(`/rxSaleOrder/updateItemRemark/${orderId}`, {
            itemId,
            remark
        });
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Failed to update item remark",
        };
    }
};

export const updateRxSaleOrderRefNo = async (id, refNo) => {
    try {
        const res = await ApiClient.patch(`/rxSaleOrder/updateRefNo/${id}`, { refNo });
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            message: err?.response?.data?.message || "Failed to update ref no",
        };
    }
};
