import ApiClient from "../ApiClient";

export const getAllShortcuts = async () => {
    try {
        const response = await ApiClient.get("/shortcuts");
        return response.data;
    } catch (error) {
        throw error.response?.data || error.message;
    }
};

export const createShortcut = async (shortcutData) => {
    try {
        const response = await ApiClient.post("/shortcuts", shortcutData);
        return response.data;
    } catch (error) {
        throw error.response?.data || error.message;
    }
};

export const updateShortcut = async (id, shortcutData) => {
    try {
        const response = await ApiClient.put(`/shortcuts/${id}`, shortcutData);
        return response.data;
    } catch (error) {
        throw error.response?.data || error.message;
    }
};

export const deleteShortcut = async (id) => {
    try {
        const response = await ApiClient.delete(`/shortcuts/${id}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || error.message;
    }
};

export const resetShortcuts = async () => {
    try {
        const response = await ApiClient.post("/shortcuts/reset");
        return response.data;
    } catch (error) {
        throw error.response?.data || error.message;
    }
};
