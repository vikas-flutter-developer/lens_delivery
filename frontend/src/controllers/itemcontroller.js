import ApiClient from "../ApiClient";

export const getAllItems = async () => {
    try {
        const response = await ApiClient.get('/items')
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const addItem = async (itemData) => {
    try {
        const response = await ApiClient.post('/items/add-item', itemData)
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const updateItem = async (itemId, itemData) => {
    try {
        const response = await ApiClient.post(`/items/update/${itemId}`, itemData)
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const deleteItem = async (itemId) => {
    try {
        const response = await ApiClient.delete(`/items/delete/${itemId}`)
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const updateItemBackend = async (id, itemData) => {
    try {
        const response = await ApiClient.put(`/items/${id}`, itemData)
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const deleteItemBackend = async (id) => {
    try {
        const response = await ApiClient.delete(`/items/${id}`)
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const getItemById = async (id) => {
    try {
        const response = await ApiClient.get(`/items/${id}`)
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const bulkUpdateItems = async (items) => {
    try {
        const response = await ApiClient.post('/items/bulk-update', { items });
        return response.data;
    } catch (error) {
        throw error;
    }
}
export const getNextAlias = async () => {
    try {
        const response = await ApiClient.get('/items/next-alias');
        return response.data;
    } catch (error) {
        throw error;
    }
}
