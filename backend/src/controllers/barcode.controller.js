import BarcodeLensData from "../models/BarcodeLensData.js";
import LensGroup from "../models/LensGroup.js";
import Item from "../models/Item.js";
import User from "../models/User.js";
import LensSale from "../models/LensSale.js";
import LensSaleChallan from "../models/LensSaleChallan.js";
import RxSale from "../models/RxSale.js";
import mongoose from "mongoose";


/**
 * Validates and transforms a single barcode entry
 */
const prepareBarcodeData = (data, req) => {
    const {
        barcode,
        productId,
        sph,
        cyl,
        axis,
        add,
        companyId,
        metadata = {}
    } = data;

    const cleanedCompanyId = (companyId && String(companyId).trim() !== "") ? companyId : null;
    const finalCompanyId = cleanedCompanyId || req.user?.companyId || null;

    if (!barcode || !productId) {
        return null;
    }

    return {
        barcode,
        productId,
        sph: Number(sph) || 0,
        cyl: Number(cyl) || 0,
        axis: Number(axis) || 0,
        add: Number(add) || 0,
        companyId: finalCompanyId,
        metadata
    };
};

/**
 * SAVE BARCODE DATA API (POST)
 * Saves lens data associated with a scanned barcode.
 */
const saveBarcodeData = async (req, res) => {
    try {
        const preparedData = prepareBarcodeData(req.body, req);
        const { allowOverwrite = false } = req.body;

        if (!preparedData) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: barcode, productId, or companyId"
            });
        }

        // Check for duplicate barcode in our repository
        const existingEntry = await BarcodeLensData.findOne({ barcode: preparedData.barcode });

        if (existingEntry) {
            if (!allowOverwrite) {
                return res.status(409).json({
                    success: false,
                    message: "Barcode already exists in the scanner system",
                    data: existingEntry,
                });
            }

            // Update existing
            Object.assign(existingEntry, preparedData);
            await existingEntry.save();

            return res.status(200).json({
                success: true,
                message: "Barcode data updated successfully",
                data: existingEntry,
            });
        }

        const newBarcodeData = new BarcodeLensData(preparedData);
        await newBarcodeData.save();

        return res.status(201).json({
            success: true,
            message: "Barcode data saved successfully",
            data: newBarcodeData,
        });
    } catch (error) {
        console.error("Error saving barcode data:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};

/**
 * BULK SAVE BARCODE DATA (POST /api/barcodes/bulk)
 * Useful for scanning multiple items at once on the machine.
 */
const bulkSaveBarcodeData = async (req, res) => {
    try {
        const { scans } = req.body; // Array of scan objects
        if (!Array.isArray(scans)) {
            return res.status(400).json({ success: false, message: "Scans must be an array" });
        }

        const results = {
            successCount: 0,
            failCount: 0,
            errors: []
        };

        const batchSize = 50;
        for (let i = 0; i < scans.length; i += batchSize) {
            const batch = scans.slice(i, i + batchSize);

            const operations = batch.map(scan => {
                const prepared = prepareBarcodeData(scan, req);
                if (!prepared) return null;

                return {
                    updateOne: {
                        filter: { barcode: prepared.barcode },
                        update: { $set: prepared },
                        upsert: true
                    }
                };
            }).filter(op => op !== null);

            if (operations.length > 0) {
                const res = await BarcodeLensData.bulkWrite(operations);
                results.successCount += (res.upsertedCount + res.modifiedCount);
            }
        }

        return res.status(200).json({
            success: true,
            message: "Bulk upload completed",
            summary: results
        });
    } catch (error) {
        console.error("Bulk save error:", error);
        return res.status(500).json({ success: false, message: "Bulk save failed", error: error.message });
    }
};

/**
 * FETCH BARCODE DATA API (GET)
 * Fetches lens data by barcode number. Improved to search in multiple locations.
 */
const getBarcodeData = async (req, res) => {
    try {
        let { barcode } = req.params;
        const companyId = req.query.companyId || req.user?.companyId;

        console.log("[BarcodeScanner] Received barcode:", barcode);

        if (!barcode) {
            return res.status(400).json({ success: false, message: "Barcode number is required" });
        }

        // --- DELIVERY CONFIRMATION LOGIC ---
        // Some scanners might double-encode or add characters. We try to find a JSON pattern.
        let scanData = null;
        try {
            // Try direct parse
            scanData = JSON.parse(barcode);
        } catch (e) {
            // Try URI decoding first in case it's encoded
            try {
                scanData = JSON.parse(decodeURIComponent(barcode));
            } catch (e2) {
                // Not JSON, continue to normal barcode search below
            }
        }

        if (scanData && scanData.orderId && scanData.orderType) {
            console.log("[BarcodeScanner] Detected Delivery QR scan for:", scanData);
            const { orderId, orderType } = scanData;
            
            // 1. Get delivery person info
            const user = await User.findById(req.user.id);
            if (!user) {
                console.error("[BarcodeScanner] User not found for ID:", req.user.id);
                return res.status(401).json({ success: false, message: "Authorized user not found" });
            }
            
            const deliveryPerson = user.name || "Technician";
            console.log("[BarcodeScanner] Updating delivery for:", deliveryPerson);

            let updatedOrder = null;
            let orderDisplayNo = "";

            // 2. Perform the update based on order type
            const typeLower = orderType.toLowerCase();
            if (typeLower === 'challan') {
                updatedOrder = await LensSaleChallan.findByIdAndUpdate(
                    orderId,
                    { deliveryPerson, deliveryPersonAssignedAt: new Date() },
                    { new: true }
                );
                orderDisplayNo = updatedOrder?.billData?.billNo;
            } else if (typeLower === 'lens' || typeLower === 'lens-invoice') {
                updatedOrder = await LensSale.findByIdAndUpdate(
                    orderId,
                    { deliveryPerson },
                    { new: true }
                );
                orderDisplayNo = updatedOrder?.billData?.billNo;
            } else if (typeLower === 'rx' || typeLower === 'rx-invoice') {
                updatedOrder = await RxSale.findByIdAndUpdate(
                    orderId,
                    { deliveryPerson },
                    { new: true }
                );
                orderDisplayNo = updatedOrder?.billData?.billNo;
            }

            if (updatedOrder) {
                console.log("[BarcodeScanner] Successfully updated order delivery info");
                return res.status(200).json({
                    success: true,
                    source: "delivery_confirmation",
                    message: `Delivery confirmed by ${deliveryPerson}`,
                    deliveryPerson: deliveryPerson,
                    lensData: {
                        productName: `DELIVERY CONFIRMED`,
                        status: "DONE",
                        technician: deliveryPerson,
                        billNo: orderDisplayNo,
                        orderId: orderId
                    }
                });
            } else {
                console.error("[BarcodeScanner] Order not found in database for ID:", orderId);
            }
        }
        // ------------------------------------

        const query = { barcode };


        if (companyId) query.companyId = companyId;

        // 1. Search in Barcode Scanner Repository first
        let data = await BarcodeLensData.findOne(query).populate("productId");

        if (data) {
            return res.status(200).json({
                success: true,
                source: "scanner_repo",
                barcode: data.barcode,
                productId: data.productId?._id,
                lensData: {
                    sph: data.sph,
                    cyl: data.cyl,
                    axis: data.axis,
                    add: data.add,
                    productName: data.productId?.productName,
                    ...data.metadata,
                },
                createdAt: data.createdAt,
            });
        }

        // 2. FALLBACK: Search in LensGroup combinations
        const lensGroupWithComb = await LensGroup.findOne({
            "addGroups.combinations.barcode": barcode,
            ...(companyId ? { companyId } : {})
        });

        if (lensGroupWithComb) {
            let foundComb = null;
            let addVal = null;

            for (const ag of lensGroupWithComb.addGroups) {
                const comb = ag.combinations.find(c => c.barcode === barcode);
                if (comb) {
                    foundComb = comb;
                    addVal = ag.addValue;
                    break;
                }
            }

            if (foundComb) {
                return res.status(200).json({
                    success: true,
                    source: "inventory_lens_combination",
                    barcode: barcode,
                    productId: lensGroupWithComb._id,
                    lensData: {
                        sph: foundComb.sph,
                        cyl: foundComb.cyl,
                        axis: foundComb.axis,
                        add: addVal || 0,
                        productName: lensGroupWithComb.productName,
                        stock: foundComb.initStock
                    }
                });
            }
        }

        // 3. FALLBACK: Search in standalone Items
        const standaloneItem = await Item.findOne({
            barcode,
            ...(companyId ? { companyId } : {})
        });

        if (standaloneItem) {
            return res.status(200).json({
                success: true,
                source: "standalone_item",
                barcode: barcode,
                productId: standaloneItem._id,
                lensData: {
                    productName: standaloneItem.itemName,
                    purchasePrice: standaloneItem.purchasePrice,
                    salePrice: standaloneItem.salePrice,
                    stock: standaloneItem.openingStockQty
                }
            });
        }

        return res.status(404).json({
            success: false,
            message: "Barcode not found in scan history or inventory",
        });
    } catch (error) {
        console.error("Error fetching barcode data:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};

export { saveBarcodeData, bulkSaveBarcodeData, getBarcodeData };
