import ApiClient from "../ApiClient";

export const addLensSaleChallan = async (data) => {
  try {
    const res = await ApiClient.post("/lensSaleChallan/createLensSaleChallan", data);
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getAllLensSaleChallan = async () => {
  try {
    const res = await ApiClient.get("/lensSaleChallan/getAllLensSaleChallan");
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getLensSaleChallan = async (id) => {
  try {
    const res = await ApiClient.post("/lensSaleChallan/getLensSaleChallan", { id });
    return { success: true, data: res.data, status: res.status };
  } catch (err) {
    const message = err?.response?.data?.message || err?.message || "Error";
    const status = err?.response?.status;
    return { success: false, error: message, status };
  }
};

export const editLensSaleChallan = async (id, data) => {
  try {
    const res = await ApiClient.put(`/lensSaleChallan/editLensSaleChallan/${id}`, data);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update",
      status: err?.response?.status,
    };
  }
};


export const removeLensSaleChallan = async (id) => {
  try {
    const res = await ApiClient.delete(`/lensSaleChallan/deleteLensSaleChallan/${id}`);
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
    const res = await ApiClient.post('/lensSaleChallan/createLensInvoice', data)
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
    const res = await ApiClient.post("/lensSaleChallan/createLensSaleChallan", data);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Creating challan from invoice failed",
    };
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
}
export const getAllLensSaleOrder = async () => {
  try {
    const res = await ApiClient.get("/lensSaleOrder/getAllLensSaleOrder");
    return res.data || { success: false, data: [] };
  } catch (err) {
    console.log(err);
    return { success: false, data: [] };
  }
};

export const getNextBillNumberForSaleChallan = async (partyName) => {
  try {
    const res = await ApiClient.get("/lensSaleChallan/getAllLensSaleChallan");

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
      console.log("No challan data found, returning bill number 1");
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

export const updateSaleChallanStatus = async (id, status, cancelReason) => {
  try {
    const res = await ApiClient.patch(`/lensSaleChallan/updateStatus/${id}`, { status, cancelReason });
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update status",
    };
  }
};

export const updateSaleChallanCancelReason = async (id, cancelReason) => {
  try {
    const res = await ApiClient.patch(`/lensSaleChallan/updateCancelReason/${id}`, { cancelReason });
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update cancel reason",
    };
  }
};

export const updateDeliveryPerson = async (id, deliveryPerson) => {
  try {
    const res = await ApiClient.patch(`/lensSaleChallan/updateDeliveryPerson/${id}`, { deliveryPerson });
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to update delivery person",
    };
  }
};

export const updateLensChallanItemStatus = async (challanId, itemIds, newStatus) => {
  try {
    const res = await ApiClient.patch(`/lensSaleChallan/updateItemStatus/${challanId}`, { itemIds, newStatus });
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err?.response?.data?.message || "Failed to update item status" };
  }
};

export const sendManualWhatsAppReminder = async (challanId) => {
  try {
    const res = await ApiClient.post(`/lensSaleChallan/sendWhatsAppReminder/${challanId}`);
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to send WhatsApp reminder",
    };
  }
};

export const updateLensChallanItemRemark = async (challanId, itemId, remark) => {
  try {
    const res = await ApiClient.patch(`/lensSaleChallan/updateItemRemark/${challanId}`, {
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
