import ProductPowerGroupPricing from "../models/ProductPowerGroupPricing.js";

export const upsertPowerGroupPricing = async (req, res) => {
    try {
        const { pricing } = req.body; // Array of { partyId, productId, powerGroupId, customPrice, priceType }
        const companyId = req.user?.companyId || null;

        if (!pricing || !Array.isArray(pricing)) {
            return res.status(400).json({
                success: false,
                message: "Pricing data array is required",
            });
        }

        const operations = pricing.map((p) => {
            const filter = {
                companyId,
                partyId: p.partyId,
                productId: p.productId,
                powerGroupId: p.powerGroupId,
                priceType: p.priceType || "Sale"
            };

            return {
                updateOne: {
                    filter,
                    update: { $set: { customPrice: p.customPrice } },
                    upsert: true,
                },
            };
        });

        if (operations.length > 0) {
            await ProductPowerGroupPricing.bulkWrite(operations);
        }

        return res.status(200).json({
            success: true,
            message: "Power group pricing updated successfully",
        });
    } catch (err) {
        console.error("Error upserting power group pricing:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message,
        });
    }
};

export const getPowerGroupPricing = async (req, res) => {
    try {
        const { partyId, priceType } = req.query;
        const companyId = req.user?.companyId || null;

        if (!partyId) {
            return res.status(400).json({
                success: false,
                message: "partyId is required",
            });
        }

        const prices = await ProductPowerGroupPricing.find({
            companyId,
            partyId,
            priceType: priceType || "Sale"
        });

        return res.status(200).json({
            success: true,
            data: prices,
        });
    } catch (err) {
        console.error("Error fetching power group pricing:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message,
        });
    }
};
