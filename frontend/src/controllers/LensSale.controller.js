import ApiClient from "../ApiClient";

export const addLensSale = async (data) => {
  try {
    const res = await ApiClient.post("/lensSale/createLensSale", data);
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getAllLensSale = async () => {
  try {
    const res = await ApiClient.get("/lensSale/getAllLensSale");
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getLensSale = async (id) => {
  try {
    const res = await ApiClient.post("/lensSale/getLensSale", { id });
    return { success: true, data: res.data, status: res.status };
  } catch (err) {
    const message = err?.response?.data?.message || err?.message || "Error";
    const status = err?.response?.status;
    return { success: false, error: message, status };
  }
};

export const editLensSale = async (id, data) => {
  try {
    const res = await ApiClient.put(`/lensSale/editLensSale/${id}`, data);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update",
      status: err?.response?.status,
    };
  }
};


export const removeLensSale = async (id) => {
  try {
    const res = await ApiClient.delete(`/lensSale/deleteLensSale/${id}`);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Delete failed",
    };
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


export const getAllLensSaleReturn = async () => {
  try {
    const res = await ApiClient.get("/lensSaleReturn/getAllLensSaleReturn");
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getNextBillNumberForParty = async (partyName) => {
  try {
    const res = await ApiClient.get("/lensSale/getAllLensSale");

    // The response from getAllLensSale returns res.data which is { success: true, data: [...] }
    // So we need to access res.data.data to get the actual array
    let salesData = [];

    if (res?.data && Array.isArray(res.data)) {
      // Direct array response
      salesData = res.data;
    } else if (res?.data?.data && Array.isArray(res.data.data)) {
      // Nested structure: { success: true, data: [...] }
      salesData = res.data.data;
    } else if (Array.isArray(res)) {
      // Direct array
      salesData = res;
    }

    if (!Array.isArray(salesData) || salesData.length === 0) {
      console.log("No sales data found, returning bill number 1");
      return 1;
    }

    // Count how many times this party appears in the invoices
    const partyCount = salesData.filter(
      (sale) =>
        (sale.partyData?.partyAccount || "").toLowerCase() === partyName.toLowerCase()
    ).length;

    console.log(`Party "${partyName}" found ${partyCount} times, next bill number: ${partyCount + 1}`);

    // The next bill number is count + 1
    return partyCount + 1;
  } catch (err) {
    console.log("Error getting next bill number:", err);
    return 1; // default to 1 if error
  }
};

export const updateSaleInvoiceStatus = async (id, status) => {
  try {
    const res = await ApiClient.patch(`/lensSale/updateStatus/${id}`, { status });
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update status",
    };
  }
};

export const updateLensInvoiceItemStatus = async (invoiceId, itemIds, newStatus) => {
  try {
    const res = await ApiClient.patch(`/lensSale/updateItemStatus/${invoiceId}`, { itemIds, newStatus });
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err?.response?.data?.message || "Failed to update item status" };
  }
};

export const updateLensSaleItemRemark = async (invoiceId, itemId, remark) => {
  try {
    const res = await ApiClient.patch(`/lensSale/updateItemRemark/${invoiceId}`, {
      itemId,
      remark,
    });
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update item remark",
    };
  }
};

export const updateDeliveryPerson = async (id, deliveryPerson) => {
  try {
    const res = await ApiClient.patch(`/lensSale/updateDeliveryPerson/${id}`, { deliveryPerson });
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update delivery person",
    };
  }
};