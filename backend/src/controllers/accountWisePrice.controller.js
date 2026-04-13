import AccountWisePrice from "../models/AccountWisePrice.js";

export const upsertAccountWisePrice = async (req, res) => {
    try {
        const { accountId, itemId, lensGroupId, customPrice, percentage, type, status } = req.body;

        if (!accountId || (!itemId && !lensGroupId)) {
            return res.status(400).json({
                success: false,
                message: "AccountId and either ItemId or LensGroupId are required",
            });
        }

        const filter = { accountId, type: type || "Sale" };
        if (itemId) filter.itemId = itemId;
        if (lensGroupId) filter.lensGroupId = lensGroupId;

        const update = { customPrice, percentage, status: status || "CUSTOM" };

        const result = await AccountWisePrice.findOneAndUpdate(
            filter,
            { ...filter, ...update },
            { upsert: true, new: true }
        );

        return res.status(200).json({
            success: true,
            message: "Custom price updated successfully",
            data: result,
        });
    } catch (err) {
        console.error("Error upserting account wise price:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message,
        });
    }
};

export const getAccountWisePrices = async (req, res) => {
    try {
        const { accountId, type } = req.query;

        if (!accountId) {
            return res.status(400).json({
                success: false,
                message: "AccountId is required",
            });
        }

        const prices = await AccountWisePrice.find({ accountId, type: type || "Sale" });

        return res.status(200).json({
            success: true,
            data: prices,
        });
    } catch (err) {
        console.error("Error fetching account wise prices:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message,
        });
    }
};

export const bulkUpsertAccountWisePrices = async (req, res) => {
    try {
        const { prices } = req.body; // Array of { accountId, itemId, lensGroupId, customPrice, type }

        if (!prices || !Array.isArray(prices)) {
            return res.status(400).json({
                success: false,
                message: "Prices array is required",
            });
        }

        const operations = prices.map((p) => {
            const filter = { accountId: p.accountId, type: p.type || "Sale" };
            if (p.itemId) filter.itemId = p.itemId;
            if (p.lensGroupId) filter.lensGroupId = p.lensGroupId;

            return {
                updateOne: {
                    filter,
                    update: { $set: { customPrice: p.customPrice, percentage: p.percentage, status: p.status || "CUSTOM" } },
                    upsert: true,
                },
            };
        });

        await AccountWisePrice.bulkWrite(operations);

        return res.status(200).json({
            success: true,
            message: "Bulk custom prices updated successfully",
        });
    } catch (err) {
        console.error("Error bulk upserting account wise prices:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message,
        });
    }
};
