import ApiClient from "../ApiClient.js";

export const getVouchers = async () => {
    try {
        const res = await ApiClient.get('/vouchers');
        return res.data;
    } catch (error) {
        throw error;
    }
}

export const getVoucherById = async (id) => {
    try {
        const res = await ApiClient.get(`/vouchers/${id}`);
        return res.data;
    } catch (error) {
        throw error;
    }
}

export const createVoucher = async (data) => {
    try {
        const res = await ApiClient.post('/vouchers', data);
        return res.data;
    } catch (error) {
        throw error;
    }
}

export const updateVoucher = async (id, data) => {
    try {
        const res = await ApiClient.put(`/vouchers/${id}`, data);
        return res.data;
    } catch (error) {
        throw error;
    }
}

export const deleteVoucher = async (id) => {
    try {
        const res = await ApiClient.delete(`/vouchers/${id}`);
        return res.data;
    } catch (error) {
        throw error;
    }
}

export const getNextBillNo = async (recordType, billSeries) => {
    try {
        const res = await ApiClient.get(`/vouchers/nextBillNo`, { params: { recordType, billSeries } });
        return res.data;
    } catch (error) {
        throw error;
    }
}
