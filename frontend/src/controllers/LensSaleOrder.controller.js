import ApiClient from "../ApiClient";
console.log("LensSaleOrder controller loaded");

export const getNextBillNumberForLensSaleOrder = async (partyName) => {
  try {
    console.log("Fetching bill number for party:", partyName);
    const res = await ApiClient.post("/lensSaleOrder/getNextBillNumber", { partyName });
    if (res?.data && typeof res.data.nextBillNumber === 'number') {
      console.log(`Party "${partyName}" found ${res.data.count} times, next bill number: ${res.data.nextBillNumber}`);
      return res.data.nextBillNumber;
    }
    return 1;
  } catch (err) {
    console.log("Error getting next bill number:", err);
    return 1;
  }
};

export const addLensSaleOrder = async (data) => {
  try {
    const res = await ApiClient.post("/lensSaleOrder/createLensSaleOrder", data);
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getAllLensSaleOrder = async () => {
  try {
    const res = await ApiClient.get("/lensSaleOrder/getAllLensSaleOrder");
    return res.data || { success: false, data: [] };
  } catch (err) {
    console.log(err);
    return { success: false, data: [] };
  }
};

export const getLensSaleOrder = async (id) => {
  try {
    const res = await ApiClient.post("/lensSaleOrder/getLensSaleOrder", { id });
    return { success: true, data: res.data, status: res.status };
  } catch (err) {
    const message = err?.response?.data?.message || err?.message || "Error";
    const status = err?.response?.status;
    return { success: false, error: message, status };
  }
};

export const editLensSaleOrder = async (id, data) => {
  try {
    console.log('🔄 Editing sale order:', id);
    const res = await ApiClient.put(`/lensSaleOrder/editLensSaleOrder/${id}`, data);
    console.log('✅ Sale order edited successfully');
    return res.data;
  } catch (err) {
    const errorMsg = err?.response?.data?.message || "Failed to update";
    const errorDetails = err?.response?.data?.error || err?.message;

    console.error('❌ Edit Sale Order Error:', {
      status: err?.response?.status,
      message: errorMsg,
      details: errorDetails,
      fullResponse: err?.response?.data
    });

    return {
      success: false,
      error: errorMsg,
      details: errorDetails,
      status: err?.response?.status,
    };
  }
};


export const removeLensSaleOrder = async (id) => {
  try {
    const res = await ApiClient.delete(`/lensSaleOrder/deleteLensSaleOrder/${id}`);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Delete failed",
    };
  }
};

export const createLensInvoice = async (data) => {
  try {
    const res = await ApiClient.post('/lensSaleOrder/createLensInvoice', data)
    return { success: true, data: res.data };
  }
  catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Creating invoice failed",
    };
  }
}

export const createLensChallan = async (data) => {
  try {
    // Log the payload for debugging
    console.log('Creating Challan with payload:', {
      sourceSaleId: data.sourceSaleId,
      items: data.items?.length,
      billData: data.billData,
      partyData: data.partyData,
      taxes: data.taxes?.length,
      fullPayload: data
    });

    const res = await ApiClient.post('/lensSaleOrder/createLensChallan', data)
    return { success: true, data: res.data }
  }
  catch (err) {
    const errorMessage = err?.response?.data?.message || "Creating Sale Challan Failed";
    const errorDetails = err?.response?.data?.error || err?.message;

    console.error('Create Challan Error Details:', {
      status: err?.response?.status,
      message: errorMessage,
      details: errorDetails,
      fullError: err?.response?.data
    });

    return {
      success: false,
      message: errorMessage,
      details: errorDetails
    }
  }
}


export const updateSaleOrderStatus = async (id, status, cancelReason) => {
  try {
    const res = await ApiClient.patch(`/lensSaleOrder/updateStatus/${id}`, { status, cancelReason });
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update status",
    };
  }
};

export const updateSaleOrderCancelReason = async (id, cancelReason) => {
  try {
    const res = await ApiClient.patch(`/lensSaleOrder/updateCancelReason/${id}`, { cancelReason });
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update cancel reason",
    };
  }
};

export const updateSaleOrderBookedBy = async (id, bookedBy) => {
  try {
    const res = await ApiClient.patch(`/lensSaleOrder/updateBookedBy/${id}`, { bookedBy });
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update booked by",
    };
  }
};

export const updateOrderQuantities = async (id, quantities) => {
  try {
    const res = await ApiClient.patch(`/lensSaleOrder/updateQuantities/${id}`, quantities);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update quantities",
    };
  }
};

export const updateSaleOrderVendor = async (id, vendor) => {
  try {
    const res = await ApiClient.patch(`/lensSaleOrder/updateVendor/${id}`, { vendor });
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update vendor",
    };
  }
};

export const updateLensItemStatus = async (orderId, itemIds, newStatus) => {
  try {
    const res = await ApiClient.patch(`/lensSaleOrder/updateItemStatus/${orderId}`, { itemIds, newStatus });
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err?.response?.data?.message || "Failed to update item status" };
  }
};

export const recalculateLensOrderStatus = async (orderId) => {
  try {
    const res = await ApiClient.post(`/lensSaleOrder/recalculateOrderStatus`, { orderId });
    return { success: true, status: res.data.status };
  } catch (err) {
    return { success: false, error: err?.response?.data?.message || "Failed to recalculate" };
  }
};

export const syncOrderAcrossModules = async (orderId) => {
  try {
    const res = await ApiClient.post(`/lensSaleOrder/syncOrderAcrossModules`, { orderId });
    return { success: true };
  } catch (err) {
    return { success: false, error: err?.response?.data?.message || "Failed to sync" };
  }
};

export const updateOrderPlacementStatus = async (id, isOrderPlaced) => {
  try {
    const res = await ApiClient.patch(`/lensSaleOrder/updateOrderPlacementStatus/${id}`, { isOrderPlaced });
    return res.data;
  } catch (err) {
    return err?.response?.data || { success: false, message: "Failed to update placement status" };
  }
};

export const updateSaleOrderRefNo = async (id, refNo) => {
  try {
    const res = await ApiClient.patch(`/lensSaleOrder/updateRefNo/${id}`, { refNo });
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update ref no",
    };
  }
};

export const updateLensItemRemark = async (orderId, itemId, remark) => {
  try {
    const res = await ApiClient.patch(`/lensSaleOrder/updateItemRemark/${orderId}`, {
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