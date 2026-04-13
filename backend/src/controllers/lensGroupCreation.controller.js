import LensGroup from "../models/LensGroup.js";
import Item from "../models/Item.js";
import PowerRangeLibrary from "../models/PowerRangeLibrary.js";
import LensPurchase from "../models/LensPurchase.js";
import mongoose from "mongoose";

const escapeRegex = (string) => {
  if (!string) return "";
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Helper to save range to library
const saveToRangeLibrary = async (req, range) => {
  try {
    const { sphMin, sphMax, cylMin, cylMax, addMin, addMax, label } = range;
    const companyId = req.user?.companyId || null;

    // Check if exactly this range exists for this company
    const existing = await PowerRangeLibrary.findOne({
      companyId,
      sphMin, sphMax,
      cylMin, cylMax,
      addMin, addMax
    });

    if (!existing) {
      await PowerRangeLibrary.create({
        companyId,
        sphMin, sphMax,
        cylMin, cylMax,
        addMin, addMax,
        label,
        groupNames: (req.body.groupName || req.query.groupName) ? [(req.body.groupName || req.query.groupName)] : []
      });
      console.log(`Saved new range to library: ${label}`);
    } else if (req.body.groupName || req.query.groupName) {
      const gName = (req.body.groupName || req.query.groupName);
      if (!existing.groupNames) existing.groupNames = [];
      if (!existing.groupNames.includes(gName)) {
        existing.groupNames.push(gName);
        existing.markModified('groupNames');
        await existing.save();
      }
    }
  } catch (err) {
    console.error("Error saving to PowerRangeLibrary:", err);
  }
};

async function syncLensGroupToItems(lensGroup) {
  if (!lensGroup || !lensGroup.addGroups) return;

  const ops = [];
  lensGroup.addGroups.forEach(ag => {
    (ag.combinations || []).forEach(comb => {
      if (comb.barcode) {
        // Fallback to group prices if combination-specific prices are 0 or missing
        const pPrice = (comb.pPrice && comb.pPrice !== 0) ? comb.pPrice : (lensGroup.purchasePrice || 0);
        const sPrice = (comb.sPrice && comb.sPrice !== 0) ? comb.sPrice : (lensGroup.salePrice?.default || 0);

        ops.push({
          updateOne: {
            filter: { barcode: comb.barcode },
            update: { $set: { purchasePrice: pPrice, salePrice: sPrice } }
          }
        });
      }
    });
  });

  if (ops.length > 0) {
    await Item.bulkWrite(ops);
  }
}

// safe number parser
const parseNum = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

// RANGE GENERATOR
const createRange = (min, max, step) => {
  const list = [];
  min = parseNum(min);
  max = parseNum(max);
  step = parseNum(step);

  if (step === 0) return [parseFloat(min.toFixed(2))];

  let value = min;
  let safety = 0;

  // Ensure we include the max value even with floating point noise
  while (value <= (max + 0.000001) && safety < 2000) {
    list.push(parseFloat(value.toFixed(2)));
    value = parseFloat((value + step).toFixed(10));
    safety++;
  }

  return list;
};

const addLensPower = async (req, res) => {
  try {
    const {
      groupName,
      productName,

      sphMin,
      sphMax,
      sphStep,

      cylMin,
      cylMax,
      cylStep,

      addMin,
      addMax,
      addStep,

      axis,
      eye,
      generateBarcodes, // Optional flag to generate barcodes
    } = req.body;

    const sphMinNum = parseNum(sphMin);
    const sphMaxNum = parseNum(sphMax);
    const sphStepNum = sphStep === "" ? 0.25 : parseNum(sphStep);

    const cylMinNum = parseNum(cylMin);
    const cylMaxNum = parseNum(cylMax);
    const cylStepNum = cylStep === "" ? 0.25 : parseNum(cylStep);

    const addMinNum = parseNum(addMin);
    const addMaxNum = parseNum(addMax);
    const addStepNum = addStep === "" ? 0.25 : parseNum(addStep);

    const axisNum = parseNum(axis);

    // ---------------------------------------------
    // 1) CASE-INSENSITIVE PRODUCT NAME CHECK
    // ---------------------------------------------
    const companyId = req.user?.companyId || null;
    let lensGroup = await LensGroup.findOne({
      $or: [
        { companyId: companyId },
        { companyId: null }
      ],
      productName: { $regex: `^${escapeRegex(productName.trim())}$`, $options: "i" }
    });

    const isExisting = !!lensGroup;

    // ---------------------------------------------
    // 2) AUTO DETECT VISION TYPE
    // ---------------------------------------------
    const visionType =
      addMinNum === 0 && addMaxNum === 0 ? "single" : "bifocal";

    // Generate lists
    const sphList = createRange(sphMinNum, sphMaxNum, sphStepNum);
    const cylList = createRange(cylMinNum, cylMaxNum, cylStepNum);
    const addList = createRange(addMinNum, addMaxNum, addStepNum);

    // ---------------------------------------------
    // 4) GENERATE ADD GROUPS + COMBINATIONS
    // ---------------------------------------------
    const newAddGroups = [];
    const usedBarcodes = new Set();

    // Helper to generate unique barcode
    const generateBarcode = () => {
      const prefix = (productName || "LNS").substring(0, 3).toUpperCase();
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `${prefix}${timestamp}${random}`;
    };

    // Check if barcode exists in database
    const barcodeExists = async (barcode) => {
      const exists = await LensGroup.findOne({
        "addGroups.combinations.barcode": barcode,
      });
      return !!exists;
    };

    // If update, we should check existing combinations to avoid duplicates
    const findExistingComb = (oldAddGroups, addVal, sph, cyl, eye) => {
      if (!oldAddGroups || !Array.isArray(oldAddGroups)) return null;

      const addGroup = oldAddGroups.find(
        (g) => Math.abs(parseFloat(g.addValue) - parseFloat(addVal)) < 0.01
      );
      if (!addGroup || !addGroup.combinations) return null;

      return addGroup.combinations.find((c) => {
        const cSph = typeof c.sph === "string" ? parseFloat(c.sph) : c.sph;
        const cCyl = typeof c.cyl === "string" ? parseFloat(c.cyl) : c.cyl;
        return (
          Math.abs(cSph - parseFloat(sph)) < 0.01 &&
          Math.abs(cCyl - parseFloat(cyl)) < 0.01 &&
          c.eye === eye &&
          Math.abs((c.axis || 0) - axisNum) < 0.01
        );
      });
    };

    const currentAddGroups = isExisting ? lensGroup.addGroups : [];

    // New power group record
    const newPowerGroupRecord = {
      sphMin: sphMinNum,
      sphMax: sphMaxNum,
      sphStep: sphStepNum,
      cylMin: cylMinNum,
      cylMax: cylMaxNum,
      cylStep: cylStepNum,
      addMin: addMinNum,
      addMax: addMaxNum,
      addStep: addStepNum,
      axis: axisNum,
      eye: eye,
      label: `SPH(${sphMinNum} to ${sphMaxNum}) CYL(${cylMinNum} to ${cylMaxNum}) ADD(${addMinNum} to ${addMaxNum})`
    };

    // AUTO SAVE TO LIBRARY
    await saveToRangeLibrary(req, newPowerGroupRecord);

    let combinationsAdded = 0;

    for (let add of addList) {
      let group = isExisting ? currentAddGroups.find(g => Math.abs(g.addValue - add) < 0.01) : null;
      let combinations = [];
      let isNewGroup = false;

      if (!group) {
        group = { addValue: add, combinations: [] };
        isNewGroup = true;
      }

      for (let sph of sphList) {
        for (let cyl of cylList) {
          const eyeList = eye === "RL" ? ["R", "L"] : [eye];
          for (const eyeItem of eyeList) {
            const existingComb = findExistingComb(currentAddGroups, add, sph, cyl, eyeItem);

            if (!existingComb) {
              let barcode = "";
              // Generate barcode if requested
              if (generateBarcodes) {
                let attempts = 0;
                do {
                  barcode = generateBarcode();
                  attempts++;
                  if (!usedBarcodes.has(barcode)) {
                    const exists = await barcodeExists(barcode);
                    if (!exists) {
                      usedBarcodes.add(barcode);
                      break;
                    }
                  }
                } while (attempts < 100);
              }

              group.combinations.push({
                sph,
                cyl,
                axis: axisNum,
                eye: eyeItem,
                barcode,
                boxNo: "",
                alertQty: 0,
                pPrice: 0,
                sPrice: 0,
                initStock: 0,
              });
              combinationsAdded++;
            }
          }
        }
      }

      if (isExisting) {
        if (isNewGroup) {
          lensGroup.addGroups.push(group);
        }
        // If not isNewGroup, the combinations was already pushed to group which is a reference to lensGroup.addGroups element
      } else {
        newAddGroups.push(group);
      }
    }

    if (isExisting) {
      // Add the new power group record if it doesn't exist (same exact ranges)
      const groupExists = lensGroup.powerGroups.some(pg =>
        pg.sphMin === sphMinNum && pg.sphMax === sphMaxNum && pg.sphStep === sphStepNum &&
        pg.cylMin === cylMinNum && pg.cylMax === cylMaxNum && pg.cylStep === cylStepNum &&
        pg.addMin === addMinNum && pg.addMax === addMaxNum && pg.addStep === addStepNum &&
        pg.axis === axisNum && pg.eye === eye
      );

      if (!groupExists) {
        lensGroup.powerGroups.push(newPowerGroupRecord);
      }

      // Update master bounding ranges to encompass ALL combinations
      let allSphs = [];
      let allCyls = [];
      let allAdds = [];
      lensGroup.addGroups.forEach(g => {
        allAdds.push(parseFloat(g.addValue));
        g.combinations.forEach(c => {
          allSphs.push(parseFloat(c.sph));
          allCyls.push(parseFloat(c.cyl));
        });
      });

      if (allSphs.length > 0) {
        lensGroup.sphMin = Math.min(...allSphs);
        lensGroup.sphMax = Math.max(...allSphs);
      }
      if (allCyls.length > 0) {
        lensGroup.cylMin = Math.min(...allCyls);
        lensGroup.cylMax = Math.max(...allCyls);
      }
      if (allAdds.length > 0) {
        lensGroup.addMin = Math.min(...allAdds);
        lensGroup.addMax = Math.max(...allAdds);
      }

      await lensGroup.save();

      return res.status(200).json({
        success: true,
        message: combinationsAdded > 0 ? "Lens range added successfully!" : "Range already exists, power group record updated.",
        visionType: lensGroup.visionType,
        combinationsAdded,
        data: lensGroup,
      });
    } else {
      // ---------------------------------------------
      // 6) SAVE TO DB (New)
      // ---------------------------------------------
      const newLensGroup = await LensGroup.create({
        companyId,
        groupName,
        productName,

        sphMin: sphMinNum,
        sphMax: sphMaxNum,
        sphStep: sphStepNum,

        cylMin: cylMinNum,
        cylMax: cylMaxNum,
        cylStep: cylStepNum,

        addMin: addMinNum,
        addMax: addMaxNum,
        addStep: addStepNum,

        axis: axisNum,
        eye,
        visionType,

        addGroups: newAddGroups,
        powerGroups: [newPowerGroupRecord],
      });

      // ---------------------------------------------
      // 7) RESPONSE
      // ---------------------------------------------
      return res.status(200).json({
        success: true,
        message: "Lens group created successfully!",
        visionType,
        totalAddGroups: newAddGroups.length,
        totalCombinations: newAddGroups.reduce(
          (acc, g) => acc + g.combinations.length,
          0
        ),
        data: newLensGroup,
      });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Error while creating/updating product",
      error: err.message,
    });
  }
};

