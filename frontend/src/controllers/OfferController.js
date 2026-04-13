import ApiClient from "../ApiClient";

export const getOffersByGroup = async (groupName) => {
    try {
        const res = await ApiClient.get(`/offers/getByGroup?groupName=${encodeURIComponent(groupName)}`);
        return res.data;
    } catch (err) {
        console.error(err);
        return err?.response?.data || { success: false, message: err.message };
    }
};

export const bulkUpsertOffers = async (groupName, offers) => {
    try {
        const res = await ApiClient.post('/offers/bulkUpsert', { groupName, offers });
        return res.data;
    } catch (err) {
        console.error(err);
        return err?.response?.data || { success: false, message: err.message };
    }
};

export const getOfferForProduct = async (productId, isLens) => {
    try {
        const res = await ApiClient.get(`/offers/getOfferForProduct?productId=${productId}&isLens=${isLens}`);
        return res.data;
    } catch (err) {
        console.error(err);
        return err?.response?.data || { success: false, message: err.message };
    }
};
