import ApiClient from "../ApiClient";

export const addRxPurchaseReturn = async (data) => {
  try {
    const res = await ApiClient.post("/rxPurchaseReturn/createRxPurchaseReturn", data);
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getAllRxPurchaseReturn = async () => {
  try {
    const res = await ApiClient.get("/rxPurchaseReturn/getAllRxPurchaseReturn");
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getRxPurchaseReturn = async (id) => {
  try {
    const res = await ApiClient.post("/rxPurchaseReturn/getRxPurchaseReturn", { id });
    return { success: true, data: res.data, status: res.status };
  } catch (err) {
    const message = err?.response?.data?.message || err?.message || "Error";
    const status = err?.response?.status;
    return { success: false, error: message, status };
  }
};

export const editRxPurchaseReturn = async (id, data) => {
  try {
    const res = await ApiClient.put(`/rxPurchaseReturn/editRxPurchaseReturn/${id}`, data);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update",
      status: err?.response?.status,
    };
  }
};


export const removeRxPurchaseReturn = async (id) => {
  try {
    const res = await ApiClient.delete(`/rxPurchaseReturn/deleteRxPurchaseReturn/${id}`);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Delete failed",
    };
  }
};
export const getNextBillNumberForParty = async (partyName) => {
  try {
    const res = await ApiClient.post("/rxPurchaseReturn/getNextBillNumber", { partyName });
    return res.data.nextBillNumber || 1;
  } catch (err) {
    console.log("Error getting next bill number:", err);
    return 1;
  }
};
export const updateRxPurchaseReturnFields = async (id, data) => {
  try {
    const res = await ApiClient.patch(`/rxPurchaseReturn/updateRxPurchaseReturnFields/${id}`, data);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update",
    };
  }
};