const getLensPower = async (req, res) => {
  try {
    const { id, productName, groupName } = { ...req.body, ...req.query };
    console.log(`[getLensPower] Searching for: ID(${id}), ProductName(${productName}), GroupName(${groupName})`);
    const companyId = req.user?.companyId || null;
    // -------------------------------------
    // 1) IF ID PROVIDED → DIRECT RETURN
    // -------------------------------------
    let lens = null;

    // -------------------------------------
    // 1) IF ID PROVIDED → DIRECT RETURN
    // -------------------------------------
    if (id) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        console.log(`[getLensPower] Invalid ID provided: ${id}`);
        return res.status(400).json({ success: false, message: "Invalid Lens ID format" });
      }
      lens = await LensGroup.findOne({
        _id: id,
        $or: [{ companyId }, { companyId: null }]
      });
    } else {
      // -------------------------------------
      // 2) IF NO ID → FIND BY PRODUCT NAME OR GROUP NAME
      // -------------------------------------
      let query = {
        $or: [{ companyId }, { companyId: null }]
      };
      if (productName && productName.trim() !== "") {
        query.productName = { $regex: `^${escapeRegex(productName.trim())}$`, $options: "i" };
      }
      if (groupName && groupName.trim() !== "") {
        query.groupName = { $regex: `^${escapeRegex(groupName.trim())}$`, $options: "i" };
      }
      if (!query.productName && !query.groupName) {
        return res.status(400).json({ message: "Product name or Group name is required" });
      }

      lens = await LensGroup.findOne(query);

      // Fallback: If both provided and not found, try productName alone
      if (!lens && productName && groupName) {
        console.log(`[getLensPower] Not found with both. Falling back to productName: ${productName}`);
        lens = await LensGroup.findOne({
          productName: { $regex: `^${escapeRegex(productName.trim())}$`, $options: "i" },
          $or: [{ companyId }, { companyId: null }]
        });
      }
    }

    if (!lens) {
      console.log(`[getLensPower] Initial lookup failed for ${productName}. Searching in Item collection...`);
      // check if it's at least an item
      const itm = await Item.findOne({ itemName: { $regex: `^${escapeRegex(productName || "")}$`, $options: "i" } });
      if (!itm) {
         return res.status(404).json({ success: false, message: "Lens not found in items" });
      }
      
      // It exists as an item! Create a synthetic LensGroup-like response
      lens = {
        _id: itm._id,
        productName: itm.itemName,
        groupName: itm.groupName,
        powerGroups: []
      };
    }

    // -------------------------------------
    // 3) FETCH VENDOR MAP
    // -------------------------------------
    const purchases = await LensPurchase.aggregate([
      { $match: { "items.itemName": lens.productName } },
      { $unwind: "$items" },
      { $match: { "items.itemName": lens.productName } },
      {
         $group: {
           _id: { sph: "$items.sph", cyl: "$items.cyl", add: "$items.add", eye: "$items.eye" },
           vendors: { $addToSet: "$partyData.partyAccount" }
         }
      }
    ]);

    const vendorMap = {};
    purchases.forEach(p => {
       const sph = Number(p._id.sph) || 0;
       const cyl = Number(p._id.cyl) || 0;
       const add = Number(p._id.add) || 0;
       let eye = (p._id.eye || "RL").toString().trim();
       if (eye === "R/L" || eye === "Both") eye = "RL";
       
       const key = `${sph}_${cyl}_${add}_${eye}`;
       vendorMap[key] = p.vendors.filter(v => v);
    });

    const resultObj = lens.toObject ? lens.toObject() : lens;
    
    // 3) FETCH LIBRARY RANGES (Strictly for this group) - DO NOT MERGE INTO powerGroups anymore
    // User requested only product-specific groups in the matrix filters.
    const gName = groupName || resultObj.groupName;
    let libraryRanges = [];
    if (gName) {
      libraryRanges = await PowerRangeLibrary.find({
        groupNames: gName,
        $or: [{ companyId }, { companyId: null }]
      });
    }

    // Initialize powerGroups if it doesn't exist
    if (!resultObj.powerGroups) resultObj.powerGroups = [];

    // Store library ranges separately so they don't pollute item-specific filters
    resultObj.libraryRanges = libraryRanges;

    // Final fallback: If still empty, add full range
    if (resultObj.powerGroups.length === 0) {
      resultObj.powerGroups.push({
        _id: resultObj._id,
        sphMin: resultObj.sphMin || -99,
        sphMax: resultObj.sphMax || 99,
        cylMin: resultObj.cylMin || -99,
        cylMax: resultObj.cylMax || 99,
        addMin: resultObj.addMin || 0,
        addMax: resultObj.addMax || 99,
        label: "Full Range (Default)",
        purchasePrice: resultObj.purchasePrice || 0,
        salePrice: resultObj.salePrice?.default || 0
      });
    }

    resultObj.vendorMap = vendorMap;

    // -------------------------------------
    // 4) RETURN LENS GROUP WITH VENDORS
    // -------------------------------------
    return res.json(resultObj);

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server Error" });
  }
};

