import ApiClient from '../ApiClient';

export const createDamageEntry = async (data) => {
    try {
        const res = await ApiClient.post('/damageEntry/create', data);
        return { success: true, data: res.data };
    } catch (err) {
        return { success: false, error: err?.response?.data?.message || 'Failed to create entry' };
    }
};

export const getAllDamageEntries = async () => {
    try {
        const res = await ApiClient.get('/damageEntry/all');
        return { success: true, data: res.data?.data || [] };
    } catch (err) {
        return { success: false, error: err?.response?.data?.message || 'Failed to fetch entries', data: [] };
    }
};

export const getDamageEntry = async (id) => {
    try {
        const res = await ApiClient.get(`/damageEntry/${id}`);
        return { success: true, data: res.data?.data };
    } catch (err) {
        return { success: false, error: err?.response?.data?.message || 'Failed to fetch entry' };
    }
};

export const updateDamageEntry = async (id, data) => {
    try {
        const res = await ApiClient.put(`/damageEntry/${id}`, data);
        return { success: true, data: res.data };
    } catch (err) {
        return { success: false, error: err?.response?.data?.message || 'Failed to update entry' };
    }
};

export const deleteDamageEntry = async (id) => {
    try {
        const res = await ApiClient.delete(`/damageEntry/${id}`);
        return { success: true, data: res.data };
    } catch (err) {
        return { success: false, error: err?.response?.data?.message || 'Failed to delete entry' };
    }
};

export const getNextDamageBillNo = async (series = 'DMG') => {
    try {
        const res = await ApiClient.get(`/damageEntry/nextBillNo?series=${series}`);
        return res.data?.nextBillNo || '1';
    } catch (err) {
        return '1';
    }
};
