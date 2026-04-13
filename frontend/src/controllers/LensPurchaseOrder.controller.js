import ApiClient from "../ApiClient";

export const addLensPurchaseOrder = async (data) => {
  try {
    const res = await ApiClient.post("/lensPurchaseOrder/createLensPurchaseOrder", data);
    return res.data;
  } catch (err) {
    console.error("addLensPurchaseOrder error:", err);
    return err?.response?.data || {
      success: false,
      message: err.message || "Network Error or Server not reachable",
    };
  }
};

export const getAllLensPurchaseOrder = async () => {
  try {
    const res = await ApiClient.get("/lensPurchaseOrder/getAllLensPurchaseOrder");
    return res.data;
  } catch (err) {
    console.error("getAllLensPurchaseOrder error:", err);
    return err?.response?.data || {
      success: false,
      message: err.message || "Failed to fetch orders",
    };
  }
};

export const getLensPurchaseOrder = async (id) => {
  try {
    const res = await ApiClient.post("/lensPurchaseOrder/getLensPurchaseOrder", { id });
    return { success: true, data: res.data, status: res.status };
  } catch (err) {
    console.error("getLensPurchaseOrder error:", err);
    const message = err?.response?.data?.message || err?.message || "Error";
    const status = err?.response?.status;
    return { success: false, error: message, status };
  }
};

export const editLensPurchaseOrder = async (id, data) => {
  try {
    const res = await ApiClient.put(`/lensPurchaseOrder/editLensPurchaseOrder/${id}`, data);
    return res.data;
  } catch (err) {
    console.error("editLensPurchaseOrder error:", err);
    return {
      success: false,
      error: err?.response?.data?.message || err.message || "Failed to update",
      status: err?.response?.status,
    };
  }
};

export const removeLensPurchaseOrder = async (id) => {
  try {
    const res = await ApiClient.delete(`/lensPurchaseOrder/deleteLensPurchaseOrder/${id}`);
    return { success: true, data: res.data };
  } catch (err) {
    console.error("removeLensPurchaseOrder error:", err);
    return {
      success: false,
      error: err?.response?.data?.message || err.message || "Delete failed",
    };
  }
};

export const createLensInvoice = async (data) => {
  try {
    const res = await ApiClient.post('/lensPurchaseOrder/createLensInvoice', data)
    return { success: true, data: res.data };
  }
  catch (err) {
    console.error("createLensInvoice error:", err);
    return {
      success: false,
      error: err?.response?.data?.message || err.message || "Creating invoice failed",
    };
  }
}

export const createLensChallan = async (data) => {
  try {
    const res = await ApiClient.post('/lensPurchaseOrder/createLensChallan', data);
    return { success: true, data: res.data };
  }
  catch (err) {
    console.error("createLensChallan error:", err);
    return {
      success: false,
      error: err?.response?.data?.message || err.message || "Creating challan failed",
    };
  }
}

export const getNextBillNumberForPurchaseOrder = async (partyName) => {
  try {
    const res = await ApiClient.get("/lensPurchaseOrder/getAllLensPurchaseOrder");

    let orderData = [];
    if (res?.data && Array.isArray(res.data)) {
      orderData = res.data;
    } else if (res?.data?.data && Array.isArray(res.data.data)) {
      orderData = res.data.data;
    } else if (Array.isArray(res)) {
      orderData = res;
    }

    if (!Array.isArray(orderData) || orderData.length === 0) {
      return 1;
    }

    // Since the database has a unique index on billNo (globally), 
    // we should return a global increment to avoid E11000 errors.
    const globalCount = orderData.length;
    return globalCount + 1;
  } catch (err) {
    console.error("Error getting next bill number:", err);
    return 1;
  }
};

export const updatePurchaseOrderStatus = async (id, status, cancelReason) => {
  try {
    const res = await ApiClient.patch(`/lensPurchaseOrder/updateStatus/${id}`, { status, cancelReason });
    return { success: true, data: res.data };
  } catch (err) {
    console.error("updatePurchaseOrderStatus error:", err);
    return {
      success: false,
      error: err?.response?.data?.message || err.message || "Failed to update status",
    };
  }
};

export const updatePurchaseOrderCancelReason = async (id, cancelReason) => {
  try {
    const res = await ApiClient.patch(`/lensPurchaseOrder/updateCancelReason/${id}`, { cancelReason });
    return { success: true, data: res.data };
  } catch (err) {
    console.error("updatePurchaseOrderCancelReason error:", err);
    return {
      success: false,
      error: err?.response?.data?.message || err.message || "Failed to update cancel reason",
    };
  }
};

export const updateOrderQuantities = async (id, quantities) => {
  try {
    const res = await ApiClient.patch(`/lensPurchaseOrder/updateQuantities/${id}`, quantities);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update quantities",
    };
  }
};

export const updatePurchaseItemStatus = async (data) => {
  try {
    const res = await ApiClient.post('/lensPurchaseOrder/updateItemStatus', data);
    return { success: true, data: res.data };
  } catch (err) {
    console.error("updatePurchaseItemStatus error:", err);
    return {
      success: false,
      error: err?.response?.data?.message || err.message || "Failed to update item status",
    };
  }
};

export const updateItemQty = async (data) => {
  try {
    const res = await ApiClient.patch("/lensPurchaseOrder/updateItemQty", data);
    return { success: true, data: res.data };
  } catch (err) {
    console.error("updateItemQty error:", err);
    return {
      success: false,
      error: err?.response?.data?.message || err.message || "Failed to update item quantity",
    };
  }
};

export const updatePurchaseOrderItemsQty = async (data) => {
  try {
    const res = await ApiClient.patch("/lensPurchaseOrder/updateOrderItemsQty", data);
    return { success: true, data: res.data };
  } catch (err) {
    console.error("updatePurchaseOrderItemsQty error:", err);
    return {
      success: false,
      error: err?.response?.data?.message || err.message || "Failed to update quantities",
    };
  }
};