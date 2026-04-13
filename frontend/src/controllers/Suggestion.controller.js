import ApiClient from "../ApiClient";

export const getSuggestions = async (type) => {
    try {
        const response = await ApiClient.get(`/suggestions?type=${type}`);
        return response.data; // { success, data: [...] }
    } catch (error) {
        console.error("Error fetching suggestions", error);
        return { success: false, data: [] };
    }
}

export const learnSuggestions = async (payload) => {
    try {
        const response = await ApiClient.post(`/suggestions/learn`, payload);
        return response.data;
    } catch (error) {
        console.error("Error learning suggestions", error);
        return { success: false };
    }
}

export const deleteSuggestion = async (value, type) => {
    try {
        const response = await ApiClient.post(`/suggestions/delete`, { value, type });
        return response.data;
    } catch (error) {
        console.error("Error deleting suggestion", error);
        return { success: false };
    }
}
