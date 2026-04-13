import ApiClient from "../ApiClient";

export const getBackups = async (type = "All") => {
  const response = await ApiClient.get(`/backups?type=${type}`);
  return response.data;
};

export const triggerBackup = async (type = "manual") => {
  const response = await ApiClient.post("/backups/trigger", { type });
  return response.data;
};

export const downloadBackup = async (id) => {
  const response = await ApiClient.get(`/backups/download/${id}`, {
    responseType: 'blob',
  });
  
  // Create a download link
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `backup_${id}.zip`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const deleteBackup = async (id) => {
  const response = await ApiClient.delete(`/backups/${id}`);
  return response.data;
};

export const restoreBackup = async (id) => {
  const response = await ApiClient.post(`/backups/restore/${id}`);
  return response.data;
};
