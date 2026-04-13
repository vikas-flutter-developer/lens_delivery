import ApiClient from "../ApiClient.js";

export const addProductExchange = async (data) => {
    try {
        const res = await ApiClient.post("/productExchange/add", data);
        return res.data;
    } catch (error) {
        throw error;
    }
};

export const getAllProductExchanges = async () => {
    try {
        const res = await ApiClient.get("/productExchange/getall");
        return res.data;
    } catch (error) {
        throw error;
    }
};

export const getProductExchangeById = async (id) => {
    try {
        const res = await ApiClient.get(`/productExchange/get/${id}`);
        return res.data;
    } catch (error) {
        throw error;
    }
};

export const updateProductExchange = async (id, data) => {
    try {
        const res = await ApiClient.put(`/productExchange/update/${id}`, data);
        return res.data;
    } catch (error) {
        throw error;
    }
};

export const deleteProductExchange = async (id) => {
    try {
        const res = await ApiClient.delete(`/productExchange/delete/${id}`);
        return res.data;
    } catch (error) {
        throw error;
    }
};
