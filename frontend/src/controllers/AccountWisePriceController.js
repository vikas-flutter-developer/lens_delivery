import ApiClient from "../ApiClient";

export const upsertAccountWisePrice = async (data) => {
    try {
        const res = await ApiClient.post('/accountWisePrice/upsert', data);
        return res.data;
    } catch (err) {
        console.error(err);
        return err?.response?.data || { success: false, message: err.message };
    }
};

export const getAccountWisePrices = async (accountId, type = "Sale") => {
    try {
        const res = await ApiClient.get(`/accountWisePrice/getByAccount?accountId=${accountId}&type=${type}`);
        return res.data;
    } catch (err) {
        console.error(err);
        return err?.response?.data || { success: false, message: err.message };
    }
};

export const bulkUpsertAccountWisePrices = async (prices) => {
    try {
        const res = await ApiClient.post('/accountWisePrice/bulkUpsert', { prices });
        return res.data;
    } catch (err) {
        console.error(err);
        return err?.response?.data || { success: false, message: err.message };
    }
};
