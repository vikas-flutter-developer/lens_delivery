import ApiClient from "../ApiClient";

export const upsertPowerGroupPricing = async (pricing) => {
    try {
        const res = await ApiClient.post('/productPowerGroupPricing/upsert', { pricing });
        return res.data;
    } catch (err) {
        console.error(err);
        return err?.response?.data || { success: false, message: err.message };
    }
};

export const getPowerGroupPricing = async (partyId, priceType = "Sale") => {
    try {
        const res = await ApiClient.get(`/productPowerGroupPricing/get?partyId=${partyId}&priceType=${priceType}`);
        return res.data;
    } catch (err) {
        console.error(err);
        return err?.response?.data || { success: false, message: err.message };
    }
};