const getPowerGroupsForProduct = async (req, res) => {
  try {
    const { productName } = req.query;
    const companyId = req.user?.companyId || null;

    if (!productName || productName.trim() === '') {
      return res.status(400).json({ success: false, message: 'Product name is required' });
    }

    const lensGroup = await LensGroup.findOne({
            productName: { $regex: `^${escapeRegex(productName.trim())}$`, $options: 'i' },

      $or: [{ companyId }, { companyId: null }]
    }).select('powerGroups productName').lean();

    if (!lensGroup) {
      return res.status(200).json({ success: true, data: [] });
    }

    const pgs = lensGroup.powerGroups || [];
    if (pgs.length === 0) {
      pgs.push({
        _id: lensGroup._id,
        sphMin: -99, sphMax: 99,
        cylMin: -99, cylMax: 99,
        addMin: 0, addMax: 99,
        label: "Full Range (Legacy)"
      });
    }

    return res.status(200).json({ success: true, data: pgs });
  } catch (err) {
    console.error('[getPowerGroupsForProduct] Error:', err);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};


const getAllLensPower = async (req, res) => {
  try {
    const companyId = req.user?.companyId || null;
    const lensPowers = await LensGroup.find({
      $or: [{ companyId }, { companyId: null }]
    });

    if (!lensPowers || lensPowers.length === 0) {
      return res.status(404).json({
        success: false,
        data: [],
        message: "No lens powers found",
      });
    }

    return res.status(200).json({
      success: true,
      data: lensPowers,
      message: "Lens powers fetched successfully",
    });
  } catch (err) {
    console.error("Error fetching lens powers:", err);
    return res.status(500).json({
      success: false,
      error: { message: "Server error while fetching lens powers" },
    });
  }
};

const editLensPower = async (req, res) => {
  try {
    const {
      id,
      groupName,
      productName,

      sphMin,
      sphMax,
      sphStep,

      cylMin,
      cylMax,
      cylStep,

      addMin,
      addMax,
      addStep,

      axis,
      eye,
      addGroups, // Accept addGroups from frontend
      powerGroups, // Added powerGroups
    } = req.body;

    console.log("Editing Lens Power ID:", id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Lens ID required",
      });
    }

    const companyId = req.user?.companyId || null;
    // -------- FETCH EXISTING LENS --------
    const existingLens = await LensGroup.findOne({
      _id: id,
      $or: [{ companyId }, { companyId: null }]
    });
    if (!existingLens) {
      return res.status(404).json({
        success: false,
        message: "Lens not found",
      });
    }

    // -------- SAFE PARSER --------
    const addMinNum = parseNum(addMin);
    const addMaxNum = parseNum(addMax);
    const addStepNum = parseNum(addStep);

    // Check if range definitions changed (requires thorough regeneration)
    const rangeChanged =
      existingLens.sphMin != sphMin ||
      existingLens.sphMax != sphMax ||
      existingLens.sphStep != sphStep ||
      existingLens.cylMin != cylMin ||
      existingLens.cylMax != cylMax ||
      existingLens.cylStep != cylStep ||
      existingLens.addMin != addMinNum ||
      existingLens.addMax != addMaxNum ||
      existingLens.addStep != addStepNum ||
      existingLens.eye != eye;

    // Detect price change
    if (req.body.salePrice && req.body.salePrice.default !== undefined) {
      if (existingLens.salePrice?.default !== parseFloat(req.body.salePrice.default)) {
        existingLens.isPriceUpdated = true;
      }
    }

    if (req.body.resetPriceHighlight) {
       existingLens.isPriceUpdated = false;
    }

    // -------- UPDATE BASIC FIELDS ALWAYS --------
    existingLens.groupName = groupName || existingLens.groupName;
    existingLens.productName = productName || existingLens.productName;
    existingLens.axis = axis !== undefined ? axis : existingLens.axis;
    existingLens.eye = eye || existingLens.eye;

    // Update prices if provided
    if (req.body.salePrice) existingLens.salePrice = req.body.salePrice;
    if (req.body.purchasePrice !== undefined) existingLens.purchasePrice = req.body.purchasePrice;

    // Always update powerGroups if provided
    if (powerGroups) {
      existingLens.powerGroups = powerGroups;
      existingLens.markModified("powerGroups");

      // AUTO SAVE NEW POWER GROUPS TO LIBRARY
      for (const pg of powerGroups) {
        if (!pg.label) {
          pg.label = `SPH(${pg.sphMin} to ${pg.sphMax}) CYL(${pg.cylMin} to ${pg.cylMax}) ADD(${pg.addMin} to ${pg.addMax})`;
        }
        await saveToRangeLibrary(req, pg);
      }
    }

    // Refresh bounding ranges from powerGroups
    if (existingLens.powerGroups && existingLens.powerGroups.length > 0) {
      try {
        const pgs = existingLens.powerGroups;
        const validNum = (v) => !isNaN(parseFloat(v)) ? parseFloat(v) : null;

        const sphMins = pgs.map(p => validNum(p.sphMin)).filter(v => v !== null);
        const sphMaxs = pgs.map(p => validNum(p.sphMax)).filter(v => v !== null);
        const cylMins = pgs.map(p => validNum(p.cylMin)).filter(v => v !== null);
        const cylMaxs = pgs.map(p => validNum(p.cylMax)).filter(v => v !== null);
        const addMins = pgs.map(p => validNum(p.addMin)).filter(v => v !== null);
        const addMaxs = pgs.map(p => validNum(p.addMax)).filter(v => v !== null);

        if (sphMins.length) existingLens.sphMin = Math.min(...sphMins);
        if (sphMaxs.length) existingLens.sphMax = Math.max(...sphMaxs);
        if (cylMins.length) existingLens.cylMin = Math.min(...cylMins);
        if (cylMaxs.length) existingLens.cylMax = Math.max(...cylMaxs);
        if (addMins.length) existingLens.addMin = Math.min(...addMins);
        if (addMaxs.length) existingLens.addMax = Math.max(...addMaxs);
      } catch (rangeErr) {
        console.warn("Could not recalculate bounding ranges:", rangeErr.message);
      }
    }

    // -------- IF RANGE DID NOT CHANGE → UPDATE addGroups IF PROVIDED --------
    if (!rangeChanged) {
      console.log("No range change detected, updating combinations...");
      if (addGroups && Array.isArray(addGroups) && addGroups.length > 0) {
        existingLens.addGroups = addGroups.map((ag) => ({
          addValue: ag.addValue,
          combinations: (ag.combinations || []).map((c) => ({
            sph: c.sph,
            cyl: c.cyl,
            axis: c.axis,
            eye: c.eye,
            barcode: c.barcode || "",
            boxNo: c.boxNo || "",
            alertQty: Number(c.alertQty) || 0,
            pPrice: Number(c.pPrice) || 0,
            sPrice: Number(c.sPrice) || 0,
            initStock: (c.initStock !== undefined && c.initStock !== null) ? Number(c.initStock) : 0,
            totalSoldQty: Number(c.totalSoldQty) || 0,
            totalSaleAmount: Number(c.totalSaleAmount) || 0,
            salesHistory: c.salesHistory || [],
            locations: c.locations || [], // PRESERVE LOCATIONS
            isVerified: c.isVerified || false,
            lastVerifiedDate: c.lastVerifiedDate || null,
            verifiedQty: c.verifiedQty || 0
          })),
        }));
        existingLens.markModified("addGroups");
      }

      await existingLens.save();
      await syncLensGroupToItems(existingLens);

      return res.json({
        success: true,
        message: "Lens updated successfully (meta/alerts updated).",
        data: existingLens,
      });
    }

    // ---------------------------------------------------
    // MERGE & REGENERATE IF RANGE CHANGED
    // ---------------------------------------------------
    console.log("Range changed, regenerating combinations...");
    const sphList = createRange(sphMin, sphMax, sphStep);
    const cylList = createRange(cylMin, cylMax, cylStep);
    const addListNum = createRange(addMinNum, addMaxNum, addStepNum);

    const mergedGroupsMap = new Map();

    if (addGroups && Array.isArray(addGroups)) {
      addGroups.forEach(g => {
        const key = parseFloat(g.addValue).toFixed(2);
        mergedGroupsMap.set(key, {
          addValue: g.addValue,
          combinations: [...(g.combinations || [])]
        });
      });
    }

    for (let add of addListNum) {
      const addKey = parseFloat(add).toFixed(2);
      if (!mergedGroupsMap.has(addKey)) {
        mergedGroupsMap.set(addKey, { addValue: add, combinations: [] });
      }
      const group = mergedGroupsMap.get(addKey);

      for (let sph of sphList) {
        for (let cyl of cylList) {
          const eyeList = (eye === "RL" || !eye) ? ["R", "L"] : [eye];
          for (const eyeItem of eyeList) {
            const exists = group.combinations.some(c =>
              Math.abs(parseFloat(c.sph) - parseFloat(sph)) < 0.01 &&
              Math.abs(parseFloat(c.cyl) - parseFloat(cyl)) < 0.01 &&
              c.eye === eyeItem
            );

            if (!exists) {
              group.combinations.push({
                sph,
                cyl,
                axis: axis || 0,
                eye: eyeItem,
                barcode: "",
                boxNo: "",
                alertQty: 0,
                pPrice: 0,
                sPrice: 0,
                initStock: 0,
              });
            }
          }
        }
      }
    }

    const finalAddGroups = Array.from(mergedGroupsMap.values());
    existingLens.addGroups = finalAddGroups;
    existingLens.markModified("addGroups");

    // Recalculate ranges for storage
    let allSphs = [], allCyls = [], allAdds = [];
    finalAddGroups.forEach(g => {
      allAdds.push(parseFloat(g.addValue));
      g.combinations.forEach(c => {
        allSphs.push(parseFloat(c.sph));
        allCyls.push(parseFloat(c.cyl));
      });
    });

    if (allSphs.length) {
      existingLens.sphMin = Math.min(...allSphs);
      existingLens.sphMax = Math.max(...allSphs);
    }
    if (allCyls.length) {
      existingLens.cylMin = Math.min(...allCyls);
      existingLens.cylMax = Math.max(...allCyls);
    }
    if (allAdds.length) {
      existingLens.addMin = Math.min(...allAdds);
      existingLens.addMax = Math.max(...allAdds);
    }

    existingLens.visionType = (existingLens.addMin === 0 && existingLens.addMax === 0) ? "single" : "bifocal";

    await existingLens.save();
    await syncLensGroupToItems(existingLens);

    return res.json({
      success: true,
      message: "Lens ranges regenerated and updated successfully!",
      totalAddGroups: finalAddGroups.length,
      data: existingLens,
    });

  } catch (err) {
    console.error("Error in editLensPower:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during lens update",
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

const removeLensPower = async (req, res) => {
  try {
    const { id, productName } = req.body;
    const companyId = req.user?.companyId || null;

    // --- DELETE BY ID ---
    if (id) {
      const deletedLens = await LensGroup.findOneAndDelete({
        _id: id,
        $or: [{ companyId }, { companyId: null }]
      });

      if (!deletedLens) {
        return res.status(404).json({ message: "Lens not found" });
      }

      return res.status(200).json({
        message: "Lens deleted successfully",
        deletedLens,
      });
    }

    // --- DELETE BY UNIQUE PRODUCT NAME ---
    if (!productName) {
      return res
        .status(400)
        .json({ message: "productName is required for deletion" });
    }

    const deletedLens = await LensGroup.findOneAndDelete({
      productName,
      $or: [{ companyId }, { companyId: null }]
    });

    if (!deletedLens) {
      return res.status(404).json({ message: "Lens not found" });
    }

    return res.status(200).json({
      message: "Lens deleted successfully",
      deletedLens,
    });
  } catch (err) {
    console.error("Error deleting lens:", err);
    return res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
};

// Check if barcode exists in any combination
const checkBarcodeExists = async (req, res) => {
  try {
    const { barcode, excludeLensId } = req.body;

    if (!barcode || barcode.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Barcode is required",
      });
    }

    // Build query to find barcode in any combination
    const query = {
      "addGroups.combinations.barcode": barcode.trim(),
    };

    // Exclude current lens if provided
    if (excludeLensId) {
      query._id = { $ne: excludeLensId };
    }

    const existing = await LensGroup.findOne(query);

    return res.status(200).json({
      success: true,
      exists: !!existing,
      message: existing ? "Barcode already exists" : "Barcode is available",
    });
  } catch (err) {
    console.error("Error checking barcode:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while checking barcode",
      error: err.message,
    });
  }
};

