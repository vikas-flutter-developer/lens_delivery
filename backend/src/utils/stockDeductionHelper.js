/**
 * Stock Deduction Helper
 * Handles automatic stock adjustments in LensGroup (Actual Stock) and 
 * LensLocationStock (Location/Distribution Stock) when Sale Orders are
 * created, edited, or deleted.
 */
import Item from "../models/Item.js";
import LensLocationStock from "../models/LensLocationStock.js";
import LensGroup from "../models/LensGroup.js";

const TOLERANCE = 0.001; // Floating point tolerance for SPH/CYL/ADD matching

/**
 * Normalize a number for matching (round to 2 decimal places)
 */
const norm = (v) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * Normalize Eye value for matching
 */
const getEyeMatchGroup = (eye) => {
  const e = String(eye || "").toUpperCase().trim();
  // If "Both", include all common variations
  if (["RL", "R/L", "R-L", "R+L", "BOTH", "BOTH EYE", "PAIR"].includes(e)) {
    return ["RL", "R/L", "R-L", "R+L", "BOTH", "BOTH EYE", "PAIR", "R", "L", ""];
  }
  return [e];
};

/**
 * Normalize CompanyId for matching (allow null for global stock)
 */
const getCompanyMatchGroup = (companyId) => {
  if (companyId) return [companyId, null];
  return [null];
};

/**
 * Build a Mongoose query filter for LensLocationStock
 */
const buildLocationFilter = (itemId, orderItem, companyId, isSearchOnly = true) => {
  const filter = {
    item_id: itemId,
    sph: { $gte: norm(orderItem.sph) - TOLERANCE, $lte: norm(orderItem.sph) + TOLERANCE },
    cyl: { $gte: norm(orderItem.cyl) - TOLERANCE, $lte: norm(orderItem.cyl) + TOLERANCE },
    add_power: { $gte: norm(orderItem.add) - TOLERANCE, $lte: norm(orderItem.add) + TOLERANCE },
  };

  if (isSearchOnly) {
    filter.eye = { $in: getEyeMatchGroup(orderItem.eye) };
    filter.companyId = { $in: getCompanyMatchGroup(companyId) };
  } else {
    filter.eye = orderItem.eye || "";
    filter.companyId = companyId || null;
  }
  return filter;
};

/**
 * Look up the Item _id for a given item name.
 */
const getItemId = async (itemName) => {
  if (!itemName) return null;
  const item = await Item.findOne({
    itemName: { $regex: new RegExp(`^${itemName.trim()}$`, "i") },
  }).select("_id");
  return item ? item._id : null;
};

/**
 * Validate that sufficient stock exists for all items in an order using Inventory Master (LensGroup).
 */
