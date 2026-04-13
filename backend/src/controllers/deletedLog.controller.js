import DeletedLog from "../models/DeletedLog.js";
import Item from "../models/Item.js";
import Group from "../models/Group.js";
import Account from "../models/Account.js";
import AccountGroup from "../models/AccountGroup.js";
import Vendor from "../models/Vendor.js";
import LensPurchase from "../models/LensPurchase.js";
import LensSale from "../models/LensSale.js";
// Add other transaction models as needed

export const getDeletedLogs = async (req, res) => {
    try {
        const { dateFrom, dateTo, type, search } = req.body;
        let query = {};

        if (dateFrom && dateTo) {
            query.deletedDate = {
                $gte: new Date(dateFrom),
                $lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)),
            };
        }

        if (type && type !== "Alls") {
            const lowerType = type.toLowerCase();
            if (lowerType === "master") {
                query.type = { $in: ["master", "account", "vendor", "accountgroup"] };
            } else {
                query.type = lowerType;
            }
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { groupName: { $regex: search, $options: "i" } },
                { type: { $regex: search, $options: "i" } }
            ];
        }

        const logs = await DeletedLog.find(query).sort({ deletedDate: -1 });
        res.status(200).json({ success: true, data: logs });
    } catch (error) {
        console.error("Error fetching deleted logs:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

export const restoreDeletedData = async (req, res) => {
    try {
        const { ids } = req.body; // Array of IDs to restore
        if (!ids || !ids.length) {
            return res.status(400).json({ success: false, message: "No IDs provided" });
        }

        const results = [];
        for (const id of ids) {
            const log = await DeletedLog.findById(id);
            if (!log) continue;

            const { type, originalData } = log;
            let Model;

            switch (type) {
                case "item": Model = Item; break;
                case "group": Model = Group; break;
                case "account": Model = Account; break;
                case "accountgroup": Model = AccountGroup; break;
                case "vendor": Model = Vendor; break;
                case "transaction":
                    if (originalData.items && originalData.billData) {
                        Model = LensSale;
                    }
                    break;
                default: break;
            }

            if (Model) {
                await Model.create(originalData);
                await DeletedLog.findByIdAndDelete(id);
                results.push({ id, status: "restored" });
            }
        }

        res.status(200).json({ success: true, results });
    } catch (error) {
        console.error("Error restoring data:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

export const deleteLogPermanently = async (req, res) => {
    try {
        const { ids } = req.body;
        await DeletedLog.deleteMany({ _id: { $in: ids } });
        res.status(200).json({ success: true, message: "Deleted logs permanently" });
    } catch (error) {
        console.error("Error deleting logs:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};
