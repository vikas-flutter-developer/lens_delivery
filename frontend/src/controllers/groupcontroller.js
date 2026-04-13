import ApiClient from "../ApiClient.js";


export const addGroup = async (groupData) => {
    try {
        const response = await ApiClient.post('/groups/add-group', groupData);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getAllGroups = async () => {
    try {
        const response = await ApiClient.get('/groups');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getGroupbyId = async (id) => {
    try {
        const response = await ApiClient.get(`/groups/${id}`);
        return response.data.groups;
    } catch (error) {
        throw error;
    }
}

export const deleteGroup = async (id) => {
    const res = await ApiClient.delete(`groups/delete/${id}`)
    return res.data
}

export const updateGroup = async (id, updatedData) => {
    const res = await ApiClient.post(`/groups/update/${id}`, updatedData);
    return res.data;
};