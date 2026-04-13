import ApiClient from "../ApiClient";

export const getAllVendors = async () => {
  try {
    const res = await ApiClient.get("/rxSale/getAllVendors")
    return res.data;
  }
  catch (err) {
    console.log(err);
    return err?.response?.data;
  }
}

export const addRxSale = async (data) => {
  try {
    const res = await ApiClient.post("/rxSale/createRxSale", data);
    console.log(data)
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getAllRxSale = async () => {
  try {
    const res = await ApiClient.get("/rxSale/getAllRxSale");
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getRxSale = async (id) => {
  try {
    const res = await ApiClient.post("/rxSale/getRxSale", { id });
    return { success: true, data: res.data, status: res.status };
  } catch (err) {
    const message = err?.response?.data?.message || err?.message || "Error";
    const status = err?.response?.status;
    return { success: false, error: message, status };
  }
};

export const editRxSale = async (id, data) => {
  try {
    const res = await ApiClient.put(`/rxSale/editRxSale/${id}`, data);
    console.log(data)
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update",
      status: err?.response?.status,
    };
  }
};


export const removeRxSale = async (id) => {
  try {
    const res = await ApiClient.delete(`/rxSale/deleteRxSale/${id}`);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Delete failed",
    };
  }
};

export const updateRxSaleStatus = async (id, status) => {
  try {
    const res = await ApiClient.patch(`/rxSale/updateStatus/${id}`, { status });
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update status",
    };
  }
};

export const getNextBillNumberForRxSale = async (partyName) => {
  try {
    const res = await ApiClient.post("/rxSale/getNextBillNumber", { partyName });
    return res.data.nextBillNumber || 1;
  } catch (err) {
    console.log("Error getting next bill number:", err);
    return 1;
  }
};

export const updateRxSaleItemRemark = async (invoiceId, itemId, remark) => {
  try {
    const res = await ApiClient.patch(`/rxSale/updateItemRemark/${invoiceId}`, {
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

export const updateRxDeliveryPerson = async (id, deliveryPerson) => {
  try {
    const res = await ApiClient.patch(`/rxSale/updateDeliveryPerson/${id}`, { deliveryPerson });
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update delivery person",
    };
  }
};
