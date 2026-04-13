import ApiClient from "../ApiClient";

export const getAllContactLensSaleOrder = async () => {
    try {
        const res = await ApiClient.get("/contactLensSaleOrder/getall");
        return res.data || { success: false, data: [] };
    } catch (err) {
        console.log(err);
        return { success: false, data: [] };
    }
};

export const removeContactLensSaleOrder = async (id) => {
    try {
        const res = await ApiClient.delete(`/contactLensSaleOrder/delete/${id}`);
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Delete failed",
        };
    }
};

export const updateContactLensSaleOrderStatus = async (id, status, cancelReason) => {
    try {
        const res = await ApiClient.put(`/contactLensSaleOrder/status/${id}`, { status, cancelReason });
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Failed to update status",
        };
    }
};

export const updateContactLensSaleOrderCancelReason = async (id, cancelReason) => {
    try {
        const res = await ApiClient.put(`/contactLensSaleOrder/cancelReason/${id}`, { cancelReason });
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Failed to update cancel reason",
        };
    }
};

export const updateContactLensSaleOrderBookedBy = async (id, bookedBy) => {
    try {
        const res = await ApiClient.put(`/contactLensSaleOrder/bookedby/${id}`, { bookedBy });
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Failed to update booked by",
        };
    }
};

export const addContactLensSaleOrder = async (payload) => {
    try {
        const res = await ApiClient.post("/contactLensSaleOrder/add", payload);
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Add failed",
        };
    }
};

export const getContactLensSaleOrder = async (id) => {
    try {
        const res = await ApiClient.get(`/contactLensSaleOrder/get/${id}`);
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Fetch failed",
        };
    }
};

export const editContactLensSaleOrder = async (id, payload) => {
    try {
        const res = await ApiClient.put(`/contactLensSaleOrder/edit/${id}`, payload);
        return res.data;
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Edit failed",
        };
    }
};

export const getNextBillNumberForContactLensSaleOrder = async (partyAccount) => {
    try {
        const res = await ApiClient.get(`/contactLensSaleOrder/nextBillNo/${partyAccount}`);
        return res.data.nextBillNo;
    } catch (err) {
        console.error("Error fetching next bill number:", err);
        return 1;
    }
};

export const updateContactLensSaleOrderVendor = async (id, vendor) => {
    try {
        const res = await ApiClient.put(`/contactLensSaleOrder/vendor/${id}`, { vendor });
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Failed to update vendor",
        };
    }
};

export const createContactLensChallan = async (payload) => {
    try {
        const res = await ApiClient.post("/contactLensSaleOrder/createChallan", payload);
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            message: err?.response?.data?.message || "Creating challan failed",
            details: err?.response?.data?.details || err?.message,
        };
    }
};

export const updateContactLensItemStatus = async (orderId, itemIds, newStatus) => {
    try {
        const res = await ApiClient.patch(`/contactLensSaleOrder/updateItemStatus/${orderId}`, {
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
        const res = await ApiClient.patch(`/contactLensSaleOrder/updateOrderPlacementStatus/${id}`, { isOrderPlaced });
        return res.data;
    } catch (err) {
        return err?.response?.data || { success: false, message: "Failed to update placement status" };
    }
};

export const updateContactLensSaleOrderRefNo = async (id, refNo) => {
    try {
        const res = await ApiClient.patch(`/contactLensSaleOrder/updateRefNo/${id}`, { refNo });
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            message: err?.response?.data?.message || "Failed to update ref no",
        };
    }
};

export const updateContactLensItemRemark = async (orderId, itemId, remark) => {
    try {
        const res = await ApiClient.patch(`/contactLensSaleOrder/updateItemRemark/${orderId}`, {
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
