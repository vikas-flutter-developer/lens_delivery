import mongoose from "mongoose";
import LensLocationStock from "../models/LensLocationStock.js";
import Item from "../models/Item.js";

/**
 * Bulk upserts lens location stock records.
 */
export const saveLensLocationStock = async (req, res) => {
    try {
        const { stocks } = req.body;
        const companyId = req.user?.companyId || null;

        if (!stocks || !Array.isArray(stocks)) {
            return res.status(400).json({ success: false, message: "Invalid stocks data." });
        }

        console.log(`[LensLocationStock] Saving ${stocks.length} stock entries for company ${companyId}`);

        const operations = [];
        stocks.forEach(stock => {
            const itemId = stock.item_id ? new mongoose.Types.ObjectId(stock.item_id) : null;

            if (!itemId) return;

            // 1. Delete any existing records for this power combo to avoid duplicates/old locations
            operations.push({
                deleteMany: {
                    filter: {
                        item_id: itemId,
                        sph: Number(stock.sph),
                        cyl: Number(stock.cyl),
                        add_power: Number(stock.add),
                        eye: stock.eye,
                        companyId: companyId
                    }
                }
            });

            // 2. Insert the new record (if qty > 0)
            if (Number(stock.quantity) > 0) {
                operations.push({
                    insertOne: {
                        document: {
                            item_id: itemId,
                            group_id: stock.group_id,
                            sph: Number(stock.sph),
                            cyl: Number(stock.cyl),
                            add_power: Number(stock.add),
                            eye: stock.eye,
                            quantity: Number(stock.quantity),
                            godown: stock.godown,
                            rack_no: stock.rack_no,
                            box_no: stock.box_no,
                            companyId: companyId
                        }
                    }
                });
            }
        });

        if (operations.length > 0) {
            await LensLocationStock.bulkWrite(operations);
        }

        res.status(200).json({ success: true, message: "Stock location mapping saved successfully." });
    } catch (error) {
        console.error("[LensLocationStock] Save Error:", error);
        res.status(500).json({ success: false, message: "Internal server error.", error: error.message });
    }
};

/**
 * Fetches stock records for a specific item and location.
 */
export const getLensLocationStock = async (req, res) => {
    try {
        const { item_id, godown, rack_no, box_no } = req.body;
        const companyId = req.user?.companyId || null;

        if (!item_id) {
            return res.status(400).json({ success: false, message: "item_id is required." });
        }

        const query = {
            item_id: new mongoose.Types.ObjectId(item_id),
            companyId: companyId
        };

        if (godown) query.godown = godown;
        if (rack_no) query.rack_no = rack_no;
        if (box_no) query.box_no = box_no;

        console.log(`[LensLocationStock] Fetching stock for item ${item_id}, query:`, query);

        const stocks = await LensLocationStock.find(query);
        res.status(200).json({ success: true, data: stocks });
    } catch (error) {
        console.error("[LensLocationStock] Fetch Error:", error);
        res.status(500).json({ success: false, message: "Internal server error.", error: error.message });
    }
};

import LensGroup from "../models/LensGroup.js";

/**
 * Check stock availability for a list of items using Inventory Master (LensGroup).
 * POST /api/lensLocation/checkStock
 * Body: { items: [{ itemName, sph, cyl, add, eye, qty }] }
 */
export const checkStockAvailability = async (req, res) => {
    try {
        const { items } = req.body;
        const companyId = req.user?.companyId || null;

        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ success: false, message: "items array is required." });
        }

        const TOLERANCE = 0.001;
        const norm = (v) => Math.round((Number(v) || 0) * 100) / 100;

        const results = [];
        for (const item of items) {
            const targetAdd = norm(item.add);
            const targetSph = norm(item.sph);
            const targetCyl = norm(item.cyl);
            const targetEye = String(item.eye || "").toUpperCase().trim();
            const targetEyes = (["RL", "R/L", "BOTH", "BOTH EYE", "PAIR"].includes(targetEye)) 
                ? ["RL", "R/L", "BOTH", "BOTH EYE", "PAIR", "R", "L", ""] 
                : [targetEye];

            // 1. Find the LensGroup (Inventory Master)
            const lensGroups = await LensGroup.find({
                productName: { $regex: new RegExp(`^${(item.itemName || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
                $or: [{ companyId }, { companyId: null }]
            });

            if (!lensGroups.length) {
                results.push({ ...item, availableStock: 0, sufficient: false, found: false });
                continue;
            }

            let masterStock = 0;
            for (const lg of lensGroups) {
                const addGroup = (lg.addGroups || []).find(ag => Math.abs(norm(ag.addValue) - targetAdd) < TOLERANCE);
                if (addGroup) {
                    const matchingCombs = (addGroup.combinations || []).filter(c => 
                        Math.abs(norm(c.sph) - targetSph) < TOLERANCE &&
                        Math.abs(norm(c.cyl) - targetCyl) < TOLERANCE &&
                        targetEyes.includes(String(c.eye || "").toUpperCase().trim())
                    );
                    masterStock += matchingCombs.reduce((sum, c) => sum + Number(c.initStock || 0), 0);
                }
            }

            const requested = Number(item.qty) || 0;
            results.push({
                itemName: item.itemName,
                sph: item.sph,
                cyl: item.cyl,
                add: item.add,
                eye: item.eye || "",
                requestedQty: requested,
                availableStock: masterStock,
                sufficient: masterStock >= requested,
                found: true,
            });
        }

        const allSufficient = results.every(r => r.sufficient);
        res.status(200).json({ success: true, allSufficient, results });
    } catch (error) {
        console.error("[LensLocationStock] Check Error:", error);
        res.status(500).json({ success: false, message: "Internal server error.", error: error.message });
    }
};
