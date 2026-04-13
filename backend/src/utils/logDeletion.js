import DeletedLog from "../models/DeletedLog.js";

export const logDeletion = async ({ type, name, groupName, originalData, deletedBy = "Admin" }) => {
    try {
        await DeletedLog.create({
            type,
            name,
            groupName,
            originalData,
            deletedBy
        });
    } catch (error) {
        console.error("Error logging deletion:", error);
    }
};
