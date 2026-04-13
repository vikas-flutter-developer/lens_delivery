import Suggestion from "../models/Suggestion.js";

export const getSuggestions = async (req, res) => {
    try {
        const { type } = req.query;
        let query = {};
        if (type) query.type = type;
        
        // Match existing multi-tenant pattern if needed:
        // if (req.user?.companyId) query.companyId = req.user.companyId;

        const suggestions = await Suggestion.find(query).select('value type').sort({ createdAt: -1 }).lean();
        
        // Return mostly values for simplicity
        const data = suggestions.map(s => s.value);
        
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Error in getSuggestions:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const learnSuggestions = async (req, res) => {
    try {
        const { taxes = [], customers = [] } = req.body;
        // const companyId = req.user?.companyId || null;

        const processArray = async (arr, type) => {
            // Filter: must be string, not empty, and not a pure number
            const valid = arr
                .map(v => v?.trim())
                .filter(v => typeof v === 'string' && v.length > 0 && isNaN(v));
            
            if (valid.length === 0) return;

            const ops = valid.map(v => {
                // Escape regex special characters
                const escapedV = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                return {
                    updateOne: {
                        filter: { type, value: new RegExp(`^${escapedV}$`, "i") }, // Case-insensitive exact match
                        update: { $setOnInsert: { type, value: v } },          // Store original case
                        upsert: true
                    }
                };
            });
            
            if (ops.length > 0) {
                await Suggestion.bulkWrite(ops);
            }
        };

        if (taxes.length > 0) await processArray(taxes, "tax");
        if (customers.length > 0) await processArray(customers, "customer");

        res.status(200).json({ success: true, message: "Learned successfully" });
    } catch (error) {
        console.error("Error in learnSuggestions:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteSuggestion = async (req, res) => {
    try {
        const { value, type } = req.body;
        if (!value || !type) {
             return res.status(400).json({ success: false, message: "Value and Type are required" });
        }
        await Suggestion.deleteOne({ type, value: new RegExp(`^${value}$`, "i") });
        res.status(200).json({ success: true, message: "Suggestion deleted" });
    } catch (error) {
        console.error("Error deleting suggestion:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
