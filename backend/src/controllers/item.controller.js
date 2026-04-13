import Item from "../models/Item.js"; // Note: Model file is still Product.js, but we use 'Item' alias
import LensGroup from "../models/LensGroup.js";
import { logDeletion } from "../utils/logDeletion.js";

async function syncItemToLensCombination(item) {
    if (!item) return;

    // Use barcode primarily, or fallback to itemName if it's a Lens Product
    let query = {};
    if (item.barcode) {
        query = { "addGroups.combinations.barcode": item.barcode };
    } else if (item.itemName) {
        query = { productName: item.itemName };
    } else {
        return;
    }

    // Find LensGroup that corresponds to this item
    const lensGroup = await LensGroup.findOne(query);
    if (!lensGroup) return;

    let updated = false;

    // 1. Sync combinations if barcode is present
    if (item.barcode) {
        for (let ag of lensGroup.addGroups) {
            for (let comb of ag.combinations) {
                if (comb.barcode === item.barcode) {
                    // Update combination specific prices & alerts
                    if (item.purchasePrice !== undefined) comb.pPrice = Number(item.purchasePrice);
                    if (item.salePrice !== undefined) comb.sPrice = Number(item.salePrice);
                    if (item.minStock !== undefined) comb.alertQty = Number(item.minStock);
                    updated = true;
                }
            }
        }
    }

    // 2. Sync master prices in LensGroup (if itemName matches or it's the parent)
    const isParent = (item.itemName && String(lensGroup.productName).toLowerCase() === String(item.itemName).toLowerCase());

    // We update parent prices if this item is considered the master record for the lens group
    if (isParent || (!item.barcode && lensGroup.productName)) {
        if (item.purchasePrice !== undefined) {
            lensGroup.purchasePrice = Number(item.purchasePrice);
            updated = true;
        }
        if (item.salePrice !== undefined) {
            if (lensGroup.salePrice && typeof lensGroup.salePrice === 'object') {
                lensGroup.salePrice.default = Number(item.salePrice);
            } else {
                lensGroup.salePrice = { default: Number(item.salePrice) };
            }
            updated = true;
        }

        // PROPAGATE: If the parent's master prices changed, update ALL its combinations
        if (updated) {
            const masterP = lensGroup.purchasePrice;
            const masterS = lensGroup.salePrice?.default;
            const ops = [];

            lensGroup.addGroups.forEach(ag => {
                (ag.combinations || []).forEach(comb => {
                    comb.pPrice = masterP;
                    comb.sPrice = masterS;
                    if (comb.barcode) {
                        ops.push({
                            updateOne: {
                                filter: { barcode: comb.barcode },
                                update: { $set: { purchasePrice: masterP, salePrice: masterS } }
                            }
                        });
                    }
                });
            });

            if (ops.length > 0) {
                await Item.bulkWrite(ops);
            }
        }
    }

    if (updated) {
        // Mark as modified if it's nested deep or has object structure
        lensGroup.markModified('addGroups');
        lensGroup.markModified('salePrice');
        await lensGroup.save();
    }
}

const getAllItems = async (req, res) => {
    try {
        const items = await Item.find();
        res.status(200).json({ items });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error !!" });
        console.log(error);
    }
};

const getItem = async (req, res) => {
    const { id } = req.params;
    try {
        const item = await Item.findById(id);
        res.status(200).json({ item });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error !!" });
        console.log(error);
    }
};

const addItem = async (req, res) => {
    // Extract ItemSchema variables from the request body
    const {
        itemName, vendorItemName, billItemName, alias, printName, groupName, unit, altUnit, description,
        taxSetting, openingStockQty, openingStockValue, purchasePrice, saleProfit,
        salePrice, mrpPrice, saleDiscount, purchaseDiscount, minSalePrice, hsnCode,
        barcode, stockable, godown, loyaltyPoints, refAmn, refAmntIndia,
        forLensProduct, typeOfsupply, location, boxNo
    } = req.body;

    // Basic validation for a required field (itemName is required and unique in your schema)
    if (!itemName) {
        return res.status(400).json({ message: "Item Name is required" });
    }

    try {
        // 1. Check if an item with the same itemName already exists (since it's unique)
        const existingItem = await Item.findOne({ itemName });
        if (existingItem) {
            return res.status(400).json({ message: "Item with this Item Name already exists" });
        }
        // Check if alias already exists
        if (alias) {
            const existingAlias = await Item.findOne({ alias });
            if (existingAlias) {
                return res.status(400).json({ message: "Item with this Alias already exists" });
            }
        }

        // 2. Create a new Item instance using the Item model
        const newItem = new Item({
            itemName, vendorItemName, billItemName, alias, printName, groupName, unit, altUnit, description,
            taxSetting, openingStockQty, openingStockValue, purchasePrice, saleProfit,
            salePrice, mrpPrice, saleDiscount, purchaseDiscount, minSalePrice, hsnCode, TaxCategory: req.body.TaxCategory,
            barcode, stockable, godown, loyaltyPoints, refAmn, refAmntIndia,
            forLensProduct, typeOfsupply, location, boxNo
        });

        // 3. Save the new item to the database
        await newItem.save();

        // 4. Send a success response
        res.status(201).json({ message: "Item added successfully", item: newItem });

    } catch (error) {
        // Handle server/database errors
        res.status(500).json({ message: "Internal Server Error !!" });
        console.error(error);
    }
};

