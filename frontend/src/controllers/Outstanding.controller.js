import ApiClient from "../ApiClient";

// Get outstanding report with filters
export const getOutstandingReport = async (params = {}) => {
    try {
        const res = await ApiClient.post("/outstanding/report", params);
        return res.data;
    } catch (err) {
        throw err;
    }
};

// Get all stations for dropdown
export const getStations = async () => {
    try {
        const res = await ApiClient.get("/outstanding/stations");
        return res.data;
    } catch (err) {
        throw err;
    }
};

// Get all groups for dropdown
export const getGroups = async () => {
    try {
        const res = await ApiClient.get("/outstanding/groups");
        return res.data;
    } catch (err) {
        throw err;
    }
};
