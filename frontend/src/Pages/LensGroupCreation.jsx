import React, { useState, useRef, useEffect } from "react";
import { addGroup, getAllGroups } from "../controllers/groupcontroller";
import { getAllItems } from "../controllers/itemcontroller";
import { addLenspower, editLensPower, generateUniqueBarcode, checkBarcodeExists } from "../controllers/LensGroupCreationController";
import { getLensPower } from "../controllers/LensGroupCreationController";
import { removeLensPower } from "../controllers/LensGroupCreationController";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import { Pencil, Trash, RotateCcw, Plus, Eye, QrCode, Copy, Grid3X3, BookOpen, Check } from "lucide-react";
import AlertQtyMatrixModal from "../Components/AlertQtyMatrixModal";
import StockQtyMatrixModal from "../Components/StockQtyMatrixModal";
import { getPowerRangeLibrary } from "../controllers/LensGroupCreationController";

function LensGroupCreation({ hideHeader = false }) {
  // newData will hold the full lens object returned by backend (or null)
  const [newData, setNewData] = useState(null);
  const [formData, setFormData] = useState({
    groupName: "",
    productName: "",
    vendorItemName: "",
    billItemName: "",
    sphMin: "",
    sphMax: "",
    sphStep: "0.25",
    cylMin: "",
    cylMax: "",
    cylStep: "0.25",
    axis: "",
    addMin: "",
    addMax: "",
    addStep: "0.25",
    eye: "",
    powerGroups: [],
    activeGroupIdx: null
  });

  // Power Range Library States
  const [libraryRanges, setLibraryRanges] = useState([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [selectedLibraryRanges, setSelectedLibraryRanges] = useState([]);
  const [libraryCheckboxes, setLibraryCheckboxes] = useState({
    sph: true,
    cyl: true,
    add: true
  });

  // State for Power Group Inputs
  const [pgInputs, setPgInputs] = useState({
    sph: { min: "", max: "" },
    cyl: { min: "", max: "" },
    add: { min: "", max: "" }
  });

  // Generate unique barcode for a combination
  const generateBarcodeForCombination = async (prefix = "") => {
    try {
      const res = await generateUniqueBarcode({
        prefix: prefix || formData.productName?.substring(0, 3).toUpperCase() || "LNS",
        excludeLensId: newData?._id || null
      });

      if (res.success && res.barcode) {
        return res.barcode;
      }
      // Fallback: generate client-side barcode if API fails
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `${prefix || "LNS"}${timestamp}${random}`;
    } catch (err) {
      console.error("Error generating barcode:", err);
      // Fallback: generate client-side barcode
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `${prefix || "LNS"}${timestamp}${random}`;
    }
  };

  // Generate barcodes for all combinations in newData
  const handleGenerateBarcodes = async () => {
    if (!newData || !newData.addGroups || newData.addGroups.length === 0) {
      toast.error("Please load or create a lens power first");
      return;
    }

    try {
      toast.loading("Generating unique barcodes...", { id: "barcode-gen" });

      // Create deep copy to ensure React detects the change
      const updated = JSON.parse(JSON.stringify(newData));
      const prefix = formData.productName?.substring(0, 3).toUpperCase() || "LNS";
      const usedBarcodes = new Set();
      const sharedBarcodeMap = new Map();
      const isDualEye = formData.eye === "RL" || formData.eye === "R/L" || formData.eye === "BOTH" || !formData.eye;

      // Generate barcodes for all combinations
      for (const addGroup of updated.addGroups) {
        if (!addGroup.combinations || addGroup.combinations.length === 0) continue;

        for (const comb of addGroup.combinations) {
          // Skip if already has a barcode
          if (comb.barcode && comb.barcode.trim() !== "") {
            usedBarcodes.add(comb.barcode);
            continue;
          }

          const sharedKey = isDualEye ? `${addGroup.addValue}_${parseFloat(comb.sph).toFixed(2)}_${parseFloat(comb.cyl).toFixed(2)}_${comb.axis || 0}` : null;
          if (sharedKey && sharedBarcodeMap.has(sharedKey)) {
            comb.barcode = sharedBarcodeMap.get(sharedKey);
            continue;
          }

          // Generate unique barcode
          let barcode;
          let attempts = 0;
          const maxAttempts = 50;

          do {
            barcode = await generateBarcodeForCombination(prefix);
            attempts++;

            // Check if barcode is already used in this batch
            if (usedBarcodes.has(barcode) && attempts < maxAttempts) {
              // Add small delay and retry
              await new Promise(resolve => setTimeout(resolve, 10));
              continue;
            }

            // Check if barcode exists in database
            const checkRes = await checkBarcodeExists({
              barcode,
              excludeLensId: newData._id || null
            });

            if (checkRes.success && !checkRes.exists) {
              break; // Unique barcode found
            }

            // If exists, wait and try again
            await new Promise(resolve => setTimeout(resolve, 10));
          } while (attempts < maxAttempts);

          comb.barcode = barcode;
          usedBarcodes.add(barcode);
          if (sharedKey) {
            sharedBarcodeMap.set(sharedKey, barcode);
          }
        }
      }

      setNewData(updated);
      toast.success("Barcodes generated successfully! Click 'Update' to save.", { id: "barcode-gen" });
    } catch (err) {
      console.error("Error generating barcodes:", err);
      toast.error("Failed to generate barcodes", { id: "barcode-gen" });
    }
  };

  const handleCreateLensPower = async () => {
    try {
      const group = formData.groupName?.trim();
      if (!group) {
        toast.error("Group name is required to create a lens");
        return;
      }
      const prod = formData.productName?.trim();
      if (!prod) {
        toast.error("Product name is required to create a lens");
        return;
      }

      // No longer error if product exists, as backend now handles merging ranges
      // const nameCheckRes = await getLensPower({ productName: prod });

      // ---------------------------------------------
      // AUTO-MERGE SELECTED LIBRARY RANGES
      // ---------------------------------------------
      let finalSphMin = formData.sphMin === "" ? 0 : Number(formData.sphMin);
      let finalSphMax = formData.sphMax === "" ? 0 : Number(formData.sphMax);
      let finalCylMin = formData.cylMin === "" ? 0 : Number(formData.cylMin);
      let finalCylMax = formData.cylMax === "" ? 0 : Number(formData.cylMax);
      let finalAddMin = formData.addMin === "" ? 0 : Number(formData.addMin);
      let finalAddMax = formData.addMax === "" ? 0 : Number(formData.addMax);

      if (selectedLibraryRanges.length > 0) {
        const merged = getMergedPreview();
        if (libraryCheckboxes.sph) {
          finalSphMin = merged.sphMin;
          finalSphMax = merged.sphMax;
        }
        if (libraryCheckboxes.cyl) {
          finalCylMin = merged.cylMin;
          finalCylMax = merged.cylMax;
        }
        if (libraryCheckboxes.add) {
          finalAddMin = merged.addMin;
          finalAddMax = merged.addMax;
        }

        // Sync back to form so UI reflects the creation
        setFormData(prev => ({
          ...prev,
          sphMin: finalSphMin,
          sphMax: finalSphMax,
          cylMin: finalCylMin,
          cylMax: finalCylMax,
          addMin: finalAddMin,
          addMax: finalAddMax
        }));
        setSelectedLibraryRanges([]);
        toast.success("Using combined power range from library");
      }

      const cleanData = {
        groupName: formData.groupName,
        productName: prod,
        vendorItemName: formData.vendorItemName || "",
        billItemName: formData.billItemName || "",

        sphMin: finalSphMin,
        sphMax: finalSphMax,
        sphStep:
          formData.sphStep === "" ? 0.25 : Number(formData.sphStep),

        cylMin: finalCylMin,
        cylMax: finalCylMax,
        cylStep:
          formData.cylStep === "" ? 0.25 : Number(formData.cylStep),

        addMin: finalAddMin,
        addMax: finalAddMax,
        addStep:
          formData.addStep === "" ? 0.25 : Number(formData.addStep),

        axis: formData.axis === "" ? 0 : Number(formData.axis),

        eye: formData.eye === "" ? "RL" : formData.eye,
        generateBarcodes: addBarcodeWithPower, // Send flag to backend
        powerGroups: formData.powerGroups, // Added powerGroups
      };

      const res = await addLenspower(cleanData);

      if (!res) {
        toast.error("Something went wrong!");
        return;
      }

      if (res.success === false) {
        // server will send proper message for duplicate name or duplicate combination
        toast.error(res.message || "Already exists!");
        return;
      }

      if (res.success === true) {
        toast.success("Lens Power Created Successfully!");
        const lensData = res.data || null;
        setNewData(lensData);
        if (lensData && Array.isArray(lensData.powerGroups)) {
          setFormData(prev => ({
            ...prev,
            powerGroups: lensData.powerGroups,
            activeGroupIdx: lensData.powerGroups.length - 1
          }));
        }
        setShowDetails(true);

        // Generate barcodes if checkbox is checked
        if (addBarcodeWithPower && lensData) {
          // Set the data first, then generate barcodes
          setTimeout(async () => {
            await handleGenerateBarcodes();
          }, 500);
        }
        fetchLibrary(formData.groupName);
        return;
      }

      toast.error("Unexpected response!");
    } catch (err) {
      toast.error("Failed to create Lens Power!");
      console.log(err);
    }
  };

  const handleEditLens = async () => {
    try {
      if (!newData || !newData._id) {
        toast.error("First load a lens group to edit.");
        return;
      }

      const prod = formData.productName?.trim();
      if (!prod) {
        toast.error("Product name is required");
        return;
      }

      // ---------------------------------------------
      // AUTO-MERGE SELECTED LIBRARY RANGES
      // ---------------------------------------------
      let finalSphMin = formData.sphMin === "" ? 0 : Number(formData.sphMin);
      let finalSphMax = formData.sphMax === "" ? 0 : Number(formData.sphMax);
      let finalCylMin = formData.cylMin === "" ? 0 : Number(formData.cylMin);
      let finalCylMax = formData.cylMax === "" ? 0 : Number(formData.cylMax);
      let finalAddMin = formData.addMin === "" ? 0 : Number(formData.addMin);
      let finalAddMax = formData.addMax === "" ? 0 : Number(formData.addMax);

      if (selectedLibraryRanges.length > 0) {
        const merged = getMergedPreview();
        if (libraryCheckboxes.sph) {
          finalSphMin = merged.sphMin;
          finalSphMax = merged.sphMax;
        }
        if (libraryCheckboxes.cyl) {
          finalCylMin = merged.cylMin;
          finalCylMax = merged.cylMax;
        }
        if (libraryCheckboxes.add) {
          finalAddMin = merged.addMin;
          finalAddMax = merged.addMax;
        }

        // Sync back to form
        setFormData(prev => ({
          ...prev,
          sphMin: finalSphMin,
          sphMax: finalSphMax,
          cylMin: finalCylMin,
          cylMax: finalCylMax,
          addMin: finalAddMin,
          addMax: finalAddMax
        }));
        setSelectedLibraryRanges([]);
        toast.success("Using combined power range from library");
      }

      // CLEAN FORM DATA (same as create)
      const cleanForm = {
        groupName: formData.groupName,
        productName: prod,
        vendorItemName: formData.vendorItemName || "",
        billItemName: formData.billItemName || "",

        sphMin: finalSphMin,
        sphMax: finalSphMax,
        sphStep:
          formData.sphStep === "" ? 0.25 : Number(formData.sphStep),

        cylMin: finalCylMin,
        cylMax: finalCylMax,
        cylStep:
          formData.cylStep === "" ? 0.25 : Number(formData.cylStep),

        addMin: finalAddMin,
        addMax: finalAddMax,
        addStep:
          formData.addStep === "" ? 0.25 : Number(formData.addStep),

        axis: formData.axis === "" ? 0 : Number(formData.axis),

        eye: formData.eye === "" ? "RL" : formData.eye,
        powerGroups: formData.powerGroups, // Added powerGroups
      };

      // Deep copy addGroups to ensure barcodes are included
      const addGroupsToSend = JSON.parse(JSON.stringify(newData.addGroups || []));

      const updatePayload = {
        id: newData._id,
        ...cleanForm,
        addGroups: addGroupsToSend,
      };

      // --- CALL BACKEND EDIT API ---
      console.log("Updating with addGroups:", JSON.stringify(addGroupsToSend.slice(0, 1), null, 2)); // Log first group for debugging
      const res = await editLensPower(updatePayload);

      if (!res) {
        toast.error("Something went wrong!");
        return;
      }

      if (res.success === false) {
        toast.error(res.message || "Update failed");
        return;
      }

      if (res.success === true) {
        toast.success("Lens Power Updated Successfully!");
        setNewData(res.data || newData); // refresh state with latest DB object
        fetchLibrary(formData.groupName);
        return;
      }

      toast.error("Unexpected response!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update Lens Power!");
    }
  };


  const handleDeleteLensPower = async () => {
    // confirm first
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this lens power?"
    );
    if (!confirmDelete) return;

    try {
      // prefer id if available, else use productName
      const payload = {};
      // if user selected an item from loaded data, newData might exist with _id
      if (newData && newData._id) {
        payload.id = newData._id;
      } else if (formData.productName && formData.productName.trim()) {
        payload.productName = formData.productName.trim();
      } else {
        toast.error("Provide product name or load the product first");
        return;
      }

      const res = await removeLensPower(payload);

      if (!res) {
        toast.error("Something went wrong while deleting");
        return;
      }

      if (res.success) {
        toast.success(res.data?.message || "Lens group deleted successfully");
        // reset UI a bit
        setNewData(null);
        setLensPower(null);
        setShowDetails(false);
        setEditingGroupId(null);
        setEditValues({});
        // optional reload or fresh fetch
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        toast.error(res.message || res.error?.message || "Delete failed");
        console.error("Delete error:", res.error || res);
      }
    } catch (err) {
      toast.error("Failed to delete lens power");
      console.error(err);
    }
  };

  const [editingGroupId, setEditingGroupId] = useState(null);

  // --- Matrix Modal State & Handlers ---
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [showStockMatrixModal, setShowStockMatrixModal] = useState(false);


  const handleOpenMatrix = () => {
    setShowMatrixModal(true);
  };

  const handleOpenStockMatrix = () => {
    setShowStockMatrixModal(true);
  };

  const handleSaveMatrix = async (editedMap) => {
    if (!newData) return;

    // Create a copy to update
    // We cannot use newData directly, must use the backend format
    const updated = JSON.parse(JSON.stringify(newData));

    // Iterate over all addGroups in the updated object
    let hasChanges = false;
    updated.addGroups = updated.addGroups.map(group => {
      // Check if this group has any edited values
      // The keys in editedMap are: `${groupId}_${c.sph}_${c.cyl}_${c.eye || ''}`
      const newCombinations = group.combinations.map(c => {
        const key = `${group._id}_${c.sph}_${c.cyl}_${c.eye || ''}`;
        if (editedMap[key] !== undefined) {
          hasChanges = true;
          return { ...c, alertQty: Number(editedMap[key]) };
        }
        return c;
      });

      return { ...group, combinations: newCombinations };
    });

    if (!hasChanges) {
      toast.success("No changes detected");
      setShowMatrixModal(false);
      return;
    }

    try {
      toast.loading("Saving matrix changes...", { id: "save-matrix" });

      const updatePayload = {
        id: updated._id,
        groupName: updated.groupName,
        productName: updated.productName,
        sphMin: updated.sphMin,
        sphMax: updated.sphMax,
        sphStep: updated.sphStep,
        cylMin: updated.cylMin,
        cylMax: updated.cylMax,
        cylStep: updated.cylStep,
        addMin: updated.addMin,
        addMax: updated.addMax,
        addStep: updated.addStep,
        axis: updated.axis,
        eye: updated.eye,
        addGroups: updated.addGroups, // This contains the updated alerts
      };

      const res = await editLensPower(updatePayload);

      if (res && res.success) {
        setNewData(res.data);
        toast.success("Alert Quantities Updated!", { id: "save-matrix" });
        setShowMatrixModal(false);

      } else {
        toast.error(res?.message || "Failed to save", { id: "save-matrix" });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving matrix", { id: "save-matrix" });
    }
  };

  const handleSaveStockMatrix = async (changes) => {
    if (!newData) return;

    const { qty: editedQty, barcode: editedBarcodes } = changes;
    const updated = JSON.parse(JSON.stringify(newData));
    let hasChanges = false;
    
    updated.addGroups = updated.addGroups.map(group => {
      const newCombinations = group.combinations.map(c => {
        const key = `${group._id}_${c.sph}_${c.cyl}_${c.eye || ''}`;
        let updatedComb = { ...c };
        let itemChanged = false;

        if (editedQty[key] !== undefined) {
          updatedComb.initStock = Number(editedQty[key]);
          itemChanged = true;
        }
        if (editedBarcodes && editedBarcodes[key] !== undefined) {
          updatedComb.barcode = editedBarcodes[key];
          itemChanged = true;
        }

        if (itemChanged) hasChanges = true;
        return updatedComb;
      });
      return { ...group, combinations: newCombinations };
    });

    if (!hasChanges) {
      toast.success("No changes detected");
      setShowStockMatrixModal(false);
      return;
    }

    try {
      toast.loading("Saving matrix changes...", { id: "save-stock-matrix" });
      const updatePayload = {
        id: updated._id,
        groupName: updated.groupName,
        productName: updated.productName,
        sphMin: updated.sphMin,
        sphMax: updated.sphMax,
        sphStep: updated.sphStep,
        cylMin: updated.cylMin,
        cylMax: updated.cylMax,
        cylStep: updated.cylStep,
        addMin: updated.addMin,
        addMax: updated.addMax,
        addStep: updated.addStep,
        axis: updated.axis,
        eye: updated.eye,
        addGroups: updated.addGroups,
      };

      const res = await editLensPower(updatePayload);

      if (res && res.success) {
        setNewData(res.data);
        toast.success("Stock Quantities Updated!", { id: "save-stock-matrix" });
        setShowStockMatrixModal(false);
      } else {
        toast.error(res?.message || "Failed to save", { id: "save-stock-matrix" });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving matrix", { id: "save-stock-matrix" });
    }
  };


  // editValues structure:
  // { [addGroupId]: { "<sph>_<cyl>": { boxNo, alertQty, pPrice, sPrice, initStock } } }
  const [editValues, setEditValues] = useState({});

  // When clicking pencil, populate editValues for that addGroup and enter edit mode
  const handleEditAdd = (addGroupId) => {
    if (!newData) return;
    const group = newData.addGroups?.find((g) => g._id === addGroupId);
    if (!group) return;

    const map = {};
    (group.combinations || []).forEach((c) => {
      const key = `${c.sph}_${c.cyl}_${c.eye || ''}`;
      map[key] = {
        barcode: c.barcode ?? "",
        boxNo: c.boxNo ?? "",
        alertQty: c.alertQty ?? "",
        pPrice: c.pPrice ?? "",
        sPrice: c.sPrice ?? "",
        initStock: c.initStock ?? "",
      };
    });

    setEditValues((prev) => ({ ...prev, [addGroupId]: map }));
    setEditingGroupId(addGroupId);
  };

  const handleCancelEdit = () => {
    if (!editingGroupId) return;
    setEditValues((prev) => {
      const copy = { ...prev };
      delete copy[editingGroupId];
      return copy;
    });
    setEditingGroupId(null);
    toast("Edit cancelled", { icon: "✖️" });
  };

  // Save edits to frontend-only newData state
  const handleSaveEdit = async () => {
    if (!newData) return; // Removed !editingGroupId check to allow saving globally if triggered

    const updated = { ...newData };
    updated.addGroups = (updated.addGroups || []).map((g) => {
      // Check if this group has edits in editValues
      const groupMap = editValues[g._id];

      // If no edits for this group, return unchanged
      if (!groupMap) {
        return { ...g, combinations: [...(g.combinations || [])] };
      }

      // This group has edits - merge them
      return {
        ...g,
        combinations: (g.combinations || []).map((c) => {
          const s = parseFloat(c.sph);
          const cyl = parseFloat(c.cyl);
          const e = String(c.eye || "").trim().toUpperCase();

          // Robust key matching using both raw and numeric formats
          let possibleKeys = [
            `${c.sph}_${c.cyl}_${e}`,
            `${s}_${cyl}_${e}`,
            `${s.toFixed(2)}_${cyl.toFixed(2)}_${e}`,
          ];

          // FALLBACK FOR DUAL EYES: If database has R/L or RL, check for R or L in editValues
          const DUAL_VARIANTS = ["RL", "R/L", "BOTH"];
          if (DUAL_VARIANTS.includes(e)) {
             possibleKeys = [
               ...possibleKeys,
               `${c.sph}_${c.cyl}_R`,
               `${c.sph}_${c.cyl}_L`,
               `${s}_${cyl}_R`,
               `${s}_${cyl}_L`,
             ];
          }

          let vals = null;
          for (const key of possibleKeys) {
            if (groupMap[key]) {
              vals = groupMap[key];
              break;
            }
          }

          if (!vals) return { ...c };

          const updatedComb = { ...c };
          if (vals.barcode !== undefined) updatedComb.barcode = vals.barcode || (c.barcode ?? "");
          if (vals.boxNo !== undefined) updatedComb.boxNo = vals.boxNo || (c.boxNo ?? "");
          
          if (vals.alertQty !== undefined && vals.alertQty !== "" && vals.alertQty != null) {
            updatedComb.alertQty = Number(vals.alertQty);
          }

          if (vals.pPrice !== undefined && vals.pPrice !== "" && vals.pPrice != null) {
            updatedComb.pPrice = Number(vals.pPrice);
          }
          if (vals.sPrice !== undefined && vals.sPrice !== "" && vals.sPrice != null) {
            updatedComb.sPrice = Number(vals.sPrice);
          }
          if (vals.initStock !== undefined && vals.initStock !== "" && vals.initStock != null) {
            updatedComb.initStock = Number(vals.initStock);
          }

          return updatedComb;
        }),
      };
    });

    try {
      toast.loading("Saving changes to database...", { id: "save-db" });
      const updatePayload = {
        id: updated._id,
        groupName: updated.groupName,
        productName: updated.productName,
        sphMin: updated.sphMin,
        sphMax: updated.sphMax,
        sphStep: updated.sphStep,
        cylMin: updated.cylMin,
        cylMax: updated.cylMax,
        cylStep: updated.cylStep,
        addMin: updated.addMin,
        addMax: updated.addMax,
        addStep: updated.addStep,
        axis: updated.axis,
        eye: updated.eye,
        addGroups: updated.addGroups,
      };

      const res = await editLensPower(updatePayload);
      if (res && res.success) {
        setNewData(res.data);
        // Clear all edit values
        setEditValues({});
        setEditingGroupId(null);
        toast.success("Saved successfully!", { id: "save-db" });
      } else {
        toast.error(res?.message || "Failed to save", { id: "save-db" });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving to database", { id: "save-db" });
    }
  };

  const copyPriceToAll = (field, sourceGroupId) => {
    if (!sourceGroupId || !editValues[sourceGroupId]) return;

    const sourceGroupMap = editValues[sourceGroupId];
    const sourceGroup = newData.addGroups.find((g) => g._id === sourceGroupId);

    if (!sourceGroup || !sourceGroup.combinations.length) return;

    // The table might be using R/L merged keys or specific eye keys.
    // We search the first combination's possible keys to find the source value.
    const firstComb = sourceGroup.combinations[0];
    const s = parseFloat(firstComb.sph);
    const c = parseFloat(firstComb.cyl);

    // Check possible keys in order of likelihood
    const possibleKeys = [
      `${s}_${c}_R`,
      `${s}_${c}_L`,
      `${s}_${c}_${firstComb.eye || ''}`,
      `${s}_${c}_RL`,
      `${s}_${c}_R/L`
    ];

    let valueToCopy = undefined;
    for (const key of possibleKeys) {
      if (sourceGroupMap[key] && sourceGroupMap[key][field] !== undefined && sourceGroupMap[key][field] !== "") {
        valueToCopy = sourceGroupMap[key][field];
        break;
      }
    }

    if (valueToCopy === undefined || valueToCopy === "") {
      toast.error("Please enter a value in the first row's field first.");
      return;
    }

    // Create a copy of the entire editValues state
    const newEditValues = { ...editValues };

    // Iterate through ALL add groups
    newData.addGroups.forEach((group) => {
      const groupId = group._id;
      if (!newEditValues[groupId]) newEditValues[groupId] = {};
      const groupMap = newEditValues[groupId];

      // Apply to all combinations in this group, covering all possible eye variants
      group.combinations.forEach((comb) => {
        const cs = parseFloat(comb.sph);
        const cc = parseFloat(comb.cyl);
        const eyes = ["R", "L", String(comb.eye || "").trim().toUpperCase(), "RL", "R/L"];

        eyes.forEach(e => {
          const key = `${cs}_${cc}_${e}`;
          if (!groupMap[key]) groupMap[key] = {};
          groupMap[key][field] = valueToCopy;
        });
      });
    });

    setEditValues(newEditValues);
    toast.success(`Copied to ALL items! Click Save to apply.`);
  };

  const handleReset = () => {
    toast.success("Form Reset Successfully");
    setFormData({
      groupName: "",
      productName: "",
      vendorItemName: "",
      billItemName: "",
      sphMin: "",
      sphMax: "",
      sphStep: "0.25",
      cylMin: "",
      cylMax: "",
      cylStep: "0.25",
      axis: "",
      addMin: "",
      addMax: "",
      addStep: "0.25",
      eye: "",
      powerGroups: [],
      activeGroupIdx: null
    });
    setNewData(null);
    setLensPower(null);
    setShowDetails(false);
    setEditingGroupId(null);
    setEditValues({});
    setPgInputs({
      sph: { min: "", max: "" },
      cyl: { min: "", max: "" },
      add: { min: "", max: "" }
    });
  };
  const [lensPower, setLensPower] = useState(null);
  const [addBarcodeWithPower, setAddBarcodeWithPower] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [Groups, setGroups] = useState([]);
  const [Items, setItems] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const group = await getAllGroups();
        setGroups(group.groups || []);
        const items = await getAllItems();
        setItems(items.items || []);
        // fetchLibrary will be called by useEffect when groupName changes or initial state is set
      } catch (err) {
        console.log("Error fetching groups/items", err);
      }
    };
    fetchData();
  }, []);

  const fetchLibrary = async (groupName) => {
    setLoadingLibrary(true);
    try {
      const res = await getPowerRangeLibrary(groupName);
      if (res && res.success) {
        setLibraryRanges(res.data || []);
      }
    } catch (err) {
      console.error("Error fetching library:", err);
    } finally {
      setLoadingLibrary(false);
    }
  };

  useEffect(() => {
    if (formData.groupName) {
      fetchLibrary(formData.groupName);
    } else {
      setLibraryRanges([]);
    }
  }, [formData.groupName]);

  // Toggle a range in/out of selectedLibraryRanges
  const toggleLibraryRange = (range) => {
    setSelectedLibraryRanges(prev => {
      const isSelected = prev.some(r => r._id === range._id);
      if (isSelected) return prev.filter(r => r._id !== range._id);
      return [...prev, range];
    });
  };

  // Compute the merged range preview from all selected ranges
  const getMergedPreview = () => {
    if (selectedLibraryRanges.length === 0) return null;
    return {
      sphMin: Math.min(...selectedLibraryRanges.map(r => Number(r.sphMin))),
      sphMax: Math.max(...selectedLibraryRanges.map(r => Number(r.sphMax))),
      cylMin: Math.min(...selectedLibraryRanges.map(r => Number(r.cylMin))),
      cylMax: Math.max(...selectedLibraryRanges.map(r => Number(r.cylMax))),
      addMin: Math.min(...selectedLibraryRanges.map(r => Number(r.addMin))),
      addMax: Math.max(...selectedLibraryRanges.map(r => Number(r.addMax))),
      sphStep: selectedLibraryRanges[0]?.sphStep ?? 0.25,
      cylStep: selectedLibraryRanges[0]?.cylStep ?? 0.25,
      addStep: selectedLibraryRanges[0]?.addStep ?? 0.25,
    };
  };

  const applyLibraryRange = () => {
    if (!selectedLibraryRanges || selectedLibraryRanges.length === 0) {
      toast.error("Please select at least one range from the library first!");
      return;
    }

    // Merge: smallest min, largest max across all selected ranges
    const merged = getMergedPreview();

    setFormData(prev => ({
      ...prev,
      sphMin: libraryCheckboxes.sph ? merged.sphMin : prev.sphMin,
      sphMax: libraryCheckboxes.sph ? merged.sphMax : prev.sphMax,
      sphStep: libraryCheckboxes.sph ? merged.sphStep : prev.sphStep,
      cylMin: libraryCheckboxes.cyl ? merged.cylMin : prev.cylMin,
      cylMax: libraryCheckboxes.cyl ? merged.cylMax : prev.cylMax,
      cylStep: libraryCheckboxes.cyl ? merged.cylStep : prev.cylStep,
      addMin: libraryCheckboxes.add ? merged.addMin : prev.addMin,
      addMax: libraryCheckboxes.add ? merged.addMax : prev.addMax,
      addStep: libraryCheckboxes.add ? merged.addStep : prev.addStep,
    }));

    const msg = selectedLibraryRanges.length > 1
      ? `Merged ${selectedLibraryRanges.length} ranges applied to filters!`
      : "Library values applied to filters!";
    toast.success(msg);
    setShowLibrary(false);
    setSelectedLibraryRanges([]);
  };

  // Suggestion states for Group Name
  const [groupSuggestions, setGroupSuggestions] = useState([]);
  const [showGroupSuggestions, setShowGroupSuggestions] = useState(false);
  const [groupActiveIndex, setGroupActiveIndex] = useState(-1);
  const groupRef = useRef(null);

  // Suggestion states for Product Name
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [productActiveIndex, setProductActiveIndex] = useState(-1);
  const productRef = useRef(null);

  // Close suggestion lists on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (groupRef.current && !groupRef.current.contains(e.target)) {
        setShowGroupSuggestions(false);
        setGroupActiveIndex(-1);
      }
      if (productRef.current && !productRef.current.contains(e.target)) {
        setShowProductSuggestions(false);
        setProductActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (field === "groupName") {
      const q = value.trim().toLowerCase();
      if (q.length === 0) {
        setGroupSuggestions([]);
        setShowGroupSuggestions(false);
      } else {
        const filtered = (Groups || [])
          .map((g) => g.groupName)
          .filter((name) => name.toLowerCase().includes(q));
        setGroupSuggestions(filtered);
        setShowGroupSuggestions(filtered.length > 0);
        setGroupActiveIndex(-1);
      }
    }

    if (field === "productName") {
      const q = value.trim().toLowerCase();
      if (q.length === 0) {
        // Show all items of selected group (or all) when cleared
        const groupQ = (formData.groupName || "").trim().toLowerCase();
        let filtered = Items || [];
        if (groupQ) {
          filtered = filtered.filter(item => item.groupName && item.groupName.toLowerCase() === groupQ);
        }
        const final = filtered.map(item => item.itemName);
        setProductSuggestions(final);
        setShowProductSuggestions(final.length > 0);
      } else {
        // Show filtered items, preferably within the same group if one is selected
        const groupQ = (formData.groupName || "").trim().toLowerCase();
        let filtered = Items || [];
        if (groupQ) {
          filtered = filtered.filter(item => item.groupName && item.groupName.toLowerCase() === groupQ);
        }
        const finalFiltered = filtered
          .map((item) => item.itemName)
          .filter((name) => name && name.toLowerCase().includes(q));
        setProductSuggestions(finalFiltered);
        setShowProductSuggestions(finalFiltered.length > 0);
        setProductActiveIndex(-1);
      }
    }
  };

  const selectGroupSuggestion = (value) => {
    setFormData((prev) => ({ ...prev, groupName: value }));
    setShowGroupSuggestions(false);
    setGroupActiveIndex(-1);
    if (value) {
      loadExistingPowerByGroup(value);
    }
  };

  const loadExistingPowerByGroup = async (groupName) => {
    try {
      const result = await getLensPower({ groupName });
      if (result && result.success !== false && result.data) {
        const data = result.data.data || result.data;
        if (data && data._id) {
          // Robustly merge power groups to ensure all keys exist
          const mergedPowerGroups = Array.isArray(data.powerGroups) ? data.powerGroups : [];

          console.log("Auto-loading power groups by group:", mergedPowerGroups);
          setFormData(prev => ({
            ...prev,
            sphMin: data.sphMin ?? prev.sphMin,
            sphMax: data.sphMax ?? prev.sphMax,
            sphStep: data.sphStep ?? prev.sphStep,
            cylMin: data.cylMin ?? prev.cylMin,
            cylMax: data.cylMax ?? prev.cylMax,
            cylStep: data.cylStep ?? prev.cylStep,
            addMin: data.addMin ?? prev.addMin,
            addMax: data.addMax ?? prev.addMax,
            addStep: data.addStep ?? prev.addStep,
            axis: data.axis ?? prev.axis,
            eye: data.eye ?? prev.eye,
            productName: data.productName ?? prev.productName,
            powerGroups: mergedPowerGroups
          }));
          setNewData(data);
          if (mergedPowerGroups.length > 0) {
            toast.success("Saved Power Groups loaded.");
          }
        }
      }
    } catch (err) {
      console.error("Error auto-loading power data by group:", err);
    }
  };

  const selectProductSuggestion = (value) => {
    // Find the item to get its group name
    const selectedItem = Items.find((item) => item.itemName === value);

    setFormData((prev) => ({
      ...prev,
      productName: value,
      // Auto-fill group name if found
      groupName: selectedItem?.groupName || prev.groupName
    }));
    setShowProductSuggestions(false);
    setProductActiveIndex(-1);

    // Show success message if group name was auto-filled
    if (selectedItem?.groupName) {
      toast.success(`Group name auto-filled: ${selectedItem.groupName}`);
    }

    // Auto-load power groups if product exists
    if (value) {
      loadExistingPower(value);
    }
  };

  const loadExistingPower = async (productName) => {
    try {
      const result = await getLensPower({ productName });
      if (result && result.success !== false && result.data) {
        const data = result.data.data || result.data;
        if (data && data._id) {
          const mergedPowerGroups = Array.isArray(data.powerGroups) ? data.powerGroups : [];

          console.log("Auto-loading power groups by product:", mergedPowerGroups);
          setFormData(prev => ({
            ...prev,
            sphMin: data.sphMin ?? "",
            sphMax: data.sphMax ?? "",
            sphStep: data.sphStep ?? "0.25",
            cylMin: data.cylMin ?? "",
            cylMax: data.cylMax ?? "",
            cylStep: data.cylStep ?? "0.25",
            addMin: data.addMin ?? "",
            addMax: data.addMax ?? "",
            addStep: data.addStep ?? "0.25",
            axis: data.axis ?? "",
            eye: data.eye ?? "",
            powerGroups: mergedPowerGroups
          }));
          setNewData(data);
          if (mergedPowerGroups.length > 0) {
            toast.success("Saved Power Groups loaded.");
          }
        }
      }
    } catch (err) {
      console.error("Error auto-loading power data:", err);
    }
  };


  const handlePowerGroupSelect = (index) => {
    if (index === "") {
      setFormData(prev => ({ ...prev, activeGroupIdx: null }));
      return;
    }
    const idx = parseInt(index);
    const pg = formData.powerGroups[idx];
    if (!pg) return;

    setFormData(prev => ({
      ...prev,
      activeGroupIdx: idx,
      sphMin: pg.sphMin ?? "",
      sphMax: pg.sphMax ?? "",
      sphStep: pg.sphStep ?? "0.25",
      cylMin: pg.cylMin ?? "",
      cylMax: pg.cylMax ?? "",
      cylStep: pg.cylStep ?? "0.25",
      addMin: pg.addMin ?? "",
      addMax: pg.addMax ?? "",
      addStep: pg.addStep ?? "0.25",
      axis: pg.axis ?? "",
      eye: pg.eye ?? "",
    }));
    toast.success(`Filter switched to: ${pg.label || "Group " + (idx + 1)}`);
  };

  // keyboard handlers
  const onGroupKeyDown = (e) => {
    if (!showGroupSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setGroupActiveIndex((i) => Math.min(i + 1, groupSuggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setGroupActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const val = groupSuggestions[groupActiveIndex] ?? groupSuggestions[0];
      if (val) selectGroupSuggestion(val);
    } else if (e.key === "Escape") {
      setShowGroupSuggestions(false);
      setGroupActiveIndex(-1);
    }
  };

  const onProductKeyDown = (e) => {
    if (!showProductSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setProductActiveIndex((i) =>
        Math.min(i + 1, productSuggestions.length - 1)
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setProductActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const val =
        productSuggestions[productActiveIndex] ?? productSuggestions[0];
      if (val) selectProductSuggestion(val);
    } else if (e.key === "Escape") {
      setShowProductSuggestions(false);
      setProductActiveIndex(-1);
    }
  };

  const onProductFocus = () => {
    const q = (formData.productName || "").trim().toLowerCase();
    const groupQ = (formData.groupName || "").trim().toLowerCase();

    let filtered = Items || [];
    if (groupQ) {
      filtered = filtered.filter(item => item.groupName && item.groupName.toLowerCase() === groupQ);
    }

    if (q) {
      filtered = filtered.filter(item => item.itemName && item.itemName.toLowerCase().includes(q));
    }

    const final = filtered.map(item => item.itemName);
    setProductSuggestions(final);
    setShowProductSuggestions(final.length > 0);
    setProductActiveIndex(-1);
  };

  const handleViewPower = async () => {
    try {
      const prod = formData.productName?.trim();
      if (!prod) {
        toast.error("Enter product name to search");
        return;
      }

      // toggle off if already open
      if (showDetails) {
        setShowDetails(false);
        // Keep newData in memory so it doesn't re-fetch and overwrite filters next time
        return;
      }

      // If data is already loaded for this product, just show it
      if (newData && newData.productName?.toLowerCase() === prod.toLowerCase()) {
        setShowDetails(true);
        return;
      }

      // Otherwise, fetch from backend
      const result = await getLensPower({ productName: prod });

      // handle backend failure
      if (!result || result.success === false) {
        const errorMsg = result?.error || result?.message || "No lens powers found for the given product.";
        toast.error(errorMsg);
        setLensPower(null);
        setNewData(null);
        setShowDetails(false);
        return;
      }

      if (!result.data) {
        toast.error("No lens powers found for the given product.");
        setLensPower(null);
        setNewData(null);
        setShowDetails(false);
        return;
      }

      const data = result.data.data || result.data;

      // Robustly merge power groups to ensure all keys exist
      const mergedPowerGroups = Array.isArray(data.powerGroups) ? data.powerGroups : [];

      console.log("Loading power groups via View button:", mergedPowerGroups);
      // success path
      setLensPower(data);
      setNewData(data);
      setFormData((prev) => ({
        ...prev,
        sphMin: data.sphMin ?? prev.sphMin,
        sphMax: data.sphMax ?? prev.sphMax,
        sphStep: data.sphStep ?? prev.sphStep,
        cylMin: data.cylMin ?? prev.cylMin,
        cylMax: data.cylMax ?? prev.cylMax,
        cylStep: data.cylStep ?? prev.cylStep,
        addMin: data.addMin ?? prev.addMin,
        addMax: data.addMax ?? prev.addMax,
        addStep: data.addStep ?? prev.addStep,
        axis: data.axis ?? prev.axis,
        eye: data.eye ?? prev.eye,
        groupName: data.groupName ?? prev.groupName,
        vendorItemName: data.vendorItemName ?? "",
        billItemName: data.billItemName ?? "",
        powerGroups: mergedPowerGroups,
        activeGroupIdx: (prev.activeGroupIdx !== null && prev.activeGroupIdx < mergedPowerGroups.length)
          ? prev.activeGroupIdx
          : (mergedPowerGroups.length > 0 ? 0 : null)
      }));
      setShowDetails(true);
      toast.success("Lens group loaded successfully.");
    } catch (err) {
      console.error("Error:", err);
      const errMsg =
        err?.response?.data?.message || err?.message || "Something went wrong";
      toast.error(errMsg);
      setLensPower(null);
      setNewData(null);
      setShowDetails(false);
    }
  };

  // helper to find combination in an addGroup by sph+cyl+eye
  const findComb = (group, sph, cyl, eye) => {
    if (!group || !Array.isArray(group.combinations)) return null;

    const targetSph = parseFloat(sph);
    const targetCyl = parseFloat(cyl);
    const targetEye = String(eye || "").trim().toUpperCase();

    const BOTH_EYES = ["RL", "R/L", "BOTH"];

    return (
      group.combinations.find((c) => {
        const cs = parseFloat(c.sph);
        const cc = parseFloat(c.cyl);
        const cEye = String(c.eye || "").trim().toUpperCase();

        const sphMatch = Math.abs(cs - targetSph) < 0.01;
        const cylMatch = Math.abs(cc - targetCyl) < 0.01;

        let eyeMatch = (cEye === targetEye);
        if (!eyeMatch) {
          // If seeking R or L, match if the combination is BOTH/RL
          if ((targetEye === "R" || targetEye === "L") && BOTH_EYES.includes(cEye)) {
            eyeMatch = true;
          }
          // If seeking BOTH, match if the combination is also ANY BOTH type
          if (BOTH_EYES.includes(targetEye) && BOTH_EYES.includes(cEye)) {
            eyeMatch = true;
          }
        }

        return sphMatch && cylMatch && eyeMatch;
      }) || null
    );
  };

  // Helper to handle changing inputs in editValues
  const handleEditInputChange = (addGroupId, key, field, value) => {
    setEditValues((prev) => {
      const copy = { ...prev };
      copy[addGroupId] = copy[addGroupId] || {};
      copy[addGroupId][key] = copy[addGroupId][key] || {};
      copy[addGroupId][key][field] = value;
      return copy;
    });
  };

  return (
    <div className={hideHeader ? "" : "min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 font-sans p-6"}>
      <div className={hideHeader ? "" : "max-w-[98vw] mx-auto"}>

        {/* Header */}
        {!hideHeader && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              Lens Group Creation
            </h1>
            <p className="text-slate-600">
              Create and manage lens groups with power specifications
            </p>
          </div>
        )}

        {/* Form Section */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 mb-6">
          {/* Group & Product Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="relative" ref={groupRef}>
              <input
                type="text"
                id="groupName"
                value={formData.groupName}
                onChange={(e) => handleInputChange("groupName", e.target.value)}
                onKeyDown={onGroupKeyDown}
                autoComplete="off"
                placeholder=" "
                className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm placeholder-transparent"
              />
              <label
                htmlFor="groupName"
                className="absolute left-3 -top-2.5 text-xs font-medium transition-all duration-200 peer-placeholder-shown:top-2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-blue-500 bg-white px-2 text-gray-500"
              >
                Group Name
              </label>
              {showGroupSuggestions && groupSuggestions.length > 0 && (
                <ul className="absolute z-50 left-0 right-0 mt-1 max-h-40 overflow-auto bg-white border border-slate-200 rounded-md shadow-sm">
                  {groupSuggestions.map((sugg, i) => (
                    <li
                      key={sugg}
                      onMouseDown={() => selectGroupSuggestion(sugg)}
                      className={`px-3 py-2 cursor-pointer text-xs ${i === groupActiveIndex
                        ? "bg-blue-600 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                        }`}
                    >
                      {sugg}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="relative" ref={productRef}>
              <input
                type="text"
                id="productName"
                value={formData.productName}
                onChange={(e) =>
                  handleInputChange("productName", e.target.value)
                }
                onKeyDown={onProductKeyDown}
                onFocus={onProductFocus}
                autoComplete="off"
                placeholder=" "
                className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm placeholder-transparent"
              />
              <label
                htmlFor="productName"
                className="absolute left-3 -top-2.5 text-xs font-medium transition-all duration-200 peer-placeholder-shown:top-2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-blue-500 bg-white px-2 text-gray-500"
              >
                Product Name
              </label>
              {showProductSuggestions && productSuggestions.length > 0 && (
                <ul className="absolute z-50 left-0 right-0 mt-1 max-h-40 overflow-auto bg-white border border-slate-200 rounded-md shadow-sm">
                  {productSuggestions.map((sugg, i) => (
                    <li
                      key={sugg}
                      onMouseDown={() => selectProductSuggestion(sugg)}
                      className={`px-3 py-2 cursor-pointer text-xs ${i === productActiveIndex
                        ? "bg-blue-600 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                        }`}
                    >
                      {sugg}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Vendor & Bill Item Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="relative">
              <input
                type="text"
                id="vendorItemName"
                value={formData.vendorItemName}
                onChange={(e) => handleInputChange("vendorItemName", e.target.value)}
                autoComplete="off"
                placeholder=" "
                className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm placeholder-transparent"
              />
              <label
                htmlFor="vendorItemName"
                className="absolute left-3 -top-2.5 text-xs font-medium transition-all duration-200 peer-placeholder-shown:top-2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-blue-500 bg-white px-2 text-gray-500"
              >
                Vendor Item Name
              </label>
            </div>

            <div className="relative">
              <input
                type="text"
                id="billItemName"
                value={formData.billItemName}
                onChange={(e) => handleInputChange("billItemName", e.target.value)}
                autoComplete="off"
                placeholder=" "
                className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm placeholder-transparent"
              />
              <label
                htmlFor="billItemName"
                className="absolute left-3 -top-2.5 text-xs font-medium transition-all duration-200 peer-placeholder-shown:top-2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-blue-500 bg-white px-2 text-gray-500"
              >
                Bill Item Name
              </label>
            </div>
          </div>

          {/* Power Range Section (unchanged inputs) */}
          <h3 className="text-lg font-semibold text-slate-700 mb-4">
            Power Range
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4">
            <div className="relative w-fit">
              <input
                type="number"
                id="sphMin"
                value={formData.sphMin}
                onChange={(e) => handleInputChange("sphMin", e.target.value)}
                step="0.25"
                placeholder=" "
                className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm placeholder-transparent"
              />
              <label
                htmlFor="sphMin"
                className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500"
              >
                SPH Min
              </label>
            </div>
            <div className="relative w-fit">
              <input
                type="number"
                id="sphMax"
                value={formData.sphMax}
                onChange={(e) => handleInputChange("sphMax", e.target.value)}
                step="0.25"
                placeholder=" "
                className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm placeholder-transparent"
              />
              <label
                htmlFor="sphMax"
                className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500"
              >
                SPH Max
              </label>
            </div>
            <div className="relative w-fit">
              <input
                type="number"
                id="sphStep"
                value={formData.sphStep}
                onChange={(e) => handleInputChange("sphStep", e.target.value)}
                step="0.25"
                placeholder=" "
                className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm placeholder-transparent"
              />
              <label
                htmlFor="sphStep"
                className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500"
              >
                SPH Step
              </label>
            </div>
            <div className="relative w-fit">
              <input
                type="number"
                id="cylMin"
                value={formData.cylMin}
                onChange={(e) => handleInputChange("cylMin", e.target.value)}
                step="0.25"
                placeholder=" "
                className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm placeholder-transparent"
              />
              <label
                htmlFor="cylMin"
                className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500"
              >
                CYL Min
              </label>
            </div>
            <div className="relative w-fit">
              <input
                type="number"
                id="cylMax"
                value={formData.cylMax}
                onChange={(e) => handleInputChange("cylMax", e.target.value)}
                step="0.25"
                placeholder=" "
                className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm placeholder-transparent"
              />
              <label
                htmlFor="cylMax"
                className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500"
              >
                CYL Max
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4">
            <div className="relative w-fit">
              <input
                type="number"
                id="cylStep"
                value={formData.cylStep}
                onChange={(e) => handleInputChange("cylStep", e.target.value)}
                step="0.25"
                placeholder=" "
                className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm placeholder-transparent"
              />
              <label
                htmlFor="cylStep"
                className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500"
              >
                CYL Step
              </label>
            </div>
            <div className="relative w-fit">
              <input
                type="number"
                id="addMin"
                value={formData.addMin}
                onChange={(e) => handleInputChange("addMin", e.target.value)}
                step="0.25"
                placeholder=" "
                className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm placeholder-transparent"
              />
              <label
                htmlFor="addMin"
                className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500"
              >
                Add Min
              </label>
            </div>
            <div className="relative w-fit">
              <input
                type="number"
                id="addMax"
                value={formData.addMax}
                onChange={(e) => handleInputChange("addMax", e.target.value)}
                step="0.25"
                placeholder=" "
                className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm placeholder-transparent"
              />
              <label
                htmlFor="addMax"
                className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500"
              >
                Add Max
              </label>
            </div>
            <div className="relative w-fit">
              <input
                type="number"
                id="addStep"
                value={formData.addStep}
                onChange={(e) => handleInputChange("addStep", e.target.value)}
                step="0.25"
                placeholder=" "
                className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm placeholder-transparent"
              />
              <label
                htmlFor="addStep"
                className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500"
              >
                Add Step
              </label>
            </div>
            <div className="relative w-fit">
              <input
                type="number"
                id="axis"
                value={formData.axis}
                onChange={(e) => handleInputChange("axis", e.target.value)}
                placeholder=" "
                className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm placeholder-transparent"
              />
              <label
                htmlFor="axis"
                className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500"
              >
                Axis
              </label>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-fit">
              <select
                id="eye"
                value={formData.eye}
                onChange={(e) => handleInputChange("eye", e.target.value)}
                className="peer w-full z-10 px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm bg-white appearance-none"
              >
                <option value="">Select Eye</option>
                <option value="R">Right (R)</option>
                <option value="L">Left (L)</option>
                <option value="R/L">RL</option>
                <option value="RL">Both (RL)</option>
              </select>
              <label
                htmlFor="eye"
                className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500"
              >
                Eye (RL)
              </label>
            </div>

            <button
              type="button"
              onClick={() => handleViewPower()}
              className={`inline-flex items-center gap-2 px-6 py-3 ${showDetails ? "bg-gray-100 text-gray-800" : "bg-blue-600 text-white"
                } font-semibold rounded-xl hover:opacity-90 transition-colors duration-200`}
            >
              <Eye className="w-4 h-4" />
              {showDetails ? "Hide" : "Show"}
            </button>
          </div>

          {/* Power Range Library Section */}
          <div className="mt-8 border-t border-slate-100 pt-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                Power Range Library
              </h3>
              <button
                type="button"
                onClick={() => setShowLibrary(!showLibrary)}
                className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-all border border-blue-100 flex items-center gap-2"
              >
                {showLibrary ? "Hide Library" : "Open Library"}
              </button>
            </div>

            {showLibrary && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-6 animate-in fade-in zoom-in-95 duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Multi-Select Range Checkbox List */}
                  <div className="space-y-2 md:col-span-2 lg:col-span-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Browse Library (Multi-Select)</label>
                      {selectedLibraryRanges.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedLibraryRanges([])}
                          className="text-[10px] text-red-400 hover:text-red-600 font-bold transition-colors"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-inner divide-y divide-slate-100">
                      {libraryRanges.length === 0 && !loadingLibrary ? (
                        <div className="py-6 text-center">
                          <p className="text-slate-400 text-xs italic">No ranges in library yet for this group.</p>
                        </div>
                      ) : loadingLibrary ? (
                        <div className="py-6 text-center">
                          <p className="text-slate-400 text-xs italic">Loading...</p>
                        </div>
                      ) : (
                        libraryRanges.map((range) => {
                          const isChecked = selectedLibraryRanges.some(r => r._id === range._id);
                          return (
                            <label
                              key={range._id}
                              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                                isChecked ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div
                                className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                                  isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="hidden"
                                  checked={isChecked}
                                  onChange={() => toggleLibraryRange(range)}
                                />
                                {isChecked && <Check size={10} strokeWidth={4} />}
                              </div>
                              <div className="flex flex-col min-w-0 flex-1">
                                {range.label && (
                                  <span className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-tighter mb-0.5">
                                    {range.label}
                                  </span>
                                )}
                                <span className="text-xs font-medium text-slate-700 leading-tight">
                                  <span className="font-bold text-blue-700">SPH</span> ({range.sphMin},{range.sphMax})
                                  {" | "}
                                  <span className="font-bold text-purple-700">CYL</span> ({range.cylMin},{range.cylMax})
                                  {" | "}
                                  <span className="font-bold text-emerald-700">ADD</span> ({range.addMin},{range.addMax})
                                </span>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                    {selectedLibraryRanges.length > 0 && (
                      <p className="text-[10px] text-blue-600 font-bold ml-1">
                        {selectedLibraryRanges.length} range{selectedLibraryRanges.length > 1 ? 's' : ''} selected
                        {selectedLibraryRanges.length > 1 ? ' — will be merged' : ''}
                      </p>
                    )}
                  </div>

                  {/* Checkboxes for Combinations */}
                  <div className="flex items-end gap-4 pb-1">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${libraryCheckboxes.sph ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300'}`}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={libraryCheckboxes.sph}
                          onChange={() => setLibraryCheckboxes(prev => ({ ...prev, sph: !prev.sph }))}
                        />
                        {libraryCheckboxes.sph && <Check size={12} strokeWidth={4} />}
                      </div>
                      <span className="text-xs font-bold text-slate-600 group-hover:text-blue-600">SPH</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${libraryCheckboxes.cyl ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300'}`}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={libraryCheckboxes.cyl}
                          onChange={() => setLibraryCheckboxes(prev => ({ ...prev, cyl: !prev.cyl }))}
                        />
                        {libraryCheckboxes.cyl && <Check size={12} strokeWidth={4} />}
                      </div>
                      <span className="text-xs font-bold text-slate-600 group-hover:text-blue-600">CYL</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${libraryCheckboxes.add ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300'}`}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={libraryCheckboxes.add}
                          onChange={() => setLibraryCheckboxes(prev => ({ ...prev, add: !prev.add }))}
                        />
                        {libraryCheckboxes.add && <Check size={12} strokeWidth={4} />}
                      </div>
                      <span className="text-xs font-bold text-slate-600 group-hover:text-blue-600">ADD</span>
                    </label>
                  </div>

                  {/* Apply Button */}
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={applyLibraryRange}
                      className="w-full py-2.5 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 active:scale-95 transition-all"
                    >
                      Apply Library Values
                    </button>
                  </div>
                </div>

                {/* Merged Range Preview */}
                {(() => {
                  const merged = getMergedPreview();
                  if (!merged) return null;
                  return (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        {selectedLibraryRanges.length > 1 ? '⚡ Merged Preview' : 'Selected Range'}
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-100 shadow-sm">
                          <p className="text-[9px] font-black text-blue-400 uppercase tracking-tighter">SPH Range</p>
                          <p className="text-sm font-bold text-blue-700">{merged.sphMin} to {merged.sphMax}</p>
                        </div>
                        <div className="bg-purple-50 p-2.5 rounded-lg border border-purple-100 shadow-sm">
                          <p className="text-[9px] font-black text-purple-400 uppercase tracking-tighter">CYL Range</p>
                          <p className="text-sm font-bold text-purple-700">{merged.cylMin} to {merged.cylMax}</p>
                        </div>
                        <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-100 shadow-sm">
                          <p className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter">ADD Range</p>
                          <p className="text-sm font-bold text-emerald-700">{merged.addMin} to {merged.addMax}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="flex items-center gap-3 mb-6">
              <div className="h-6 w-1 bg-slate-300 rounded-full"></div>
              <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                Power Group Filter (Product Specific)
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="relative">
                <select
                  id="powerGroupSelect"
                  value=""
                  onChange={(e) => handlePowerGroupSelect(e.target.value)}
                  className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm bg-white appearance-none"
                >
                  <option value="">Select a Power Group</option>
                  {(formData.powerGroups || []).map((pg, idx) => (
                    <option key={idx} value={idx}>
                      {pg.label || `Range ${idx + 1}`}
                    </option>
                  ))}
                </select>
                <label
                  htmlFor="powerGroupSelect"
                  className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500"
                >
                  Power Group List
                </label>
              </div>
              <p className="text-xs text-slate-400 italic flex items-center">
                Select a previously saved range to quickly fill all filters above.
              </p>
            </div>
          </div>
        </div>
        {/* Action Section */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="addBarcode"
                checked={addBarcodeWithPower}
                onChange={(e) => setAddBarcodeWithPower(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <label
                htmlFor="addBarcode"
                className="text-sm font-medium text-gray-700"
              >
                Add Barcode With Lens Power
              </label>
            </div>

            {showDetails && newData && (
              <button
                onClick={handleGenerateBarcodes}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors duration-200"
                title="Generate unique barcodes for all combinations"
              >
                <QrCode className="w-4 h-4" /> Generate Barcodes
              </button>
            )}

            {showDetails && newData && (
              <>
                <button
                  onClick={handleOpenMatrix}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors duration-200 ml-4"
                  title="Open Bulk Alert Matrix"
                >
                  <Grid3X3 className="w-4 h-4" /> Matrix View
                </button>
                <button
                  onClick={handleOpenStockMatrix}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors duration-200 ml-2"
                  title="Open Bulk Stock Matrix"
                >
                  <Grid3X3 className="w-4 h-4" /> Stock Matrix
                </button>
              </>
            )}

            <div className="flex flex-wrap gap-3 ml-auto">
              <button
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors duration-200"
                onClick={handleCreateLensPower}
              >
                <Plus className="w-4 h-4" /> Create Lens Power
              </button>
              <button onClick={handleEditLens} className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors duration-200">
                <Pencil className="w-4 h-4" /> Update
              </button>
              <button
                onClick={handleDeleteLensPower}
                className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors duration-200"
              >
                <Trash className="w-4 h-4" /> Delete
              </button>
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors duration-200"
              >
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
            </div>
          </div>
        </div>
        {/* TABLE */}
        {showDetails && (() => {
          const powerGroups = newData?.powerGroups || [];
          let groupsToRender = [];

          if (formData.activeGroupIdx !== null && powerGroups[formData.activeGroupIdx]) {
            groupsToRender = [powerGroups[formData.activeGroupIdx]];
          } else if (powerGroups.length > 0) {
            // Default to showing only the first group if nothing selected
            groupsToRender = [powerGroups[0]];
          } else {
            // Fallback for custom ranges if no powerGroups exist
            groupsToRender = [{
              label: "Custom Range",
              sphMin: parseFloat(formData.sphMin),
              sphMax: parseFloat(formData.sphMax),
              cylMin: parseFloat(formData.cylMin),
              cylMax: parseFloat(formData.cylMax),
              addMin: parseFloat(formData.addMin),
              addMax: parseFloat(formData.addMax),
              eye: formData.eye
            }];
          }

          return groupsToRender.map((pg, pgIdx) => {
            const sMin = (pg.sphMin === "" || pg.sphMin === undefined || isNaN(pg.sphMin)) ? -Infinity : parseFloat(pg.sphMin);
            const sMax = (pg.sphMax === "" || pg.sphMax === undefined || isNaN(pg.sphMax)) ? Infinity : parseFloat(pg.sphMax);
            const cMin = (pg.cylMin === "" || pg.cylMin === undefined || isNaN(pg.cylMin)) ? -Infinity : parseFloat(pg.cylMin);
            const cMax = (pg.cylMax === "" || pg.cylMax === undefined || isNaN(pg.cylMax)) ? Infinity : parseFloat(pg.cylMax);
            const aMin = (pg.addMin === "" || pg.addMin === undefined || isNaN(pg.addMin)) ? -Infinity : parseFloat(pg.addMin);
            const aMax = (pg.addMax === "" || pg.addMax === undefined || isNaN(pg.addMax)) ? Infinity : parseFloat(pg.addMax);
            const eyeVal = pg.eye || formData.eye;
            const isDual = eyeVal === "RL" || eyeVal === "R/L" || !eyeVal;
            const eyeFilter = isDual ? ["R", "L", "RL", "R/L"] : [eyeVal];

            const filteredAddGroups = (newData?.addGroups || []).filter(g => {
              const val = parseFloat(g.addValue);
              return val >= aMin - 0.001 && val <= aMax + 0.001;
            });

            if (filteredAddGroups.length === 0) return null;

            return (
              <div key={pgIdx} className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-8 w-1 bg-blue-600 rounded-full"></div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {pg.label || `Power Group ${pgIdx + 1}`}
                    <span className="ml-3 text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                      SPH: {sMin} to {sMax} | CYL: {cMin} to {cMax} | ADD: {aMin} to {aMax}
                    </span>
                  </h3>
                </div>

                <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed divide-y divide-slate-200">
                      <thead className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200">
                        <tr>
                          <th
                            className="text-center py-4 px-3 text-slate-700 font-bold text-sm"
                            rowSpan={2}
                            style={{ minWidth: 80 }}
                          >
                            SPH
                          </th>

                          <th
                            className="text-center py-4 px-3 text-slate-700 font-bold text-sm border-gray-300 border-r"
                            rowSpan={2}
                            style={{ minWidth: 80 }}
                          >
                            CYL
                          </th>

                          {/* ADD GROUP HEADERS */}
                          {filteredAddGroups.length ? (
                            filteredAddGroups.map((g, idx) => (
                              <th
                                key={`add-head-${idx}`}
                                className="relative text-center py-4 px-3 text-slate-700 font-bold text-sm border-gray-300 border-r"
                                colSpan={7}
                                style={{ minWidth: 650 }}
                              >
                                ADD {parseFloat(g.addValue).toFixed(2)}
                                {/* Pencil Button - Top Right */}
                                {editingGroupId === g._id ? (
                                  <div className="absolute top-2 right-2 flex gap-2">
                                    <button
                                      onClick={handleSaveEdit}
                                      className="px-3 py-1 rounded bg-green-600 text-white text-xs font-medium hover:opacity-90"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={handleCancelEdit}
                                      className="px-3 py-1 rounded bg-gray-100 text-gray-800 text-xs font-medium hover:bg-gray-200"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div className="absolute top-2 right-2 flex gap-1">

                                    <button
                                      onClick={() => handleEditAdd(g._id)}
                                      className="p-1 rounded transition-all duration-200 hover:drop-shadow-[0_0_10px_#3b82f6] hover:scale-110"
                                      title="Edit Row"
                                    >
                                      <Pencil size={18} className="text-blue-400" />
                                    </button>
                                  </div>
                                )}
                              </th>
                            ))
                          ) : null}
                        </tr>
                        {/* SUB HEADERS */}
                        <tr className="bg-slate-50">
                          {filteredAddGroups.map((_, idx) => (
                            <React.Fragment key={`sub-head-${idx}`}>
                              <th className="py-2 px-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center border-gray-200 border-r">Barcode</th>
                              <th className="py-2 px-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center border-gray-200 border-r">Eye</th>
                              <th className="py-2 px-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center border-gray-200 border-r">Axis</th>
                              <th className="py-2 px-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center border-gray-200 border-r relative group/copy">
                                Alert
                                {editingGroupId && (
                                  <button
                                    onClick={() => copyPriceToAll("alertQty", editingGroupId)}
                                    className="ml-1 opacity-0 group-hover/copy:opacity-100 transition-opacity text-blue-500 hover:text-blue-700"
                                    title="Copy first row to all"
                                  >
                                    <Copy size={10} />
                                  </button>
                                )}
                              </th>
                              <th className="py-2 px-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center border-gray-200 border-r relative group/copy">
                                P-Price
                                {editingGroupId && (
                                  <button
                                    onClick={() => copyPriceToAll("pPrice", editingGroupId)}
                                    className="ml-1 opacity-0 group-hover/copy:opacity-100 transition-opacity text-blue-500 hover:text-blue-700"
                                    title="Copy first row to all"
                                  >
                                    <Copy size={10} />
                                  </button>
                                )}
                              </th>
                              <th className="py-2 px-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center border-gray-200 border-r relative group/copy">
                                S-Price
                                {editingGroupId && (
                                  <button
                                    onClick={() => copyPriceToAll("sPrice", editingGroupId)}
                                    className="ml-1 opacity-0 group-hover/copy:opacity-100 transition-opacity text-blue-500 hover:text-blue-700"
                                    title="Copy first row to all"
                                  >
                                    <Copy size={10} />
                                  </button>
                                )}
                              </th>
                              <th className="py-2 px-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center border-gray-200 border-r relative group/copy">
                                Stock
                                {editingGroupId && (
                                  <button
                                    onClick={() => copyPriceToAll("initStock", editingGroupId)}
                                    className="ml-1 opacity-0 group-hover/copy:opacity-100 transition-opacity text-blue-500 hover:text-blue-700"
                                    title="Copy first row to all"
                                  >
                                    <Copy size={10} />
                                  </button>
                                )}
                              </th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {!newData?.addGroups?.length ? (
                          <tr>
                            <td colSpan={2} className="text-center py-6 text-slate-500">
                              No data
                            </td>
                          </tr>
                        ) : (
                          (() => {
                            // Collect all unique combinations across all filtered add groups
                            let allCombs = [];
                            filteredAddGroups.forEach(g => {
                              if (Array.isArray(g.combinations)) {
                                allCombs = allCombs.concat(g.combinations);
                              }
                            });

                            const uniqueRowsMap = new Map();
                            allCombs.forEach(c => {
                              const s = parseFloat(c.sph);
                              const cv = parseFloat(c.cyl);
                              const matchSph = s >= sMin - 0.01 && s <= sMax + 0.01;
                              const matchCyl = cv >= cMin - 0.01 && cv <= cMax + 0.01;
                              const cEye = String(c.eye || "").trim().toUpperCase();
                              const matchEye = eyeFilter.includes(cEye);

                              if (matchSph && matchCyl && matchEye) {
                                // Group by SPH, CYL, AXIS, EYE
                                const key = `${s.toFixed(2)}_${cv.toFixed(2)}_${(c.axis || 0)}_${cEye}`;
                                if (!uniqueRowsMap.has(key)) uniqueRowsMap.set(key, c);
                              }
                            });

                            let displayRows = Array.from(uniqueRowsMap.values());
                            // Sort for a clean matrix view
                            displayRows.sort((a, b) => parseFloat(a.sph) - parseFloat(b.sph) || parseFloat(a.cyl) - parseFloat(b.cyl));

                            if (displayRows.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={100} className="text-center py-10 text-slate-500 italic font-medium">
                                    No combinations found for this range ({sMin} to {sMax}).
                                  </td>
                                </tr>
                              );
                            }

                            if (formData.eye === "R/L" || formData.eye === "RL" || formData.eye === "BOTH") {
                              const grouped = new Map();
                              displayRows.forEach(item => {
                                const key = `${parseFloat(item.sph).toFixed(2)}_${parseFloat(item.cyl).toFixed(2)}_${(item.axis || 0)}`;
                                if (!grouped.has(key)) {
                                  grouped.set(key, { ...item, isMerged: false, hasR: false, hasL: false });
                                }
                                const entry = grouped.get(key);
                                const e = String(item.eye || "").trim().toUpperCase();
                                if (e === "R") entry.hasR = true;
                                if (e === "L") entry.hasL = true;
                                if (e === "R/L" || e === "RL" || e === "BOTH") {
                                  entry.hasR = true;
                                  entry.hasL = true;
                                }
                                if (entry.hasR && entry.hasL) entry.isMerged = true;
                              });
                              displayRows = Array.from(grouped.values());
                            }

                            // Final Sort for consistency
                            displayRows.sort((a, b) => {
                              const sA = parseFloat(a.sph);
                              const sB = parseFloat(b.sph);
                              if (sA !== sB) return sA - sB;
                              const cA = parseFloat(a.cyl);
                              const cB = parseFloat(b.cyl);
                              if (cA !== cB) return cA - cB;
                              return (a.axis || 0) - (b.axis || 0);
                            });

                            return displayRows.map((base, rowIndex) => {
                              const sphVal = base.sph;
                              const cylVal = base.cyl;
                              const axisVal = base.axis;
                              const baseEye = base.isMerged ? "R" : base.eye;

                              return (
                                <tr key={`row-${rowIndex}`} className="hover:bg-slate-50 transition-colors duration-150 text-sm">
                                  <td className="text-center py-3 px-3" style={{ minWidth: 80 }}>
                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md font-semibold">{sphVal}</span>
                                  </td>
                                  <td className="text-center py-3 px-3 border-gray-300 border-r" style={{ minWidth: 80 }}>
                                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-md font-semibold">{cylVal}</span>
                                  </td>
                                  {filteredAddGroups.map((g, gIdx) => {
                                    let comb = null;
                                    let combR = null;
                                    let combL = null;
                                    let isCellMerged = false;
                                    const isEditing = editingGroupId === g._id;

                                    // IMPROVED LOOKUP: Support single RL/Both objects OR Split R+L objects
                                    const DUAL_VARIANTS = ["RL", "R/L", "BOTH"];
                                    
                                    // 1. Try exact match from base
                                    comb = findComb(g, sphVal, cylVal, base.eye);

                                    // 2. If merged view but no exact match yet, look for single RL variants
                                    if (!comb && base.isMerged) {
                                      for (const variant of DUAL_VARIANTS) {
                                        const found = findComb(g, sphVal, cylVal, variant);
                                        if (found) {
                                          comb = found;
                                          break;
                                        }
                                      }
                                    }

                                    // 3. Fallback to splitting R and L if it's a merged view and no single object found
                                    if (!comb && base.isMerged) {
                                      combR = findComb(g, sphVal, cylVal, "R");
                                      combL = findComb(g, sphVal, cylVal, "L");
                                      if (combR && combL && combR.axis === combL.axis) {
                                        isCellMerged = true;
                                      } else {
                                        comb = combR || combL;
                                      }
                                    }

                                    const renderDual = (field, type = "text", prefix = "") => {
                                      const currentComb = comb || combR || combL;
                                      const cellEye = isCellMerged ? "R" : (currentComb?.eye || base.eye);
                                      const key = `${currentComb?.sph ?? sphVal}_${currentComb?.cyl ?? cylVal}_${cellEye}`;
                                      
                                      const val = isCellMerged 
                                        ? (combR?.[field] ?? combL?.[field] ?? "")
                                        : (currentComb?.[field] ?? "");

                                      const displayVal = editValues[g._id]?.[key]?.[field] ?? val;

                                      if (isEditing) {
                                        return (
                                          <input
                                            type={type}
                                            value={displayVal}
                                            onChange={(e) => {
                                              handleEditInputChange(g._id, key, field, e.target.value);
                                              // Synchronize the other eye if merged
                                              if (isCellMerged) {
                                                const otherKey = `${currentComb?.sph ?? sphVal}_${currentComb?.cyl ?? cylVal}_L`;
                                                handleEditInputChange(g._id, otherKey, field, e.target.value);
                                              }
                                            }}
                                            className="w-full px-2 py-1 text-xs rounded border border-slate-200 outline-none bg-white text-center"
                                          />
                                        );
                                      }

                                      return (displayVal !== undefined && displayVal !== "" && displayVal !== null) ? `${prefix}${displayVal}` : "";
                                    };

                                    return (
                                      <React.Fragment key={`cells-${rowIndex}-${gIdx}`}>
                                        <td className="text-center py-3 px-3" style={{ minWidth: 90 }}>{renderDual("barcode")}</td>
                                        <td className="text-center py-3 px-3 font-bold text-slate-700" style={{ minWidth: 70 }}>{isCellMerged ? "RL" : (comb?.eye || base?.eye || "RL")}</td>
                                        <td className="text-center py-3 px-3" style={{ minWidth: 70 }}>{isCellMerged ? (combR?.axis ?? "") : (comb?.axis ?? base?.axis ?? "")}</td>
                                        <td className="text-center py-3 px-3" style={{ minWidth: 80 }}>{renderDual("alertQty", "number")}</td>
                                        <td className="text-center py-3 px-3 font-medium text-slate-900" style={{ minWidth: 85 }}>{renderDual("pPrice", "number", "₹")}</td>
                                        <td className="text-center py-3 px-3 font-medium text-slate-900" style={{ minWidth: 85 }}>{renderDual("sPrice", "number", "₹")}</td>
                                        <td className="text-center py-3 px-3 border-gray-300 border-r" style={{ minWidth: 80 }}>{renderDual("initStock", "number")}</td>
                                      </React.Fragment>
                                    );
                                  })}
                                </tr>
                              );
                            });
                          })()
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          });
        })()}

        {/* Matrix Modal */}
        <AlertQtyMatrixModal
          isOpen={showMatrixModal}
          onClose={() => setShowMatrixModal(false)}
          groups={newData?.addGroups || []}
          powerGroups={newData?.powerGroups || []}
          onSave={handleSaveMatrix}
          eyeFilter={formData.eye}
        />
        <StockQtyMatrixModal
          isOpen={showStockMatrixModal}
          onClose={() => setShowStockMatrixModal(false)}
          groups={newData?.addGroups || []}
          powerGroups={newData?.powerGroups || []}
          onSave={handleSaveStockMatrix}
          eyeFilter={formData.eye}
        />
      </div>
    </div>
  );
}

export default LensGroupCreation;


