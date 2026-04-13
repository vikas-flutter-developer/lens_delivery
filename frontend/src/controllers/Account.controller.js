import ApiClient from "../ApiClient.js";

export const addAccount = async (AccountData) => {
  try {
    const res = await ApiClient.post('/accounts/add-account', AccountData);
    return res.data;
  }
  catch (error) {
    throw error;
  }
}

export const getNextAccountId = async () => {
  try {
    const res = await ApiClient.get('/accounts/next-id');
    return res.data;
  } catch (err) {
    return err.response?.data || { success: false, message: "Server error" };
  }
};

export const getAllAccounts = async (type) => {
  try {
    const res = await ApiClient.get('/accounts/getallaccounts', {
      params: type ? { type } : {}
    });
    return res.data;
  }
  catch (err) {
    throw err;
  }
}

export const getAccountById = async (id) => {
  try {
    const res = await ApiClient.get(`/accounts/get/${id}`);
    return res.data;
  } catch (err) {
    return err.response?.data || { success: false, message: "Server error" };
  }
};

export const updateAccount = async (id, accountData) => {
  try {
    const res = await ApiClient.put(`/accounts/update/${id}`, accountData);
    return res.data;
  } catch (err) {
    return err.response?.data || { success: false, message: "Server error" };
  }
};

export const deleteAccount = async (id) => {
  try {
    const res = await ApiClient.delete(`/accounts/delete/${id}`);
    return res.data;
  }
  catch (err) {
    return err.response?.data || { success: false, message: "Server error" };
  }
}

export const patchAccount = async (id, accountData) => {
  try {
    const res = await ApiClient.patch(`/accounts/patch/${id}`, accountData);
    return res.data;
  } catch (err) {
    return err.response?.data || { success: false, message: "Server error" };
  }
};