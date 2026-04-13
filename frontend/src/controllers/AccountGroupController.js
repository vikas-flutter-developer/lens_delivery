import ApiClient from "../ApiClient.js";

export const addAccountGroup = async (groupData) =>{
    try{
        const res = await ApiClient.post('/account-groups/add-account-group' , groupData);
        return res.data;
    }
    catch(error){
      throw error; 
    }
}

export const getAllAccountGroups = async ()=>{
    try{
        const res = await ApiClient.get('/account-groups/get-all-account-groups')
        return res.data;
    }
    catch(err){
        throw err
    }
}

export const getAccountGroupById = async (id) => {
  try {
    const res = await ApiClient.get(`/account-groups/get/${id}`);
    return res.data;
  } catch (err) {
    return err.response?.data || { success: false, message: "Server error" };
  }
};

export const updateAccountGroup = async (id, groupData) => {
  try {
    const res = await ApiClient.put(`/account-groups/update/${id}`, groupData);
    return res.data; 
  } catch (err) {
    return err.response?.data || { success: false, message: "Server error" };
  }
};

export const deleteAccountGroup = async (id) =>{
    try{
        const res = await ApiClient.delete(`/account-groups/delete/${id}`);
        return res.data;
    }
    catch(err){
        return err.response?.data || { success: false, message: "Server error" };
    }
}