import ApiClient from "../ApiClient";

export const getDeletedLogs = async (filters) => {
    try {
        const response = await ApiClient.post(`/deleted-logs/get`, filters);
        return response.data;
    } catch (error) {
        console.error("Error in getDeletedLogs:", error);
        throw error;
    }
};

export const restoreDeletedData = async (ids) => {
    try {
        const response = await ApiClient.post(`/deleted-logs/restore`, { ids });
        return response.data;
    } catch (error) {
        console.error("Error in restoreDeletedData:", error);
        throw error;
    }
};

export const deleteLogPermanently = async (ids) => {
    try {
        const response = await ApiClient.post(`/deleted-logs/delete-permanent`, { ids });
        return response.data;
    } catch (error) {
        console.error("Error in deleteLogPermanently:", error);
        throw error;
    }
};
