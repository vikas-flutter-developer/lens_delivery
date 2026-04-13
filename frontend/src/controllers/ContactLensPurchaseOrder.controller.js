import ApiClient from "../ApiClient";

export const getAllContactLensPurchaseOrder = async () => {
    try {
        const res = await ApiClient.get("/contactLensPurchaseOrder/getall");
        return res.data || { success: false, data: [] };
    } catch (err) {
        console.log(err);
        return { success: false, data: [] };
    }
};

export const removeContactLensPurchaseOrder = async (id) => {
    try {
        const res = await ApiClient.delete(`/contactLensPurchaseOrder/delete/${id}`);
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Delete failed",
        };
    }
};

export const updateContactLensPurchaseOrderStatus = async (id, status, cancelReason) => {
    try {
        const res = await ApiClient.put(`/contactLensPurchaseOrder/status/${id}`, { status, cancelReason });
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Failed to update status",
        };
    }
};

export const updateContactLensPurchaseOrderCancelReason = async (id, cancelReason) => {
    try {
        const res = await ApiClient.put(`/contactLensPurchaseOrder/cancelReason/${id}`, { cancelReason });
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Failed to update cancel reason",
        };
    }
};

export const updateContactLensPurchaseOrderBookedBy = async (id, bookedBy) => {
    try {
        const res = await ApiClient.put(`/contactLensPurchaseOrder/bookedby/${id}`, { bookedBy });
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Failed to update booked by",
        };
    }
};

export const addContactLensPurchaseOrder = async (payload) => {
    try {
        const res = await ApiClient.post("/contactLensPurchaseOrder/add", payload);
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Add failed",
        };
    }
};

export const getContactLensPurchaseOrder = async (id) => {
    try {
        const res = await ApiClient.get(`/contactLensPurchaseOrder/get/${id}`);
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Fetch failed",
        };
    }
};

export const editContactLensPurchaseOrder = async (id, payload) => {
    try {
        const res = await ApiClient.put(`/contactLensPurchaseOrder/edit/${id}`, payload);
        return res.data;
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Edit failed",
        };
    }
};

export const getNextBillNumberForContactLensPurchaseOrder = async (partyAccount) => {
    try {
        const res = await ApiClient.get(`/contactLensPurchaseOrder/nextBillNo/${partyAccount}`);
        return res.data.nextBillNo;
    } catch (err) {
        console.error("Error fetching next bill number:", err);
        return 1;
    }
};

export const getNextPurchaseChallanBillNo = async () => {
    try {
        const res = await ApiClient.get("/contactLensPurchaseOrder/nextChallanBillNo");
        return res.data.nextBillNo;
    } catch (err) {
        console.error("Error fetching next challan bill number:", err);
        return 1;
    }
};

export const updateContactLensPurchaseOrderVendor = async (id, vendor) => {
    try {
        const res = await ApiClient.put(`/contactLensPurchaseOrder/vendor/${id}`, { vendor });
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Failed to update vendor",
        };
    }
};

export const createContactLensPurchaseChallan = async (data) => {
    try {
        const res = await ApiClient.post("/contactLensPurchaseOrder/createChallan", data);
        return { success: true, data: res.data };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message || "Creating challan failed",
        };
    }
};
