import ApiClient from "../ApiClient";

export const addLenspower = async (data) => {
  try {
    console.log(data)
    const res = await ApiClient.post('/lens/createLensPower', data);
    return res.data;
  } catch (err) {
    console.log(err);
    return err?.response?.data;
  }
};

export const getAllLensPower = async () => {
  try {
    const res = await ApiClient.get('/lens/getAllLensPower')
    return res.data
  }
  catch (err) {
    console.log(err)
    return err?.response?.data;
  }
}

export const getLensPower = async (data) => {
  try {
    const res = await ApiClient.post('/lens/getLensPower', data);
    return { success: true, data: res.data, status: res.status };
  } catch (err) {
    const message = err?.response?.data?.message || err?.message || "Error";
    const status = err?.response?.status;
    return { success: false, error: message, status };
  }
};


export const editLensPower = async (data) => {
  try {
    const res = await ApiClient.put('/lens/editLensPower', data)
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.response?.data || err.message };
  }
}

export const removeLensPower = async (data) => {
  try {
    const res = await ApiClient.delete('/lens/deletelensPower', { data });
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.response?.data || err.message };
  }
};

export const checkBarcodeExists = async (data) => {
  try {
    const res = await ApiClient.post('/lens/checkBarcodeExists', data);
    return res.data;
  } catch (err) {
    return { success: false, error: err.response?.data || err.message };
  }
};

export const generateUniqueBarcode = async (data) => {
  try {
    const res = await ApiClient.post('/lens/generateUniqueBarcode', data);
    return res.data;
  } catch (err) {
    return { success: false, error: err.response?.data || err.message };
  }
};

export const verifyStock = async (data) => {
  try {
    const res = await ApiClient.post('/lens/verifyStock', data);
    return res.data;
  } catch (err) {
    return { success: false, error: err.response?.data || err.message };
  }
};

export const getMissingLenses = async (barcodes) => {
  try {
    const res = await ApiClient.get(`/lens/missing-lenses?barcodes=${barcodes.join(',')}`);
    return res.data;
  } catch (err) {
    return { success: false, error: err.response?.data || err.message };
  }
};

export const getPowerRangeLibrary = async (groupName) => {
  try {
    const url = groupName ? `/lens/power-range-library?groupName=${encodeURIComponent(groupName)}` : '/lens/power-range-library';
    const res = await ApiClient.get(url);
    return res.data;
  } catch (err) {
    return { success: false, error: err.response?.data || err.message };
  }
};

export const getPowerGroupsForProduct = async (productName) => {
  try {
    const res = await ApiClient.get(`/lens/power-groups-for-product?productName=${encodeURIComponent(productName)}`);
    return res.data;
  } catch (err) {
    return { success: false, error: err.response?.data || err.message };
  }
};

export const resetAllLensPriceHighlights = async () => {
    try {
        const res = await ApiClient.post('/lens/resetAllPriceHighlights');
        return res.data;
    } catch (err) {
        return { success: false, error: err.response?.data || err.message };
    }
}

export const updateLensGroupLocations = async (data) => {
    try {
        const res = await ApiClient.post('/lens/update-locations', data);
        return res.data;
    } catch (err) {
        return { success: false, error: err.response?.data || err.message };
    }
};

export const getCombinationStock = async (data) => {
    try {
        const res = await ApiClient.post('/lens/getCombinationStock', data);
        return res.data;
    } catch (err) {
        return { success: false, error: err.response?.data || err.message };
    }
};