// Generate unique barcode
const generateUniqueBarcode = async (req, res) => {
  try {
    const { prefix, excludeLensId } = req.body;

    // Generate barcode with prefix + timestamp + random number
    const timestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    let barcode = prefix ? `${prefix}${timestamp}${random}` : `${timestamp}${random}`;

    // Ensure uniqueness
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      const query = {
        "addGroups.combinations.barcode": barcode,
      };

      if (excludeLensId) {
        query._id = { $ne: excludeLensId };
      }

      const exists = await LensGroup.findOne(query);

      if (!exists) {
        return res.status(200).json({
          success: true,
          barcode,
          message: "Unique barcode generated",
        });
      }

      // Regenerate if exists
      const newRandom = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      barcode = prefix ? `${prefix}${timestamp}${newRandom}` : `${timestamp}${newRandom}`;
      attempts++;
    }

    return res.status(500).json({
      success: false,
      message: "Failed to generate unique barcode after multiple attempts",
    });
  } catch (err) {
    console.error("Error generating barcode:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while generating barcode",
      error: err.message,
    });
  }
};

const verifyLensStock = async (req, res) => {
  try {
    const { verifications } = req.body; // Array of { barcode, receivedQty }

    if (!verifications || !Array.isArray(verifications)) {
      return res.status(400).json({
        success: false,
        message: "Verifications array is required",
      });
    }

    const verificationDate = new Date();
    const results = [];

    for (const v of verifications) {
      const { barcode, receivedQty } = v;

      // Find the lens group and combination containing this barcode
      const lensGroup = await LensGroup.findOne({
        "addGroups.combinations.barcode": barcode,
      });

      if (lensGroup) {
        let updated = false;
        // Update the specific combination
        for (let ag of lensGroup.addGroups) {
          for (let comb of ag.combinations) {
            if (comb.barcode === barcode) {
              comb.isVerified = true;
              comb.lastVerifiedDate = verificationDate;
              comb.verifiedQty = receivedQty;
              updated = true;
              break;
            }
          }
          if (updated) break;
        }

        if (updated) {
          await lensGroup.save();
          results.push({ barcode, status: "success" });
        } else {
          results.push({ barcode, status: "failed", message: "Combination not found" });
        }
      } else {
        results.push({ barcode, status: "failed", message: "Barcode not found" });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Stock verification completed",
      data: results,
      verificationDate
    });
  } catch (err) {
    console.error("Error verifying lens stock:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during stock verification",
      error: err.message,
    });
  }
};

