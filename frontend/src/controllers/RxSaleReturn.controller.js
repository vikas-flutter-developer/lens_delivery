import ApiClient from "../ApiClient";

export const addRxSaleReturn = async (data) => {
  try {
    const res = await ApiClient.post("/rxSaleReturn/createRxSaleReturn", data);
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getAllRxSaleReturn = async () => {
  try {
    const res = await ApiClient.get("/rxSaleReturn/getAllRxSaleReturn");
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getRxSaleReturn = async (id) => {
  try {
    const res = await ApiClient.post("/rxSaleReturn/getRxSaleReturn", { id });
    return { success: true, data: res.data, status: res.status };
  } catch (err) {
    const message = err?.response?.data?.message || err?.message || "Error";
    const status = err?.response?.status;
    return { success: false, error: message, status };
  }
};

export const editRxSaleReturn = async (id, data) => {
  try {
    const res = await ApiClient.put(`/rxSaleReturn/editRxSaleReturn/${id}`, data);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update",
      status: err?.response?.status,
    };
  }
};


export const removeRxSaleReturn = async (id) => {
  try {
    const res = await ApiClient.delete(`/rxSaleReturn/deleteRxSaleReturn/${id}`);
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
    const res = await ApiClient.post("/rxSaleReturn/getNextBillNumber", { partyName });
    return res.data.nextBillNumber || 1;
  } catch (err) {
    console.log("Error getting next bill number:", err);
    return 1;
  }
};
