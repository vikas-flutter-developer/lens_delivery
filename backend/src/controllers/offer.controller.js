import Offer from "../models/Offer.js";
import Item from "../models/Item.js";
import LensGroup from "../models/LensGroup.js";

export const getOffersByGroup = async (req, res) => {
    try {
        const { groupName } = req.query;

        if (!groupName) {
            return res.status(400).json({ success: false, message: "GroupName is required" });
        }

        // Fetch all items and lens groups belonging to this groupName
        const [items, lensGroups] = await Promise.all([
            Item.find({ groupName }),
            LensGroup.find({ groupName })
        ]);

        // Fetch existing offers for this group
        const existingOffers = await Offer.find({ groupName });

        // Map offers for easy lookup
        const offersMap = {};
        existingOffers.forEach(o => {
            const key = o.itemId ? o.itemId.toString() : o.lensGroupId.toString();
            offersMap[key] = o;
        });

        // Combine items and lensGroups with their offer info
        const products = [
            ...items.map(i => ({
                id: i._id,
                name: i.itemName,
                groupName: i.groupName,
                isLens: false,
                defaultPrice: i.salePrice || 0,
                offer: offersMap[i._id.toString()] || null
            })),
            ...lensGroups.map(l => ({
                id: l._id,
                name: l.productName,
                groupName: l.groupName,
                isLens: true,
                defaultPrice: l.salePrice?.default || 0,
                offer: offersMap[l._id.toString()] || null
            }))
        ];

        return res.status(200).json({ success: true, data: products });
    } catch (err) {
        console.error("Error in getOffersByGroup:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

export const bulkUpsertOffers = async (req, res) => {
    try {
        const { groupName, offers } = req.body; // offers: array of { id, isLens, percentage, qty, offerPrice, status }

        if (!groupName || !Array.isArray(offers)) {
            return res.status(400).json({ success: false, message: "GroupName and offers array are required" });
        }

        const operations = offers.map(o => {
            const filter = { groupName };
            const update = {
                groupName,
                defaultPrice: o.defaultPrice,
                percentage: o.percentage,
                qty: o.qty,
                offerPrice: o.offerPrice,
                status: o.status || "OFFER SET"
            };

            if (o.isLens) {
                filter.lensGroupId = o.id;
                update.lensGroupId = o.id;
            } else {
                filter.itemId = o.id;
                update.itemId = o.id;
            }

            return {
                updateOne: {
                    filter,
                    update: { $set: update },
                    upsert: true
                }
            };
        });

        if (operations.length > 0) {
            await Offer.bulkWrite(operations);
        }

        return res.status(200).json({ success: true, message: "Offers updated successfully" });
    } catch (err) {
        console.error("Error in bulkUpsertOffers:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

export const getOfferForProduct = async (req, res) => {
    try {
        const { productId, isLens } = req.query;
        if (!productId) {
            return res.status(400).json({ success: false, message: "ProductId is required" });
        }

        const filter = isLens === 'true' ? { lensGroupId: productId } : { itemId: productId };
        const offer = await Offer.findOne(filter);

        return res.status(200).json({ success: true, data: offer });
    } catch (err) {
        console.error("Error in getOfferForProduct:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
