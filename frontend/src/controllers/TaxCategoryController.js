import ApiClient from "../ApiClient";
export const addTaxCategory = async (data) => {
  try {
    const res = await ApiClient.post("/tax/add-taxCategory", data);
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.response?.data || err.message };
  }
};
export const getAllTaxCategories = async () => {
  try {
    const res = await ApiClient.get("/tax/getAllTaxCategories");
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.response?.data || err.message };
  }
};

export const getTaxCategoryById = async (id) => {
  try {
    const res = await ApiClient.get("/tax/getTaxCategoryById", {
      params: { id },
    });
    return { success: true, data: res.data.data, status: res.status };
  } catch (err) {
    const status = err.response?.status;
    const message =
      err.response?.data?.message || err.message || "Unknown error";
    return { success: false, error: { message, status } };
  }
};

export const editTaxCategory = async (id, payload) => {
  try {
    const res = await ApiClient.put("/tax/edit-taxCategory", {
      id,
      payload,
    });

    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.response?.data || err.message };
  }
};

export const deleteTaxCategory = async (id) => {
  try {
    const res = await ApiClient.delete("/tax/deleteTaxCategory", {
      data: { id }
    });
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.response?.data || err.message };
  }
};

