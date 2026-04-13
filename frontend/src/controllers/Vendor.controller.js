import ApiClient from "../ApiClient"
export const addVendor = async (data)=>{
    try{
        const res = await ApiClient.post('/vendor/addVendor' , data)
     return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.response?.data || err.message };
  }
}
export const getAllVendors = async ()=>{
     try {
    const res = await ApiClient.get("/vendor/getAllVendors");
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.response?.data || err.message };
  }
}
export const getVendorById = async (id)=>{
     try {
    const res = await ApiClient.get("/vendor/getVendorById", {
      params: { id },
    });
    return { success: true, data: res.data.data, status: res.status };
  } catch (err) {
    const status = err.response?.status;
    const message =
      err.response?.data?.message || err.message || "Unknown error";
    return { success: false, error: { message, status } };
  }
};
export const editVendor = async (id,payload)=>{
   try {
    const res = await ApiClient.put("/vendor/editVendor", {
      id,
      payload,
    });

    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.response?.data || err.message };
  }
}
export const deleteVendor = async (id)=>{
   try {
    const res = await ApiClient.delete("/vendor/deleteVendor", {
      data: { id }
    });
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.response?.data || err.message };
  }
}