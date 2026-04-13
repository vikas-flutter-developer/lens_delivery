import ApiClient from "../ApiClient";

export const addLensSaleReturn = async (data) => {
  try {
    const res = await ApiClient.post("/SaleReturn/createLensSaleReturn", data);
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getAllLensSaleReturn = async () => {
  try {
    const res = await ApiClient.get("/SaleReturn/getAllLensSaleReturn");
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getLensSaleReturn = async (id) => {
  try {
    const res = await ApiClient.post("/SaleReturn/getLensSaleReturn", { id });
    return { success: true, data: res.data, status: res.status };
  } catch (err) {
    const message = err?.response?.data?.message || err?.message || "Error";
    const status = err?.response?.status;
    return { success: false, error: message, status };
  }
};

export const editLensSaleReturn = async (id, data) => {
  try {
    const res = await ApiClient.put(`/SaleReturn/editLensSaleReturn/${id}`, data);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update",
      status: err?.response?.status,
    };
  }
};


export const removeLensSaleReturn = async (id) => {
  try {
    const res = await ApiClient.delete(`/SaleReturn/deleteLensSaleReturn/${id}`);
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
    const res = await ApiClient.post("/SaleReturn/getNextBillNumber", { partyName });
    return res.data.nextBillNumber || 1;
  } catch (err) {
    console.log("Error getting next bill number:", err);
    return 1;
  }
};

export const updateReturnQuantities = async (id, quantities) => {
  try {
    const res = await ApiClient.patch(`/SaleReturn/updateReturnQuantities/${id}`, quantities);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update quantities",
    };
  }
};