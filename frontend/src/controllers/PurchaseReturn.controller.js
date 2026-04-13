import ApiClient from "../ApiClient";

export const addLensPurchaseReturn = async (data) => {
  try {
    const res = await ApiClient.post("/PurchaseReturn/createLensPurchaseReturn", data);
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getAllLensPurchaseReturn = async () => {
  try {
    const res = await ApiClient.get("/PurchaseReturn/getAllLensPurchaseReturn");
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getLensPurchaseReturn = async (id) => {
  try {
    const res = await ApiClient.post("/PurchaseReturn/getLensPurchaseReturn", { id });
    return { success: true, data: res.data, status: res.status };
  } catch (err) {
    const message = err?.response?.data?.message || err?.message || "Error";
    const status = err?.response?.status;
    return { success: false, error: message, status };
  }
};

export const editLensPurchaseReturn = async (id, data) => {
  try {
    const res = await ApiClient.put(`/PurchaseReturn/editLensPurchaseReturn/${id}`, data);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update",
      status: err?.response?.status,
    };
  }
};


export const removeLensPurchaseReturn = async (id) => {
  try {
    const res = await ApiClient.delete(`/PurchaseReturn/deleteLensPurchaseReturn/${id}`);
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
    const res = await ApiClient.post("/PurchaseReturn/getNextBillNumber", { partyName });
    return res.data.nextBillNumber || 1;
  } catch (err) {
    console.log("Error getting next bill number:", err);
    return 1;
  }
};

export const updateReturnQuantities = async (id, quantities) => {
  try {
    const res = await ApiClient.patch(`/PurchaseReturn/updateReturnQuantities/${id}`, quantities);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update quantities",
    };
  }
};