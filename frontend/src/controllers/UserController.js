import ApiClient from "../ApiClient.js";

export const getAllUsers = async () => {
  try {
    const res = await ApiClient.get('/auth/admin/userdata');
    return res.data;
  }
  catch (err) {
    console.error("Error fetching users:", err);
    return { success: false, response: [] };
  }
};

export const getDeliveryPersons = async () => {
  try {
    const res = await getAllUsers();
    const userData = res.response || [];
    return userData.filter(user => user.role === 'delivery_person');
  } catch (err) {
    console.error("Error fetching delivery persons:", err);
    return [];
  }
};
