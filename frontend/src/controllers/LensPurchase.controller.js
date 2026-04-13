import ApiClient from "../ApiClient";

export const addLensPurchase = async (data) => {
  try {
    const res = await ApiClient.post("/lensPurchase/createLensPurchase", data);
    console.log(data)
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getAllLensPurchase = async () => {
  try {
    const res = await ApiClient.get("/lensPurchase/getAllLensPurchase");
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getLensPurchase = async (id) => {
  try {
    const res = await ApiClient.post("/lensPurchase/getLensPurchase", { id });
    return { success: true, data: res.data, status: res.status };
  } catch (err) {
    const message = err?.response?.data?.message || err?.message || "Error";
    const status = err?.response?.status;
    return { success: false, error: message, status };
  }
};

export const editLensPurchase = async (id, data) => {
  try {
    const res = await ApiClient.put(`/lensPurchase/editLensPurchase/${id}`, data);
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


export const removeLensPurchase = async (id) => {
  try {
    const res = await ApiClient.delete(`/lensPurchase/deleteLensPurchase/${id}`);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Delete failed",
    };
  }
};

export const getNextBillNumberForPurchase = async (partyName) => {
  try {
    const res = await ApiClient.get("/lensPurchase/getAllLensPurchase");

    // Handle nested structure
    let purchaseData = [];

    if (res?.data && Array.isArray(res.data)) {
      purchaseData = res.data;
    } else if (res?.data?.data && Array.isArray(res.data.data)) {
      purchaseData = res.data.data;
    } else if (Array.isArray(res)) {
      purchaseData = res;
    }

    if (!Array.isArray(purchaseData) || purchaseData.length === 0) {
      console.log("No purchase data found, returning bill number 1");
      return 1;
    }

    const partyCount = purchaseData.filter(
      (purchase) =>
        (purchase.partyData?.partyAccount || "").toLowerCase() === partyName.toLowerCase()
    ).length;

    console.log(`Party "${partyName}" found ${partyCount} times, next bill number: ${partyCount + 1}`);

    return partyCount + 1;
  } catch (err) {
    console.log("Error getting next bill number:", err);
    return 1;
  }
};

export const updateLensPurchaseDcId = async (id, dcId) => {
  try {
    const res = await ApiClient.patch(`/lensPurchase/patchDcId/${id}`, { dcId });
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update DC ID",
    };
  }
};
