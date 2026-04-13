import ApiClient from "../ApiClient";

const API_ROUTE = "/lensLocation";

export const saveLensLocationStock = async (stocks) => {
    try {
        const res = await ApiClient.post(`${API_ROUTE}/save`, { stocks });
        return res.data;
    } catch (error) {
        return error.response?.data || { success: false, message: error.message };
    }
};

export const fetchLensLocationStock = async (filters) => {
    try {
        const res = await ApiClient.post(`${API_ROUTE}/fetch`, filters);
        return res.data;
    } catch (error) {
        return error.response?.data || { success: false, message: error.message };
    }
};

/**
 * Check if sufficient stock is available for a list of items.
 * items: [{ itemName, sph, cyl, add, eye, qty }]
 */
export const checkStockAvailability = async (items) => {
    try {
        const res = await ApiClient.post(`${API_ROUTE}/checkStock`, { items });
        return res.data;
    } catch (error) {
        return error.response?.data || { success: false, message: error.message };
    }
};
