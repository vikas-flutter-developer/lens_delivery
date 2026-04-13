import LensGroup from "../models/LensGroup.js";
import Item from "../models/Item.js";
import PowerRangeLibrary from "../models/PowerRangeLibrary.js";

async function syncLensGroupToItems(lensGroup) {
  if (!lensGroup || !lensGroup.addGroups) return;

  const ops = [];
  const topPPrice = lensGroup.purchasePrice || 0;
  const topSPrice = lensGroup.salePrice?.default || 0;

  let groupUpdated = false;

  lensGroup.addGroups.forEach(ag => {
    (ag.combinations || []).forEach(comb => {
      // Find which power group this combination belongs to
      let pPrice = topPPrice;
      let sPrice = topSPrice;

      // Find the specific power group that covers this combination
      const pg = (lensGroup.powerGroups || []).find(g => {
        const sph = comb.sph || 0;
        const cyl = comb.cyl || 0;
        const add = ag.addValue || 0;

        return (
          sph >= (g.sphMin || -99) && sph <= (g.sphMax || 99) &&
          cyl >= (g.cylMin || -99) && cyl <= (g.cylMax || 99) &&
          add >= (g.addMin || 0) && add <= (g.addMax || 99)
        );
      });

      if (pg) {
        pPrice = pg.purchasePrice || pPrice;
        sPrice = pg.salePrice || sPrice;
      }

      // Sync combination prices
      if (comb.pPrice !== pPrice || comb.sPrice !== sPrice) {
        comb.pPrice = pPrice;
        comb.sPrice = sPrice;
        groupUpdated = true;
      }

      if (comb.barcode) {
        ops.push({
          updateOne: {
            filter: { barcode: comb.barcode },
            update: { $set: { purchasePrice: pPrice, salePrice: sPrice } }
          }
        });
      }
    });
  });

  if (groupUpdated) {
    await LensGroup.updateOne({ _id: lensGroup._id }, { $set: { addGroups: lensGroup.addGroups } });
  }

  if (ops.length > 0) {
    await Item.bulkWrite(ops);
  }
}

const editLensRate = async (req, res) => {
  try {
    const { id, powerGroupId, purchasePrice, salePrice } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Product id is required" });
    }

    let lens = await LensGroup.findById(id);
    if (!lens) {
      // Fallback: Check if it's an Item ID but not yet in LensGroup
      const itm = await Item.findById(id);
      if (itm) {
        // Auto-create LensGroup record for this item
        lens = new LensGroup({
          _id: itm._id,
          productName: itm.itemName,
          groupName: itm.groupName,
          visionType: "single", // Default value to satisfy schema requirement
          companyId: req.user?.companyId || null,
          powerGroups: []
        });
      } else {
        return res.status(404).json({ message: "Product not found" });
      }
    }

    if (powerGroupId) {
      // Update specific power group
      let pg = lens.powerGroups.id(powerGroupId);
      if (!pg) {
          // If not in lens, find in library and import it
          const libRange = await PowerRangeLibrary.findById(powerGroupId);
          if (libRange) {
              lens.powerGroups.push({
                  _id: libRange._id,
                  sphMin: libRange.sphMin, sphMax: libRange.sphMax,
                  cylMin: libRange.cylMin, cylMax: libRange.cylMax,
                  addMin: libRange.addMin, addMax: libRange.addMax,
                  label: libRange.label,
                  purchasePrice: 0, salePrice: 0
              });
              pg = lens.powerGroups.id(powerGroupId);
          } else {
              return res.status(404).json({ message: "Power group not found in lens or library" });
          }
      }

      const pPrice = typeof purchasePrice === 'object' ? purchasePrice.default : (purchasePrice || 0);
      const sPrice = typeof salePrice === 'object' ? salePrice.default : (salePrice || 0);

      if (pPrice !== undefined && !isNaN(parseFloat(pPrice))) pg.purchasePrice = parseFloat(pPrice);
      if (sPrice !== undefined && !isNaN(parseFloat(sPrice))) pg.salePrice = parseFloat(sPrice);
      
      lens.isPriceUpdated = true;
    } else {
      // Legacy behavior: update top level prices
      if (salePrice && salePrice.default !== undefined) {
        if (lens.salePrice?.default !== parseFloat(salePrice.default)) {
          lens.isPriceUpdated = true;
        }
      }
      lens.purchasePrice = purchasePrice !== undefined ? purchasePrice : lens.purchasePrice;
      lens.salePrice = salePrice !== undefined ? salePrice : lens.salePrice;
    }

    await lens.save();
    await syncLensGroupToItems(lens);

    res.status(200).json({ message: "Lens rate updated successfully", lens });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
const syncAllLensesToItems = async (req, res) => {
  try {
    const allLenses = await LensGroup.find();
    console.log(`Starting global sync for ${allLenses.length} lenses...`);

    for (const lens of allLenses) {
      await syncLensGroupToItems(lens);
    }

    res.status(200).json({
      success: true,
      message: `Successfully synchronized ${allLenses.length} lenses to items.`
    });
  } catch (err) {
    console.error("Global sync error:", err);
    res.status(500).json({ success: false, message: "Sync failed", error: err.message });
  }
};

export {
  editLensRate,
  syncAllLensesToItems,
};
