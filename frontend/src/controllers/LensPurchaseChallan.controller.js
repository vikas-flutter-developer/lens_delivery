import ApiClient from "../ApiClient";

export const addLensPurchaseChallan = async (data) => {
  try {
    const res = await ApiClient.post("/lensPurchaseChallan/createLensPurchaseChallan", data);
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getAllLensPurchaseChallan = async () => {
  try {
    const res = await ApiClient.get("/lensPurchaseChallan/getAllLensPurchaseChallan");
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getLensPurchaseChallan = async (id) => {
  try {
    const res = await ApiClient.post("/lensPurchaseChallan/getLensPurchaseChallan", { id });
    return { success: true, data: res.data, status: res.status };
  } catch (err) {
    const message = err?.response?.data?.message || err?.message || "Error";
    const status = err?.response?.status;
    return { success: false, error: message, status };
  }
};

export const editLensPurchaseChallan = async (id, data) => {
  try {
    const res = await ApiClient.put(`/lensPurchaseChallan/editLensPurchaseChallan/${id}`, data);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update",
      status: err?.response?.status,
    };
  }
};


export const removeLensPurchaseChallan = async (id) => {
  try {
    const res = await ApiClient.delete(`/lensPurchaseChallan/deleteLensPurchaseChallan/${id}`);
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
    const res = await ApiClient.post('/lensPurchaseChallan/createLensInvoice', data)
    return { success: true, data: res.data };
  }
  catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Creating invoice failed",
    };
  }
}

export const createChallanFromInvoice = async (data) => {
  try {
    const res = await ApiClient.post('/lensPurchaseChallan/createChallanFromInvoice', data);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to create challan from invoice",
    };
  }
};

export const getNextBillNumberForPurchaseChallan = async (partyName) => {
  try {
    const res = await ApiClient.get("/lensPurchaseChallan/getAllLensPurchaseChallan");

    // Handle nested structure
    let challanData = [];

    if (res?.data && Array.isArray(res.data)) {
      challanData = res.data;
    } else if (res?.data?.data && Array.isArray(res.data.data)) {
      challanData = res.data.data;
    } else if (Array.isArray(res)) {
      challanData = res;
    }

    if (!Array.isArray(challanData) || challanData.length === 0) {
      console.log("No purchase challan data found, returning bill number 1");
      return 1;
    }

    const partyCount = challanData.filter(
      (challan) =>
        (challan.partyData?.partyAccount || "").toLowerCase() === partyName.toLowerCase()
    ).length;

    console.log(`Party "${partyName}" found ${partyCount} times, next bill number: ${partyCount + 1}`);

    return partyCount + 1;
  } catch (err) {
    console.log("Error getting next bill number:", err);
    return 1;
  }
};

export const updatePurchaseChallanStatus = async (id, status, cancelReason) => {
  try {
    const res = await ApiClient.patch(`/lensPurchaseChallan/updateStatus/${id}`, { status, cancelReason });
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update status",
    };
  }
};

export const updatePurchaseChallanCancelReason = async (id, cancelReason) => {
  try {
    const res = await ApiClient.patch(`/lensPurchaseChallan/updateCancelReason/${id}`, { cancelReason });
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update cancel reason",
    };
  }
};

export const updatePurchaseChallanItemStatus = async (data) => {
  try {
    const res = await ApiClient.post('/lensPurchaseChallan/updateItemStatus', data);
    return { success: true, data: res.data };
  } catch (err) {
    console.error("updatePurchaseChallanItemStatus error:", err);
    return {
      success: false,
      error: err?.response?.data?.message || err.message || "Failed to update item status",
    };
  }
};

export const updatePurchaseChallanDcId = async (id, dcId) => {
  try {
    const res = await ApiClient.patch(`/lensPurchaseChallan/patchDcId/${id}`, { dcId });
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update DC ID",
    };
  }
};