export const validateStockAvailability = async (orderItems, companyId, excludeOrderItems = []) => {
  const errors = [];

  // 1. Build a map of excluded quantities (for edit scenario)
  const excludeMap = new Map();
  for (const item of excludeOrderItems) {
    const key = `${item.itemName}|${norm(item.sph)}|${norm(item.cyl)}|${norm(item.add)}|${item.eye || ""}`;
    excludeMap.set(key, (excludeMap.get(key) || 0) + (Number(item.qty) || 0));
  }

  // 2. Aggregate requested quantities from orderItems
  const requestMap = new Map();
  const itemInstances = new Map(); // Store an example item for each key to use in error messages
  
  for (const item of orderItems) {
    const key = `${item.itemName}|${norm(item.sph)}|${norm(item.cyl)}|${norm(item.add)}|${item.eye || ""}`;
    requestMap.set(key, (requestMap.get(key) || 0) + (Number(item.qty) || 0));
    if (!itemInstances.has(key)) itemInstances.set(key, item);
  }

  // 3. Validate each unique combination
  for (const [key, requestedQty] of requestMap.entries()) {
    const item = itemInstances.get(key);
    if (!item || requestedQty <= 0) continue;

    console.log(`[StockCheck] Validating: ${key} (Total Qty: ${requestedQty})`);
    
    // FIND IN INVENTORY MASTER (LensGroup)
    const lensGroups = await LensGroup.find({
      productName: { $regex: new RegExp(`^${item.itemName.trim()}$`, "i") },
      $or: [{ companyId }, { companyId: null }]
    });

    if (!lensGroups.length) continue;

    let masterStock = 0;
    const targetAdd = norm(item.add);
    const targetSph = norm(item.sph);
    const targetCyl = norm(item.cyl);
    const targetEyes = getEyeMatchGroup(item.eye);

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

    // Adjust by excluded quantities (release existing stock for edits)
    const excludedQty = excludeMap.get(key) || 0;
    const effectiveStock = masterStock + excludedQty;

    if (effectiveStock < requestedQty) {
      errors.push({
        itemName: item.itemName,
        sph: item.sph,
        cyl: item.cyl,
        add: item.add,
        available: masterStock,
        requested: requestedQty,
        message: `Insufficient stock for "${item.itemName}" (SPH: ${item.sph}, CYL: ${item.cyl}). Available: ${masterStock}, Requested: ${requestedQty}.`,
      });
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
};

/**
 * Deduct stock from Master (LensGroup, distributed) and Location (LensLocationStock).
 */
export const deductStock = async (orderItems, companyId) => {
  for (const item of orderItems) {
    let qtyToDeduct = Number(item.qty) || 0;
    if (qtyToDeduct <= 0) continue;

    const itemNameLower = item.itemName.trim();
    const targetAdd = norm(item.add);
    const targetSph = norm(item.sph);
    const targetCyl = norm(item.cyl);
    const targetEyes = getEyeMatchGroup(item.eye);

    // 1. DEDUCT FROM MASTER (LensGroup) - Distributed across matching groups
    const lensGroups = await LensGroup.find({
      productName: { $regex: new RegExp(`^${itemNameLower}$`, "i") },
      $or: [{ companyId }, { companyId: null }]
    });

    for (const lg of lensGroups) {
      if (qtyToDeduct <= 0) break;

      // Find all combinations in this LG that match the order item
      const addGroups = (lg.addGroups || []).filter(ag => Math.abs(norm(ag.addValue) - targetAdd) < TOLERANCE);
      for (const ag of addGroups) {
        if (qtyToDeduct <= 0) break;

        const matchingCombs = (ag.combinations || []).filter(c => 
          Math.abs(norm(c.sph) - targetSph) < TOLERANCE &&
          Math.abs(norm(c.cyl) - targetCyl) < TOLERANCE &&
          targetEyes.includes(String(c.eye || "").toUpperCase().trim())
        );

        for (const comb of matchingCombs) {
          if (qtyToDeduct <= 0) break;
          
          const available = comb.initStock || 0;
          if (available <= 0) continue;

          const toTake = Math.min(qtyToDeduct, available);
          
          // Atomic deduction from this specific combination
          await LensGroup.updateOne(
            { _id: lg._id },
            { $inc: { [`addGroups.$[ag].combinations.$[cb].initStock`]: -toTake } },
            {
              arrayFilters: [
                { "ag._id": ag._id },
                { "cb._id": comb._id }
              ]
            }
          );
          
          qtyToDeduct -= toTake;
        }
      }
    }

    // 2. DEDUCT FROM LOCATIONS (LensLocationStock)
    let locQtyToDeduct = Number(item.qty) || 0;
    const itemId = await getItemId(item.itemName);
    if (itemId) {
      const filter = buildLocationFilter(itemId, item, companyId, true);
      const locations = await LensLocationStock.find(filter).sort({ quantity: -1 });

      for (const loc of locations) {
        if (locQtyToDeduct <= 0) break;
        const take = Math.min(locQtyToDeduct, loc.quantity);
        if (take > 0) {
          loc.quantity -= take;
          locQtyToDeduct -= take;
          if (loc.quantity <= 0) {
            await LensLocationStock.findByIdAndDelete(loc._id);
          } else {
            await loc.save();
          }
        }
      }
    }
  }
};

/**
 * Restore stock to Master and Location.
 */
export const restoreStock = async (orderItems, companyId) => {
  for (const item of orderItems) {
    const qty = Number(item.qty) || 0;
    if (qty <= 0) continue;

    const itemNameLower = item.itemName.trim();
    const targetAdd = norm(item.add);
    const targetSph = norm(item.sph);
    const targetCyl = norm(item.cyl);

    // 1. RESTORE TO MASTER (First matching record found)
    const lensGroup = await LensGroup.findOne({ 
      productName: { $regex: new RegExp(`^${itemNameLower}$`, "i") },
      $or: [{ companyId }, { companyId: null }]
    });

    if (lensGroup) {
      const targetEyes = getEyeMatchGroup(item.eye);
      const addGroup = (lensGroup.addGroups || []).find(ag => Math.abs(norm(ag.addValue) - targetAdd) < TOLERANCE);
      if (addGroup) {
        const matchingCombs = (addGroup.combinations || []).filter(c => 
          Math.abs(norm(c.sph) - targetSph) < TOLERANCE &&
          Math.abs(norm(c.cyl) - targetCyl) < TOLERANCE &&
          targetEyes.includes(String(c.eye || "").toUpperCase().trim())
        );

        for (const comb of matchingCombs) {
          // Atomic restoration
          await LensGroup.updateOne(
            { _id: lensGroup._id },
            { $inc: { [`addGroups.$[ag].combinations.$[cb].initStock`]: qty } },
            {
              arrayFilters: [
                { "ag._id": addGroup._id },
                { "cb._id": comb._id }
              ]
            }
          );
          // If we restore a pair, we restore qty to BOTH eyes
        }
      }
    }

    // 2. RESTORE TO LOCATION
    const itemId = await getItemId(item.itemName);
    if (itemId) {
      const filter = buildLocationFilter(itemId, item, companyId, false);
      await LensLocationStock.findOneAndUpdate(
        filter,
        {
          $inc: { quantity: qty },
          $setOnInsert: {
            item_id: itemId,
            sph: norm(item.sph),
            cyl: norm(item.cyl),
            add_power: norm(item.add),
            eye: item.eye || "",
            companyId: companyId || null,
          },
        },
        { upsert: true, new: true }
      );
    }
  }
};

/**
 * Adjust stock for edit.
 */
export const adjustStockForEdit = async (oldItems, newItems, companyId) => {
  const validation = await validateStockAvailability(newItems, companyId, oldItems);
  if (!validation.valid) return validation;

  await restoreStock(oldItems, companyId);
  await deductStock(newItems, companyId);

  return { valid: true };
};