const getMissingLenses = async (req, res) => {
  try {
    const { barcodes: barcodesStr } = req.query;
    if (!barcodesStr) {
      return res.status(200).json({ success: true, data: [] });
    }

    const barcodes = barcodesStr.split(',');
    const results = [];

    for (const barcode of barcodes) {
      if (!barcode) continue;

      const lensGroup = await LensGroup.findOne({
        "addGroups.combinations.barcode": barcode,
      });

      if (lensGroup) {
        let found = false;
        for (let ag of lensGroup.addGroups) {
          for (let comb of ag.combinations) {
            if (comb.barcode === barcode) {
              const item = await Item.findOne({ barcode: barcode });
              results.push({
                barcode,
                itemName: lensGroup.productName,
                unit: item?.unit || "PCS",
                eye: comb.eye || "",
                sph: comb.sph ?? 0,
                cyl: comb.cyl ?? 0,
                axis: comb.axis || 0,
                add: ag.addValue ?? 0,
                dia: item?.dia || "",
                price: comb.pPrice || lensGroup.purchasePrice || 0,
                stock: (comb.initStock || 0) - (comb.totalSoldQty || 0),
              });
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: results
    });
  } catch (err) {
    console.error("Error fetching missing lenses:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching missing lenses",
      error: err.message,
    });
  }
};

const getPowerRangeLibrary = async (req, res) => {
  try {
    const { groupName } = req.query;
    const companyId = req.user?.companyId || null;
    
    let query = { companyId };
    if (groupName && groupName.trim() !== "") {
      query.groupNames = groupName.trim();
    }
    
    const ranges = await PowerRangeLibrary.find(query).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: ranges
    });
  } catch (error) {
    console.error("Error fetching PowerRangeLibrary:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};

const resetAllLensPriceHighlights = async (req, res) => {
  try {
    const companyId = req.user?.companyId || null;
    await LensGroup.updateMany(
      { $or: [{ companyId }, { companyId: null }], isPriceUpdated: true },
      { $set: { isPriceUpdated: false } }
    );
    return res.status(200).json({ success: true, message: "All price highlights reset" });
  } catch (err) {
     console.error("Error in resetAllLensPriceHighlights:", err);
     return res.status(500).json({ success: false, message: "Server Error" });
  }
}

const updateLensGroupLocations = async (req, res) => {
  try {
     const { productName, locationsToSave } = req.body;
     const companyId = req.user?.companyId || null;

     if (!productName || !locationsToSave) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
     }

     const lensGroup = await LensGroup.findOne({
        productName: { $regex: `^${productName.trim()}$`, $options: 'i' },
        $or: [{ companyId }, { companyId: null }]
     });

     if (!lensGroup) {
        return res.status(404).json({ success: false, message: "Lens group not found" });
     }

     for (const update of locationsToSave) {
        const { sph, cyl, eye, add, locations, locationQty } = update;
        const targetAdd = Number(add);
        const targetSph = Number(sph);
        const targetCyl = Number(cyl);

        const addGroup = (lensGroup.addGroups || []).find(ag => Math.abs(ag.addValue - targetAdd) < 0.001);
        if (addGroup) {
           const combo = (addGroup.combinations || []).find(c => 
              Math.abs(c.sph - targetSph) < 0.001 &&
              Math.abs(c.cyl - targetCyl) < 0.001 &&
              c.eye === eye
           );
           if (combo) {
              if (locations !== undefined) {
                 combo.locations = locations || [];
              }
              if (locationQty !== undefined) {
                 combo.locationQty = locationQty;
              }
           }
        }
     }

     lensGroup.markModified("addGroups");
     await lensGroup.save();

     return res.status(200).json({ success: true, message: "Locations updated successfully" });

  } catch (err) {
     console.error("Error in updateLensGroupLocations:", err);
     return res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * GET /api/lensGroup/getCombinationStock
 * Body: { productName, sph, cyl, add, eye }
 */
const getCombinationStock = async (req, res) => {
  try {
     const { productName, sph, cyl, add, eye } = req.body;
     const companyId = req.user?.companyId || null;

     if (!productName) return res.status(400).json({ success: false, message: "Product name required" });

     const targetAdd = Number(add);
     const targetSph = Number(sph);
     const targetCyl = Number(cyl);
     const targetEye = String(eye || "").toUpperCase().trim();
     const targetAxis = Number(req.body.axis || 0);
     const targetEyes = (["RL", "R/L", "BOTH", "BOTH EYE", "PAIR"].includes(targetEye)) 
        ? ["RL", "R/L", "BOTH", "BOTH EYE", "PAIR", "R", "L", ""] 
        : [targetEye];

     const lensGroups = await LensGroup.find({
        productName: { $regex: new RegExp(`^${productName.trim()}$`, "i") },
        $or: [{ companyId }, { companyId: null }]
     });

     let stock = 0;
     let barcode = "";
     for (const lg of lensGroups) {
        const ag = (lg.addGroups || []).find(g => Math.abs(Number(g.addValue) - targetAdd) < 0.001);
        if (ag) {
           const matchingCombs = (ag.combinations || []).filter(c => 
              Math.abs(Number(c.sph) - targetSph) < 0.001 &&
              Math.abs(Number(c.cyl) - targetCyl) < 0.001 &&
              Math.abs(Number(c.axis || 0) - targetAxis) < 0.001 &&
              targetEyes.includes(String(c.eye || "").toUpperCase().trim())
           );
           stock += matchingCombs.reduce((sum, c) => sum + Number(c.initStock || 0), 0);
           if (!barcode && matchingCombs.length > 0) {
              barcode = matchingCombs[0].barcode || "";
           }
        }
     }

     return res.status(200).json({ success: true, stock, barcode });

  } catch (err) {
     console.error("Error in getCombinationStock:", err);
     return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export {
  addLensPower,
  getLensPower,
  getAllLensPower,
  removeLensPower,
  editLensPower,
  checkBarcodeExists,
  generateUniqueBarcode,
  verifyLensStock,
  getMissingLenses,
  getPowerRangeLibrary,
  getPowerGroupsForProduct,
  resetAllLensPriceHighlights,
  updateLensGroupLocations,
  getCombinationStock,
};

