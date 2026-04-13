import ApiClient from "../ApiClient";

export const editLensRate = async (data) => {
  try {
    const res = await ApiClient.put('/lensRate/editLensRate', data)
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.response?.data || err.message };
  }
}

export const syncAllLenses = async () => {
  try {
    const res = await ApiClient.post('/lensRate/syncAll');
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.response?.data || err.message };
  }
};