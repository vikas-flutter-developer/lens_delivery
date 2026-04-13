import Item from "../models/Item.js";
import LensGroup from "../models/LensGroup.js";
// Note: We'll add logic to include other items if needed, but for now
// we'll focus on Items and LensGroup combinations which already have alertQty logic.

export const getReorderReport = async (req, res) => {
    try {
        const { groupName, itemName, barcode, vendorName } = req.body;
        const companyId = req.user?.companyId;
        const companyFilter = {
            $or: [
                { companyId },
                { companyId: null }
            ]
        };

        // 1. Process LensGroup Combinations
        const lensPipeline = [
            { $match: companyFilter },
            { $unwind: "$addGroups" },
            { $unwind: "$addGroups.combinations" },
            {
                $project: {
                    productName: 1,
                    groupName: 1,
                    unit: { $literal: "PCS" },
                    alertQty: { $ifNull: ["$addGroups.combinations.alertQty", 0] },
                    stock: { $ifNull: ["$addGroups.combinations.initStock", 0] },
                    pPrice: { $ifNull: ["$addGroups.combinations.pPrice", "$purchasePrice"] },
                    barcode: { $ifNull: ["$addGroups.combinations.barcode", ""] },
                    type: { $literal: "Lens" },
                    // Extra lens info for reorder buttons
                    lensInfo: {
                        sph: "$addGroups.combinations.sph",
                        cyl: "$addGroups.combinations.cyl",
                        add: "$addGroups.addValue",
                        eye: "$addGroups.combinations.eye",
                        combinationId: "$addGroups.combinations._id"
                    }
                }
            }
        ];

        let lensData = await LensGroup.aggregate(lensPipeline);

        // 2. Process Regular Items
        const items = await Item.find(companyFilter).lean();
        const regularItemsData = items.map(item => ({
            productName: item.itemName,
            groupName: item.groupName || "N/A",
            unit: item.unit || "PCS",
            alertQty: item.alertQty || 0,
            stock: item.openingStockQty || 0, // In a real app, this would be computed or synced
            pPrice: item.purchasePrice || 0,
            barcode: item.barcode || "",
            type: item.Item,
            minStock: item.minStock || 0,
            maxStock: item.maxStock || 0,
            minReorderQty: item.minReorderQty || 0
        }));

        // 3. Merge and Filter
        let allData = [...lensData, ...regularItemsData];

        // Apply "Under Alert" filter
        allData = allData.filter(item => item.stock <= item.alertQty);

        // Apply Request Filters
        if (groupName) {
            allData = allData.filter(item =>
                item.groupName.toLowerCase().includes(groupName.toLowerCase())
            );
        }
        if (itemName) {
            allData = allData.filter(item =>
                item.productName.toLowerCase().includes(itemName.toLowerCase())
            );
        }
        if (barcode) {
            allData = allData.filter(item =>
                item.barcode.toLowerCase().includes(barcode.toLowerCase())
            );
        }

        res.status(200).json({
            success: true,
            data: allData
        });

    } catch (error) {
        console.error("Error in getReorderReport:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};
