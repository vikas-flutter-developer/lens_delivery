import ApiClient from "../ApiClient";

export const getAllVendors = async () => {
  try {
    const res = await ApiClient.get("/rxPurchase/getAllVendors")
    return res.data;
  }
  catch (err) {
    console.log(err);
    return err?.response?.data;
  }
}

export const addRxPurchase = async (data) => {
  try {
    const res = await ApiClient.post("/rxPurchase/createRxPurchase", data);
    console.log(data)
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getAllRxPurchase = async () => {
  try {
    const res = await ApiClient.get("/rxPurchase/getAllRxPurchase");
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getRxPurchase = async (id) => {
  try {
    const res = await ApiClient.post("/rxPurchase/getRxPurchase", { id });
    return { success: true, data: res.data, status: res.status };
  } catch (err) {
    const message = err?.response?.data?.message || err?.message || "Error";
    const status = err?.response?.status;
    return { success: false, error: message, status };
  }
};

export const editRxPurchase = async (id, data) => {
  try {
    const res = await ApiClient.put(`/rxPurchase/editRxPurchase/${id}`, data);
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


export const removeRxPurchase = async (id) => {
  try {
    const res = await ApiClient.delete(`/rxPurchase/deleteRxPurchase/${id}`);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Delete failed",
    };
  }
};

export const getNextBillNumberForRxPurchase = async (partyName) => {
  try {
    const res = await ApiClient.post("/rxPurchase/getNextBillNumber", { partyName });
    return res.data.nextBillNumber || 1;
  } catch (err) {
    console.log("Error getting next bill number:", err);
    return 1;
  }
};

export const updateRxPurchaseDcId = async (id, dcId) => {
  try {
    const res = await ApiClient.patch(`/rxPurchase/patchDcId/${id}`, { dcId });
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Update failed",
    };
  }
};
