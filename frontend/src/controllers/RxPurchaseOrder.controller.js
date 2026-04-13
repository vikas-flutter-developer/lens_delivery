import ApiClient from "../ApiClient";

export const addRxPurchaseOrder = async (data) => {
    try {
        const res = await ApiClient.post("/rxPurchaseOrder/createRxPurchaseOrder", data);
        return res.data;
    } catch (err) {
        console.log(err);
        return err?.response?.data;
    }
};

export const getAllRxPurchaseOrder = async () => {
    try {
        const res = await ApiClient.get("/rxPurchaseOrder/getAllRxPurchaseOrder");
        return res.data;
    } catch (err) {
        console.log(err);
        return err?.response?.data;
    }
};

export const getRxPurchaseOrder = async (id) => {
    try {
        const res = await ApiClient.post("/rxPurchaseOrder/getRxPurchaseOrder", { id });
        return { success: true, data: res.data, status: res.status };
    } catch (err) {
        const message = err?.response?.data?.message || err?.message || "Error";
        const status = err?.response?.status;
        return { success: false, error: message, status };
    }
};

export const editRxPurchaseOrder = async (id, data) => {
    try {
        const res = await ApiClient.put(`/rxPurchaseOrder/editRxPurchaseOrder/${id}`, data);
        return res.data;
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Failed to update",
            status: err?.response?.status,
        };
    }
};

export const removeRxPurchaseOrder = async (id) => {
    try {
        const res = await ApiClient.delete(`/rxPurchaseOrder/deleteRxPurchaseOrder/${id}`);
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
        const res = await ApiClient.post("/rxPurchaseOrder/createRxInvoice", data);
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Creating invoice failed",
        };
    }
};

export const updateRxPurchaseOrderStatus = async (id, status, cancelReason) => {
    try {
        const res = await ApiClient.patch(`/rxPurchaseOrder/updateStatus/${id}`, { status, cancelReason });
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Failed to update status",
        };
    }
};

export const updateRxPurchaseOrderCancelReason = async (id, cancelReason) => {
    try {
        const res = await ApiClient.patch(`/rxPurchaseOrder/updateCancelReason/${id}`, { cancelReason });
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Failed to update cancel reason",
        };
    }
};

export const getNextBillNumberForRxPurchaseOrder = async (partyName) => {
    try {
        const res = await ApiClient.post("/rxPurchaseOrder/getNextBillNumber", { partyName });
        return res.data.nextBillNumber || 1;
    } catch (err) {
        console.log("Error getting next bill number:", err);
        return 1;
    }
};

export const createRxPurchaseChallan = async (data) => {
    try {
        const res = await ApiClient.post("/rxPurchaseOrder/createRxPurchaseChallan", data);
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Creating challan failed",
        };
    }
};
