import ApiClient from "../ApiClient";

export const getReorderReport = async (filters) => {
    try {
        const response = await ApiClient.post(`/inventory/reorder-report`, filters);
        return response.data;
    } catch (error) {
        console.error("Error in getReorderReport:", error);
        throw error;
    }
};