const updateItem = async (req, res) => {
    const { id } = req.params;

    // 1. Extract only the fields that are allowed to be updated
    const {
        itemName, vendorItemName, billItemName, alias, printName, groupName, unit, altUnit, description,
        taxSetting, openingStockQty, openingStockValue, purchasePrice, saleProfit,
        salePrice, mrpPrice, saleDiscount, purchaseDiscount, minSalePrice, hsnCode,
        barcode, stockable, godown, loyaltyPoints, refAmn, refAmntIndia,
        forLensProduct, typeOfsupply, location, boxNo
    } = req.body;

    // 2. Basic validation – at least one field must be sent
    if (Object.keys(req.body).length === 0) {
        return res.status(400).json({ message: "No data provided for update" });
    }

    try {
        // 3. Find the item first (to check existence & unique itemName)
        const item = await Item.findById(id);
        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        // 4. If itemName is being changed, enforce uniqueness
        if (itemName && itemName !== item.itemName) {
            const existing = await Item.findOne({ itemName });
            if (existing) {
                return res
                    .status(400)
                    .json({ message: "Another item with this Item Name already exists" });
            }
        }

        // 4b. Check alias uniqueness
        if (alias && alias !== item.alias) {
            const existingAlias = await Item.findOne({ alias });
            if (existingAlias) {
                return res.status(400).json({ message: "Another item with this Alias already exists" });
            }
        }

        // 5. Build the update object – only include fields that were sent
        const updates = {};
        if (itemName) updates.itemName = itemName;
        if (vendorItemName !== undefined) updates.vendorItemName = vendorItemName;
        if (billItemName !== undefined) updates.billItemName = billItemName;
        if (alias !== undefined) updates.alias = alias;
        if (printName !== undefined) updates.printName = printName;
        if (groupName !== undefined) updates.groupName = groupName;
        if (unit !== undefined) updates.unit = unit;
        if (altUnit !== undefined) updates.altUnit = altUnit;
        if (description !== undefined) updates.description = description;
        if (taxSetting !== undefined) updates.taxSetting = taxSetting;
        if (openingStockQty !== undefined) updates.openingStockQty = openingStockQty;
        if (openingStockValue !== undefined) updates.openingStockValue = openingStockValue;
        if (purchasePrice !== undefined) updates.purchasePrice = purchasePrice;
        if (saleProfit !== undefined) updates.saleProfit = saleProfit;
        if (salePrice !== undefined) updates.salePrice = salePrice;
        if (mrpPrice !== undefined) updates.mrpPrice = mrpPrice;
        if (saleDiscount !== undefined) updates.saleDiscount = saleDiscount;
        if (purchaseDiscount !== undefined) updates.purchaseDiscount = purchaseDiscount;
        if (minSalePrice !== undefined) updates.minSalePrice = minSalePrice;
        if (hsnCode !== undefined) updates.hsnCode = hsnCode;
        if (barcode !== undefined) updates.barcode = barcode;
        if (stockable !== undefined) updates.stockable = stockable;
        if (godown !== undefined) updates.godown = godown;
        if (loyaltyPoints !== undefined) updates.loyaltyPoints = loyaltyPoints;
        if (refAmn !== undefined) updates.refAmn = refAmn;
        if (refAmntIndia !== undefined) updates.refAmntIndia = refAmntIndia;
        if (forLensProduct !== undefined) updates.forLensProduct = forLensProduct;
        if (typeOfsupply !== undefined) updates.typeOfsupply = typeOfsupply;
        if (location !== undefined) updates.location = location;
        if (boxNo !== undefined) updates.boxNo = boxNo;
        if (req.body.TaxCategory !== undefined) updates.TaxCategory = req.body.TaxCategory;

        // 6. Perform the update
        const updatedItem = await Item.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        // SYNC: If this is a lens product, sync price to LensGroup
        if (updatedItem) {
            await syncItemToLensCombination(updatedItem);
        }

        // 7. Respond
        res.status(200).json({ message: "Item updated successfully", item: updatedItem });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error !!" });
    }
};

/* -------------------------------------------------
   DELETE ITEM (DELETE /api/items/:id)
   ------------------------------------------------- */
const deleteItem = async (req, res) => {
    const { id } = req.params;

    try {
        const item = await Item.findById(id);
        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        await logDeletion({
            type: "item",
            name: item.itemName,
            groupName: item.groupName,
            originalData: item
        });

        await Item.deleteOne({ _id: id });

        res.status(200).json({ message: "Item deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error !!" });
    }
};

/* -------------------------------------------------
   EXPORT ALL CONTROLLERS
   ------------------------------------------------- */
const bulkUpdateItems = async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ message: "Invalid items data" });
        }

        const updatePromises = items.map(async (itemData) => {
            const { id, ...updates } = itemData;
            if (!id) return;
            const updated = await Item.findByIdAndUpdate(id, { $set: updates }, { new: true });

            // SYNC: If this is a lens product, sync price to LensGroup
            if (updated) {
                await syncItemToLensCombination(updated);
            }
            return updated;
        });

        await Promise.all(updatePromises);
        res.status(200).json({ message: "Items updated successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error during bulk update" });
    }
};

const getNextAlias = async (req, res) => {
    try {
        // Find items with numeric alias
        const items = await Item.find({ alias: { $regex: /^\d+$/ } });
        let maxAlias = 100;
        if (items.length > 0) {
            const numericAliases = items.map(it => parseInt(it.alias));
            maxAlias = Math.max(...numericAliases);
        }
        res.status(200).json({ nextAlias: String(maxAlias + 1) });
    } catch (error) {
        console.error("Error in getNextAlias:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export {
    addItem,
    getItem,
    getAllItems,
    updateItem,
    deleteItem,
    bulkUpdateItems,
    getNextAlias
};