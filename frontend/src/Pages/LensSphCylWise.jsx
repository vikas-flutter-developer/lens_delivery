import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { addGroup, getAllGroups } from "../controllers/groupcontroller";
import { getAllItems } from "../controllers/itemcontroller";
import { addLenspower } from "../controllers/LensGroupCreationController";
import { getLensPower } from "../controllers/LensGroupCreationController";
import { removeLensPower } from "../controllers/LensGroupCreationController";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  Pencil,
  Trash,
  RotateCcw,
  Plus,
  Eye,
  ChevronDown,
  ChevronUp,
  Filter,
  Download,
  Printer,
} from "lucide-react";

const customSequenceSort = (a, b) => {
  const numA = parseFloat(a);
  const numB = parseFloat(b);

  if (isNaN(numA) && isNaN(numB)) return 0;
  if (isNaN(numA)) return 1;
  if (isNaN(numB)) return -1;

  const getGroup = (n) => {
    if (n === 0) return 0;   // zero first
    if (n < 0) return 1;     // negatives second
    return 2;                // positives last
  };

  const groupA = getGroup(numA);
  const groupB = getGroup(numB);

  // Compare groups first (0 → negatives → positives)
  if (groupA !== groupB) {
    return groupA - groupB;
  }

  // Within negatives: sort descending (closest to zero first)
  // e.g. -0.25 before -0.50 before -0.75 before -1.00
  if (groupA === 1) {
    return numB - numA;
  }

  // Within positives (and zero): sort ascending
  return numA - numB;
};


function LensSPhCYLWise() {
  const [newData, setNewData] = useState(null);
  const [formData, setFormData] = useState({
    groupName: "",
    productName: "",
    sphMin: "",
    sphMax: "",
    cylMin: "",
    cylMax: "",
    axis: "",
    addMin: "",
    addMax: "",
    eye: "",
    sphStep: "0.25",
    cylStep: "0.25",
    addStep: "0.25",
    powerGroups: [],
    activeGroupIdx: null
  });

  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [lensPower, setLensPower] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const navigator = useNavigate();
  const [reorderValues, setReorderValues] = useState({});

  const handleReorderChange = (key, value) => {
    setReorderValues(prev => ({ ...prev, [key]: value }));
  };

  const getVendorsForCell = (sph, cyl, add, eyeArg) => {
    if (!newData?.vendorMap) return [];
    
    // Convert to numbers explicitly as done in backend
    const s = Number(sph) || 0;
    const c = Number(cyl) || 0;
    const a = Number(add) || 0;
    
    const prefix = `${s}_${c}_${a}_`;
    const vendors = new Set();
    
    Object.keys(newData.vendorMap).forEach(key => {
       if (key.startsWith(prefix)) {
          newData.vendorMap[key].forEach(v => vendors.add(v));
       }
    });
    
    return Array.from(vendors);
  };

  const handleGeneratePO = (group) => {
    const itemsToOrder = [];
    (group.combinations || []).forEach(c => {
      // Calculate default shortage
      const alertQty = Number(c.alertQty || 0);
      const stock = Number(c.initStock || 0);
      const defaultReorder = Math.max(alertQty - stock, 0);

      // key for state
      const key = `${group._id}_${c.sph}_${c.cyl}`;

      // specific user overrides
      const userVal = reorderValues[key];

      // final quantity: user input if exists (even if 0), else calculated default
      const finalQty = userVal !== undefined ? Number(userVal) : defaultReorder;

      if (finalQty > 0) {
        itemsToOrder.push({
          itemId: newData._id, // assuming this is the parent item ID
          add: group.addValue,
          sph: c.sph,
          cyl: c.cyl,
          qty: finalQty,
          productName: formData.productName,
          groupName: formData.groupName,
          eye: c.eye || newData?.eye || "RL"
        });
      }
    });

    if (itemsToOrder.length === 0) {
      toast.error("No items need reordering (Qty > 0)");
      return;
    }

    navigator('/lenstransaction/purchase/AddLensPurchaseOrder', { state: { items: itemsToOrder } });
  };


  const [Groups, setGroups] = useState([]);
  const [Items, setItems] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const group = await getAllGroups();
        setGroups(group.groups || []);
        const items = await getAllItems();
        setItems(items.items || []);
      } catch (err) {
        console.log("Error fetching groups/items", err);
      }
    };
    fetchData();
  }, []);

  // suggestions
  const [groupSuggestions, setGroupSuggestions] = useState([]);
  const [showGroupSuggestions, setShowGroupSuggestions] = useState(false);
  const [groupActiveIndex, setGroupActiveIndex] = useState(-1);
  const groupRef = useRef(null);

  const [productSuggestions, setProductSuggestions] = useState([]);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [productActiveIndex, setProductActiveIndex] = useState(-1);
  const productRef = useRef(null);

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

  // Handle clicking outside Power Group dropdowns
  // Handle clicking outside suggestions
  useEffect(() => {
    function handleClickOutsideSuggestions(e) {
      if (groupRef.current && !groupRef.current.contains(e.target)) {
        setShowGroupSuggestions(false);
        setGroupActiveIndex(-1);
      }
      if (productRef.current && !productRef.current.contains(e.target)) {
        setShowProductSuggestions(false);
        setProductActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutsideSuggestions);
    return () => document.removeEventListener("mousedown", handleClickOutsideSuggestions);
  }, []);

  // inputs
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
          .filter((name) => name && name.toLowerCase().includes(q));
        setGroupSuggestions(filtered);
        setShowGroupSuggestions(filtered.length > 0);
        setGroupActiveIndex(-1);
      }

      // clear product when group changed in UI
      setProductSuggestions([]);
      setShowProductSuggestions(false);
      setProductActiveIndex(-1);
    }

    if (field === "productName") {
      const q = value.trim().toLowerCase();
      // Reset ranges when product name is manually changed
      setFormData((prev) => ({
        ...prev,
        sphMin: "", sphMax: "",
        cylMin: "", cylMax: "",
        addMin: "", addMax: "",
        powerGroups: [],
        activeGroupIdx: null
      }));

      if (q.length === 0) {
        // Show all items of selected group (or all) when cleared
        const groupQ = formData.groupName.trim().toLowerCase();
        let filtered = Items || [];
        if (groupQ) {
          filtered = filtered.filter(item => item.groupName && item.groupName.toLowerCase() === groupQ);
        }
        const final = filtered.map(item => item.itemName);
        setProductSuggestions(final);
        setShowProductSuggestions(final.length > 0);
      } else {
        // Show filtered items, preferably within the same group if one is selected
        const groupQ = formData.groupName.trim().toLowerCase();
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
    setFormData((prev) => ({ ...prev, groupName: value, productName: "" }));
    setShowGroupSuggestions(false);
    setGroupActiveIndex(-1);

    setProductSuggestions([]);
    setShowProductSuggestions(false);
    setProductActiveIndex(-1);

    // Reset ranges when group changed
    setFormData((prev) => ({
      ...prev,
      sphMin: "", sphMax: "",
      cylMin: "", cylMax: "",
      addMin: "", addMax: "",
      powerGroups: [],
      activeGroupIdx: null
    }));
  };
  const selectProductSuggestion = (value) => {
    // Find the group name for this item
    const selectedItem = (Items || []).find((item) => item.itemName === value);
    const groupName = selectedItem?.groupName || "";

    setFormData((prev) => ({ ...prev, productName: value, groupName: groupName }));
    setShowProductSuggestions(false);
    setProductActiveIndex(-1);

    // Fetch Power Groups for the selected product
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

  const onGroupKeyDown = (e) => {
    if (!showGroupSuggestions || groupSuggestions.length === 0) return;
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

  const onGroupFocus = () => {
    const q = formData.groupName.trim().toLowerCase();
    const filtered = (Groups || [])
      .map((g) => g.groupName)
      .filter((name) => name && name.toLowerCase().includes(q));
    setGroupSuggestions(filtered.length > 0 ? filtered : (Groups || []).map(g => g.groupName));
    setShowGroupSuggestions(true);
    setGroupActiveIndex(-1);
  };

  const onItemFocus = () => {
    const q = formData.productName.trim().toLowerCase();
    const groupQ = formData.groupName.trim().toLowerCase();

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

  const onItemKeyDown = (e) => {
    if (!showProductSuggestions || productSuggestions.length === 0) return;
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

  const handleShowList = async () => {
    try {
      if (showDetails) {
        setShowDetails(false);
        setLensPower(null);
        setNewData(null);
        return;
      }
      const cleanData = {
        groupName: formData.groupName,
        productName: formData.productName,
      };

      const result = await getLensPower(cleanData);
      if (!result.success) {
        toast.error("No lens powers found for the given inputs.");
        setLensPower(null);
        setNewData(null);
        setShowDetails(false);
        return;
      }
      const data = result.data;
      if (!data) {
        toast.error("No lens powers found for the given inputs.");
        setLensPower(null);
        setNewData(null);
        setShowDetails(false);
        return;
      }
      setLensPower(data);
      setNewData(data);
      setShowDetails(true);
      toast.success("Lens group loaded successfully.");

      // Automatically apply filters after loading
      setTimeout(() => {
        handleFilter(data);
      }, 100);
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

  // helper find combination
  const findComb = (group, sph, cyl, axisArg = null) => {
    if (!group || !Array.isArray(group.combinations)) return null;
    return (
      group.combinations.find((c) => {
        const cs = typeof c.sph === "string" ? parseFloat(c.sph) : c.sph;
        const cc = typeof c.cyl === "string" ? parseFloat(c.cyl) : c.cyl;
        const sphMatch = parseFloat(cs) === parseFloat(sph);
        const cylMatch = parseFloat(cc) === parseFloat(cyl);
        
        if (axisArg === null) return sphMatch && cylMatch;
        
        const rowAxis = (c.axis ?? newData?.axis ?? "").toString();
        return sphMatch && cylMatch && rowAxis === axisArg.toString();
      }) || null
    );
  };

  const handleEditInputChange = (addGroupId, key, field, value) => {
    setEditValues((prev) => {
      const copy = { ...prev };
      copy[addGroupId] = copy[addGroupId] || {};
      copy[addGroupId][key] = copy[addGroupId][key] || {};
      copy[addGroupId][key][field] = value;
      return copy;
    });
  };

  // filters & flattenedRows
  const [collapsed, setCollapsed] = useState(false);
  const [filteredRows, setFilteredRows] = useState(null);
  const [filtersApplied, setFiltersApplied] = useState(false);

  // Helper to derive flattened rows from data
  const getFlattenedRowsFromData = (data) => {
    if (!data?.addGroups) return [];
    return data.addGroups.flatMap((g) =>
      (g.combinations || []).map((c) => ({ ...c, addValue: g.addValue, groupId: g._id }))
    ).sort((a, b) => {
      if (a.sph !== b.sph) return customSequenceSort(a.sph, b.sph);
      if (a.cyl !== b.cyl) return customSequenceSort(a.cyl, b.cyl);
      return customSequenceSort(a.addValue, b.addValue);
    });
  };

  const flattenedRows = getFlattenedRowsFromData(newData);

  const handleFilter = (manualData = null) => {
    const dataToUse = manualData || newData;
    if (!dataToUse) {
      toast.error("No data to filter.");
      return;
    }

    const rows = getFlattenedRowsFromData(dataToUse);

    const sphMin = formData.sphMin === "" ? null : parseFloat(formData.sphMin);
    const sphMax = formData.sphMax === "" ? null : parseFloat(formData.sphMax);

    const cylMin = formData.cylMin === "" ? null : parseFloat(formData.cylMin);
    const cylMax = formData.cylMax === "" ? null : parseFloat(formData.cylMax);

    const addMin = formData.addMin === "" ? null : parseFloat(formData.addMin);
    const addMax = formData.addMax === "" ? null : parseFloat(formData.addMax);

    const sphStep = formData.sphStep === "" ? null : parseFloat(formData.sphStep);
    const cylStep = formData.cylStep === "" ? null : parseFloat(formData.cylStep);
    const addStep = formData.addStep === "" ? null : parseFloat(formData.addStep);

    const axisFilter = formData.axis === "" ? null : formData.axis.toString();
    const eyeFilter = formData.eye === "" ? null : formData.eye.toString();

    const filtered = rows.filter((row) => {
      const sph = row.sph != null ? parseFloat(row.sph) : null;
      const cyl = row.cyl != null ? parseFloat(row.cyl) : null;
      const add = row.addValue != null ? parseFloat(row.addValue) : null;

      if (sphMin !== null && sph !== null && sph < sphMin) return false;
      if (sphMax !== null && sph !== null && sph > sphMax) return false;

      if (cylMin !== null && cyl !== null && cyl < cylMin) return false;
      if (cylMax !== null && cyl !== null && cyl > cylMax) return false;

      if (addMin !== null && add !== null && add < addMin) return false;
      if (addMax !== null && add !== null && add > addMax) return false;

      // Filter by increments (Step logic)
      if (sphStep !== null && sph !== null && sphMin !== null) {
        const diff = Math.abs(sph - sphMin);
        if (diff % sphStep > 0.01 && Math.abs((diff % sphStep) - sphStep) > 0.01) return false;
      }
      if (cylStep !== null && cyl !== null && cylMin !== null) {
        const diff = Math.abs(cyl - cylMin);
        if (diff % cylStep > 0.01 && Math.abs((diff % cylStep) - cylStep) > 0.01) return false;
      }
      if (addStep !== null && add !== null && addMin !== null) {
        const diff = Math.abs(add - addMin);
        if (diff % addStep > 0.01 && Math.abs((diff % addStep) - addStep) > 0.01) return false;
      }

      if (axisFilter !== null) {
        const rowAxis = (row.axis ?? dataToUse.axis ?? "").toString();
        if (rowAxis !== axisFilter) return false;
      }

      if (eyeFilter !== null) {
        const rowEye = (row.eye ?? dataToUse.eye ?? "").toString();
        if (eyeFilter === "RL") {
          // Show R, L and R/L variant items when "Both (RL)" is selected
          if (rowEye !== "R" && rowEye !== "L" && rowEye !== "R/L" && rowEye !== "RL") return false;
        } else if (rowEye !== eyeFilter) return false;
      }

      // (Filtered primarily by numeric inputs above)

      return true;
    });

    setFilteredRows(filtered);
    setFiltersApplied(true);
    toast.success(`Filters applied (${filtered.length} results)`);
  };

  const clearFilters = () => {
    setFilteredRows(null);
    setFiltersApplied(false);
    setFormData(prev => ({ ...prev, activeGroupIdx: null }));
    toast.success("Filters cleared");
  };

  // groupsToRender (used in original mini-tables) — this respects filteredRows
  const groupsToRender = useMemo(() => {
    if (!newData?.addGroups) return [];
    if (!filteredRows) return newData.addGroups;

    // create set of matching (add_sph_cyl) keys
    const keySet = new Set(
      (filteredRows || []).map((r) => {
        const a = parseFloat(r.addValue);
        const s = parseFloat(r.sph);
        const c = parseFloat(r.cyl);
        return `${a}_${s}_${c}`;
      })
    );

    return (newData.addGroups || [])
      .map((g) => {
        const combos = (g.combinations || []).filter((c) => {
          const a = parseFloat(g.addValue);
          const s = parseFloat(c.sph);
          const cval = parseFloat(c.cyl);
          return keySet.has(`${a}_${s}_${cval}`);
        });
        return { ...g, combinations: combos };
      })
      .filter((g) => (g.combinations || []).length > 0);
  }, [newData, filteredRows]);

  // ---------------------------
  // NEW: Show Only Add view (pivot table that sums initStock)
  // ---------------------------
  const [onlyAddView, setOnlyAddView] = useState(false);

  // choose source rows: always prefer filteredRows when filtersApplied, else flattenedRows
  const sourceRows = (filtersApplied && filteredRows && filteredRows.length > 0)
    ? filteredRows
    : flattenedRows;

  // pivot computation: addValues (columns) + rows with stocks per add
  const addPivot = useMemo(() => {
    if (!sourceRows || sourceRows.length === 0) {
      return { addValues: [], rows: [] };
    }

    // unique numeric add values sorted
    const addValues = Array.from(
      new Set(
        sourceRows
          .map((r) => {
            const v = parseFloat(r.addValue);
            return isNaN(v) ? null : v;
          })
          .filter((v) => v !== null)
      )
    ).sort(customSequenceSort);

    // map of unique sph|cyl|eye|axis combos -> {sph, cyl, eye, axis, stocks: {addVal: totalStock}}
    const comboMap = new Map();

    sourceRows.forEach((r) => {
      const sph = Number(r.sph);
      const cyl = Number(r.cyl);
      const eye = (r.eye ?? newData?.eye ?? "").toString();
      const axis = (r.axis ?? newData?.axis ?? "").toString();
      const key = `${sph}__${cyl}__${eye}__${axis}`;
      if (!comboMap.has(key)) comboMap.set(key, { sph, cyl, eye, axis, stocks: {}, barcodes: {} });

      const entry = comboMap.get(key);
      const add = parseFloat(r.addValue);
      if (isNaN(add)) return; // skip bad add
      const stockVal = Number(r.initStock ?? 0);
      entry.stocks[add] = (entry.stocks[add] || 0) + (isNaN(stockVal) ? 0 : stockVal);
      // Store barcode – if multiple exist for same key (unlikely in this context), take latest
      if (r.barcode) entry.barcodes[add] = r.barcode;
    });

    // build rows array including total (sum over addValues)
    const rows = Array.from(comboMap.values()).map((entry) => {
      const total = addValues.reduce((acc, a) => acc + (entry.stocks[a] || 0), 0);
      return { ...entry, total };
    });

    // sort rows for stable display (sph asc, cyl asc, eye, axis)
    rows.sort((x, y) => {
      if (x.sph !== y.sph) return customSequenceSort(x.sph, y.sph);
      if (x.cyl !== y.cyl) return customSequenceSort(x.cyl, y.cyl);
      if ((x.eye || "") !== (y.eye || "")) return (x.eye || "").localeCompare(y.eye || "");
      return String(x.axis || "").localeCompare(String(y.axis || ""));
    });

    return { addValues, rows };
  }, [sourceRows, newData, filtersApplied]);

  // Pivot computation for Reorder (Shortages)
  const reorderPivot = useMemo(() => {
    if (!sourceRows || sourceRows.length === 0) {
      return { addValues: [], rows: [] };
    }

    const addValues = Array.from(
      new Set(
        sourceRows
          .map((r) => {
            const v = parseFloat(r.addValue);
            return isNaN(v) ? null : v;
          })
          .filter((v) => v !== null)
      )
    ).sort(customSequenceSort);

    const comboMap = new Map();

    sourceRows.forEach((r) => {
      const sph = Number(r.sph);
      const cyl = Number(r.cyl);
      const eye = (r.eye ?? newData?.eye ?? "").toString();
      const axis = (r.axis ?? newData?.axis ?? "").toString();
      const key = `${sph}__${cyl}__${eye}__${axis}`;

      if (!comboMap.has(key)) comboMap.set(key, {
        sph,
        cyl,
        eye,
        axis,
        stocks: {},
        keys: {} // Map addValue -> uniqueStateKey for editing
      });

      const entry = comboMap.get(key);
      const add = parseFloat(r.addValue);
      if (isNaN(add)) return;

      const stock = Number(r.initStock ?? 0);
      const alert = Number(r.alertQty ?? 0);
      const shortage = Math.max(alert - stock, 0);

      entry.stocks[add] = (entry.stocks[add] || 0) + shortage;

      // key for editing state
      if (r.groupId) {
        entry.keys[add] = `${r.groupId}_${sph}_${cyl}`;
      }
    });

    const rows = Array.from(comboMap.values()).map((entry) => {
      const total = addValues.reduce((acc, a) => acc + (entry.stocks[a] || 0), 0);
      return { ...entry, total };
    });

    rows.sort((x, y) => {
      if (x.sph !== y.sph) return customSequenceSort(x.sph, y.sph);
      if (x.cyl !== y.cyl) return customSequenceSort(x.cyl, y.cyl);
      return (x.eye || "").localeCompare(y.eye || "");
    });

    return { addValues, rows };
  }, [sourceRows, newData, filtersApplied]);

  // Pivot computation for Excess Stock
  const excessPivot = useMemo(() => {
    if (!sourceRows || sourceRows.length === 0) {
      return { addValues: [], rows: [] };
    }

    const addValues = Array.from(
      new Set(
        sourceRows
          .map((r) => {
            const v = parseFloat(r.addValue);
            return isNaN(v) ? null : v;
          })
          .filter((v) => v !== null)
      )
    ).sort(customSequenceSort);

    const comboMap = new Map();

    sourceRows.forEach((r) => {
      const sph = Number(r.sph);
      const cyl = Number(r.cyl);
      const eye = (r.eye ?? newData?.eye ?? "").toString();
      const axis = (r.axis ?? newData?.axis ?? "").toString();
      const key = `${sph}__${cyl}__${eye}__${axis}`;

      if (!comboMap.has(key)) comboMap.set(key, {
        sph,
        cyl,
        eye,
        axis,
        stocks: {},
      });

      const entry = comboMap.get(key);
      const add = parseFloat(r.addValue);
      if (isNaN(add)) return;

      const stock = Number(r.initStock ?? 0);
      const alert = Number(r.alertQty ?? 0);
      const diff = Math.max(stock - alert, 0);
      entry.stocks[add] = (entry.stocks[add] || 0) + (isNaN(diff) ? 0 : diff);
    });

    const rows = Array.from(comboMap.values()).map((entry) => {
      const total = addValues.reduce((acc, a) => acc + (entry.stocks[a] || 0), 0);
      return { ...entry, total };
    });

    rows.sort((x, y) => {
      if (x.sph !== y.sph) return customSequenceSort(x.sph, y.sph);
      if (x.cyl !== y.cyl) return customSequenceSort(x.cyl, y.cyl);
      if ((x.eye || "") !== (y.eye || "")) return (x.eye || "").localeCompare(y.eye || "");
      return String(x.axis || "").localeCompare(String(y.axis || ""));
    });

    return { addValues, rows };
  }, [sourceRows, newData, filtersApplied]);

  // Handle PO Generation from Pivot View
  const handleGeneratePOFromPivot = () => {
    const itemsToOrder = [];

    reorderPivot.rows.forEach(row => {
      reorderPivot.addValues.forEach(add => {
        const key = row.keys?.[add];
        if (!key) return;

        const defaultReorder = row.stocks?.[add] || 0;
        const userVal = reorderValues[key];
        const finalQty = userVal !== undefined ? Number(userVal) : defaultReorder;

        if (finalQty > 0) {
          itemsToOrder.push({
            itemId: newData._id,
            add: add,
            sph: row.sph,
            cyl: row.cyl,
            qty: finalQty,
            productName: formData.productName,
            groupName: formData.groupName,
            eye: row.eye || "RL"
          });
        }
      });
    });

    if (itemsToOrder.length === 0) {
      toast.error("No items need reordering (Qty > 0)");
      return;
    }
    navigator('/lenstransaction/purchase/AddLensPurchaseOrder', { state: { items: itemsToOrder } });
  };


  const handleOnlyAdd = async () => {
    if (!showDetails) {
      await handleShowList();
      setOnlyAddView(true);
    } else {
      setOnlyAddView((v) => !v);
    }
  };

  // ---------------------------
  // EXPORT TO EXCEL
  // ---------------------------
  const exportToExcel = () => {
    if (!newData) {
      toast.error("No data to export. Please load lens data first.");
      return;
    }

    try {
      const workbook = XLSX.utils.book_new();

      if (onlyAddView) {
        // Export the pivot (Add View) table
        const addHeaders = [
          "SPH",
          "CYL",
          "Eye",
          ...addPivot.addValues.map((a) => `Add +${Number(a).toFixed(2)}`),
          "Row Total",
        ];

        const addData = [
          addHeaders,
          ...addPivot.rows.map((r) => [
            Number(r.sph).toFixed(2),
            Number(r.cyl).toFixed(2),
            r.eye || "RL",
            ...addPivot.addValues.map((a) => r.stocks?.[a] || 0),
            r.total,
          ]),
        ];

        // Add column totals row
        const colTotals = addPivot.addValues.map((a) =>
          addPivot.rows.reduce((sum, r) => sum + (r.stocks?.[a] || 0), 0)
        );
        const grandTotal = addPivot.rows.reduce((sum, r) => sum + r.total, 0);
        addData.push([
          "Col Total",
          "",
          "",
          ...colTotals,
          grandTotal,
        ]);

        const worksheet = XLSX.utils.aoa_to_sheet(addData);
        worksheet["!cols"] = Array(addHeaders.length).fill({ wch: 12 });
        XLSX.utils.book_append_sheet(workbook, worksheet, "Add Summary");
      } else {
        // Export detailed tables (each ADD group as a sheet) - Export ALL from newData
        const allAddGroups = newData?.addGroups || [];

        if (allAddGroups.length === 0) {
          toast.error("No ADD groups found to export.");
          return;
        }

        allAddGroups.forEach((g, groupIdx) => {
          const cyls = Array.from(
            new Set((g.combinations || []).map((c) => Number(c.cyl)))
          ).sort(customSequenceSort);
          const sphs = Array.from(
            new Set((g.combinations || []).map((c) => Number(c.sph)))
          ).sort(customSequenceSort);

          const sheetData = [];
          sheetData.push([`ADD ${parseFloat(g.addValue).toFixed(2)} - ${formData.productName}`]);
          sheetData.push([]);

          // Header row
          const headers = [
            "SPH / CYL",
            ...cyls.map((c) => Number(c).toFixed(2)),
            "Row Total",
          ];
          sheetData.push(headers);

          // Data rows
          sphs.forEach((sph) => {
            const row = [Number(sph).toFixed(2)];
            let rowTotal = 0;
            cyls.forEach((cyl) => {
              const comb = findComb(g, sph, cyl);
              const val = comb?.initStock ?? 0;
              row.push(val);
              rowTotal += Number(val);
            });
            row.push(rowTotal);
            sheetData.push(row);
          });

          // Column totals row
          const colTotals = [
            "Col Total",
            ...cyls.map((cyl) => {
              return sphs.reduce((sum, sph) => {
                const comb = findComb(g, sph, cyl);
                return sum + Number(comb?.initStock ?? 0);
              }, 0);
            }),
            sphs.reduce((grandSum, sph) => {
              return (
                grandSum +
                cyls.reduce((sum, cyl) => {
                  const comb = findComb(g, sph, cyl);
                  return sum + Number(comb?.initStock ?? 0);
                }, 0)
              );
            }, 0),
          ];
          sheetData.push(colTotals);

          const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
          worksheet["!cols"] = Array(headers.length).fill({ wch: 12 });
          XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            `ADD ${parseFloat(g.addValue).toFixed(2)}`
          );
        });
      }

      // Generate file name
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `Lens_Inventory_${formData.groupName}_${formData.productName}_${timestamp}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success("Excel file exported successfully!");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export to Excel");
    }
  };

  // ---------------------------
  // PRINT FUNCTIONALITY
  // ---------------------------
  const handlePrint = () => {
    if (!newData) {
      toast.error("No data to print. Please load lens data first.");
      return;
    }

    const printWindow = window.open('', '', 'width=1200,height=800');

    // Get the tables to print
    const addSummary = document.querySelector('.print-add-summary');
    const detailedTables = document.querySelector('.print-detailed-tables');

    const headerHtml = `
      <div style="margin-bottom: 25px; border-bottom: 3px solid #1e293b; padding-bottom: 15px; font-family: sans-serif;">
        <h1 style="font-size: 26px; margin: 0; color: #1e293b;">Lens Stock Report (SPH/CYL Wise)</h1>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px; font-size: 14px; color: #475569;">
          <div><strong>Item Name:</strong> ${formData.productName || '-'}</div>
          <div><strong>Group Name:</strong> ${formData.groupName || '-'}</div>
          <div><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
          <div style="grid-column: span 2;">
            <strong>Range:</strong> 
            SPH: ${formData.sphMin || "-"} to ${formData.sphMax || "-"} | 
            CYL: ${formData.cylMin || "-"} to ${formData.cylMax || "-"} | 
            ADD: ${formData.addMin || "-"} to ${formData.addMax || "-"}
          </div>
        </div>
      </div>
    `;

    let contentToPrint = '';
    if (onlyAddView && addSummary) {
      contentToPrint = addSummary.innerHTML;
    } else if (!onlyAddView && detailedTables) {
      contentToPrint = detailedTables.innerHTML;
    }

    if (!contentToPrint) {
      toast.error('No data to print');
      return;
    }

    const printDocument = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print - Lens Inventory</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: Arial, sans-serif;
            padding: 10px;
            background: white;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            page-break-inside: avoid;
            font-size: 11px;
          }
          
          table thead {
            display: table-header-group;
          }
          
          table tbody {
            display: table-row-group;
          }
          
          th {
            background: #e8e8e8;
            border: 1px solid #000;
            padding: 8px;
            text-align: center;
            font-weight: bold;
            color: #000;
          }
          
          td {
            border: 1px solid #000;
            padding: 8px;
            text-align: center;
            background: white;
            vertical-align: middle;
          }

          .stock-cell-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
          }

          .stock-badge {
            border: 1px solid #ccc;
            padding: 2px 6px;
            font-weight: bold;
            background: #f8fafc;
            min-width: 45px;
            border-radius: 4px;
            font-size: 11px;
            display: inline-block;
          }

          .barcode-text {
            font-size: 9px;
            color: #334155;
            font-family: monospace;
            text-transform: uppercase;
            font-weight: 700;
          }

          .tooltip-icon {
            display: none; /* Hide in print */
          }
          
          tr:nth-child(even) td {
            background: #f5f5f5;
          }
          
          .bg-blue-50, .bg-blue-100 {
            background: #d9d9d9 !important;
          }
          
          .bg-green-50, .bg-green-100 {
            background: #d9e8d9 !important;
          }
          
          .bg-yellow-50, .bg-yellow-100 {
            background: #e8e8d9 !important;
          }
          
          .bg-orange-100 {
            background: #e8d9d9 !important;
          }
          
          .border-b {
            border-bottom: 2px solid #000 !important;
          }
          
          .border-t-2 {
            border-top: 2px solid #000 !important;
          }
          
          .border-l {
            border-left: 1px solid #000 !important;
          }
          
          h3, h4 {
            margin-top: 20px;
            margin-bottom: 10px;
            font-size: 14px;
            display: block;
          }
          
          .text-slate-700,
          .text-blue-800,
          .text-slate-600 {
            color: #000 !important;
          }
          
          .no-print {
            display: none !important;
          }
          
          @media print {
            body {
              margin: 0;
              padding: 8px;
            }
            table {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        ${headerHtml}
        ${contentToPrint}
      </body>
      </html>
    `;

    printWindow.document.write(printDocument);
    printWindow.document.close();

    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
    }, 500);

    toast.success('Opening print preview...');
  };

  const animeFadeIn = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .anime-fade-in {
      animation: fadeIn 0.3s ease-out forwards;
    }
  `;

  // ---------------------------
  // Render
  // ---------------------------
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50 font-sans p-6">
      <div className="max-w-[98vw] mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Lens Stock SPH/CYL Wise
          </h1>
          <p className="text-slate-600">
            Manage lens stock inventory by SPH and CYL specifications
          </p>
        </div>

        {/* Form & filters (collapsed wrapper) */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 mb-6">
          <div className="flex items-center justify-between p-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Settings</h3>
              <p className="text-xs text-slate-500">Collapse to hide all controls</p>
            </div>
            <button
              type="button"
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((c) => !c)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm hover:bg-slate-100 transition"
            >
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          <div className={`transition-all duration-500 ease-in-out ${collapsed ? "max-h-0 opacity-0 scale-y-95 overflow-hidden" : "max-h-[2000px] opacity-100 scale-y-100 overflow-visible"} p-6`}>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex w-[75%] gap-4">
                {/* Group input */}
                <div className="relative w-full" ref={groupRef}>
                  <input
                    type="text"
                    id="groupName"
                    value={formData.groupName}
                    onChange={(e) => handleInputChange("groupName", e.target.value)}
                    onKeyDown={onGroupKeyDown}
                    onFocus={onGroupFocus}
                    autoComplete="off"
                    placeholder="Group Name"
                    className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl text-sm pr-10"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                  <label htmlFor="groupName" className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500">Group Name</label>
                  {showGroupSuggestions && groupSuggestions.length > 0 && (
                    <ul className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-md z-30 max-h-40 overflow-auto">
                      {groupSuggestions.map((g, i) => (
                        <li
                          key={`${g}_${i}`}
                          role="option"
                          aria-selected={groupActiveIndex === i}
                          onMouseDown={(ev) => { ev.preventDefault(); selectGroupSuggestion(g); }}
                          onMouseEnter={() => setGroupActiveIndex(i)}
                          className={`px-3 py-2 cursor-pointer text-sm ${groupActiveIndex === i ? "bg-blue-50 text-blue-800" : "text-slate-700"}`}
                        >
                          {g}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Product input */}
                <div className="relative w-full" ref={productRef}>
                  <input
                    type="text"
                    id="productName"
                    value={formData.productName}
                    onChange={(e) => handleInputChange("productName", e.target.value)}
                    onKeyDown={onItemKeyDown}
                    onFocus={onItemFocus}
                    autoComplete="off"
                    placeholder="Item Name"
                    className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl text-sm pr-10"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                  <label htmlFor="productName" className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500">Item Name</label>
                  {showProductSuggestions && productSuggestions.length > 0 && (
                    <ul className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-md z-30 max-h-40 overflow-auto">
                      {productSuggestions.map((p, i) => (
                        <li
                          key={`${p}_${i}`}
                          role="option"
                          aria-selected={productActiveIndex === i}
                          onMouseDown={(ev) => { ev.preventDefault(); selectProductSuggestion(p); }}
                          onMouseEnter={() => setProductActiveIndex(i)}
                          className={`px-3 py-2 cursor-pointer text-sm ${productActiveIndex === i ? "bg-blue-50 text-blue-800" : "text-slate-700"}`}
                        >
                          {p}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="w-[25%] flex justify-end items-center gap-3">
                <button
                  onClick={handleShowList}
                  className={`w-fit px-6 py-2 font-semibold rounded-xl inline-flex items-center justify-center gap-2 transition-colors duration-200 ${showDetails ? "bg-gray-300 text-gray-500" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                >
                  <Eye className="w-4 h-4" />
                  {showDetails ? "Hide" : "Show"}
                </button>

                <button
                  onClick={handleOnlyAdd}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition ${onlyAddView ? "bg-blue-50 text-blue-800" : filtersApplied ? "bg-gray-200" : "bg-gray-100"}`}
                >
                  {onlyAddView ? "Hide Add View" : "Show Only Add"}
                </button>

                <button
                  onClick={exportToExcel}
                  disabled={!showDetails}
                  className={`inline-flex items-center justify-center p-2 rounded-xl transition ${!showDetails ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-green-600 text-white hover:bg-green-700"}`}
                  title="Export to Excel"
                >
                  <Download className="w-5 h-5" />
                </button>

                <button
                  onClick={handlePrint}
                  disabled={!showDetails}
                  className={`inline-flex items-center justify-center p-2 rounded-xl transition ${!showDetails ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-purple-600 text-white hover:bg-purple-700"}`}
                  title="Print"
                >
                  <Printer className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filters UI (visible always in collapsed area) */}
            <h3 className="text-lg font-semibold text-slate-700 mb-4">Power Range</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4">
              <div className="relative">
                <input
                  type="number"
                  id="sphMin"
                  value={formData.sphMin}
                  onChange={(e) => handleInputChange("sphMin", e.target.value)}
                  step="0.25"
                  placeholder=""
                  className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
                />
                <label htmlFor="sphMin" className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500">From SPH</label>
              </div>

              <div className="relative">
                <input
                  type="number"
                  id="sphMax"
                  value={formData.sphMax}
                  onChange={(e) => handleInputChange("sphMax", e.target.value)}
                  step="0.25"
                  placeholder=""
                  className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
                />
                <label htmlFor="sphMax" className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500">To SPH</label>
              </div>

              <div className="relative">
                <input
                  type="number"
                  id="sphStep"
                  value={formData.sphStep}
                  onChange={(e) => handleInputChange("sphStep", e.target.value)}
                  step="0.25"
                  placeholder=""
                  className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
                />
                <label htmlFor="sphStep" className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500">SPH Step</label>
              </div>

              <div className="relative">
                <input
                  type="number"
                  id="cylMin"
                  value={formData.cylMin}
                  onChange={(e) => handleInputChange("cylMin", e.target.value)}
                  step="0.25"
                  placeholder=""
                  className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
                />
                <label htmlFor="cylMin" className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500">From CYL</label>
              </div>

              <div className="relative">
                <input
                  type="number"
                  id="cylMax"
                  value={formData.cylMax}
                  onChange={(e) => handleInputChange("cylMax", e.target.value)}
                  step="0.25"
                  placeholder=""
                  className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
                />
                <label htmlFor="cylMax" className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500">To CYL</label>
              </div>

              <div className="relative">
                <input
                  type="number"
                  id="cylStep"
                  value={formData.cylStep}
                  onChange={(e) => handleInputChange("cylStep", e.target.value)}
                  step="0.25"
                  placeholder=""
                  className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
                />
                <label htmlFor="cylStep" className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500">CYL Step</label>
              </div>

              <div className="relative">
                <input
                  type="number"
                  id="addMin"
                  value={formData.addMin}
                  onChange={(e) => handleInputChange("addMin", e.target.value)}
                  step="0.25"
                  placeholder=""
                  className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
                />
                <label htmlFor="addMin" className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500">From Add</label>
              </div>

              <div className="relative">
                <input
                  type="number"
                  id="addMax"
                  value={formData.addMax}
                  onChange={(e) => handleInputChange("addMax", e.target.value)}
                  step="0.25"
                  placeholder=""
                  className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
                />
                <label htmlFor="addMax" className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500">To Add</label>
              </div>

              <div className="relative">
                <input
                  type="number"
                  id="addStep"
                  value={formData.addStep}
                  onChange={(e) => handleInputChange("addStep", e.target.value)}
                  step="0.25"
                  placeholder=""
                  className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
                />
                <label htmlFor="addStep" className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500">ADD Step</label>
              </div>

              <div className="relative">
                <input
                  type="number"
                  id="axis"
                  value={formData.axis}
                  onChange={(e) => handleInputChange("axis", e.target.value)}
                  placeholder=""
                  className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
                />
                <label htmlFor="axis" className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500">Axis</label>
              </div>

              <div className="relative">
                <select
                  id="eye"
                  value={formData.eye}
                  onChange={(e) => handleInputChange("eye", e.target.value)}
                  className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm bg-white appearance-none"
                >
                  <option value="">Select Eye</option>
                  <option value="R">Right (R)</option>
                  <option value="L">Left (L)</option>
                  <option value="R/L">RL</option>
                  <option value="RL">Both (RL)</option>
                </select>
                <label htmlFor="eye" className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500">Eye (RL)</label>
              </div>
            </div>

            {/* Power Group section (Lens Group Creation style) */}
            <div className="mt-8 border-t border-slate-100 pt-6">
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Power Group Filter
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="relative">
                  <select
                    id="powerGroupSelect"
                    value={formData.activeGroupIdx ?? ""}
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
                  <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-xs text-slate-400 italic flex items-center">
                  Select a previously saved range from Lens Group Creation to quickly fill all filters above.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleFilter}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition"
              >
                <Filter className="w-4 h-4" />
                Apply
              </button>

              <button
                onClick={clearFilters}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition ${filtersApplied ? "bg-gray-200" : "bg-gray-100"}`}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* TABLE / Add pivot */}
        {showDetails && (
          <>
            {onlyAddView ? (
              <div className="bg-white rounded-xl mt-5 shadow-md border border-slate-200 overflow-auto p-3 print-add-summary">
                <h3 className="text-xs text-slate-700 font-semibold mb-3 no-print">Add Summary (per SPH / CYL / Eye)</h3>

                {(!addPivot.rows || addPivot.rows.length === 0) ? (
                  <div className="text-center py-4 text-slate-500 text-xs">No data</div>
                ) : (
                  <table className="min-w-full table-auto text-xs border-collapse">
                    <thead>
                      <tr className="bg-linear-to-r from-blue-50 to-slate-50 border-b">
                        <th className="py-1 px-2 text-left font-medium text-slate-700 whitespace-nowrap">SPH</th>
                        <th className="py-1 px-2 text-left font-medium text-slate-700 whitespace-nowrap">CYL</th>
                        <th className="py-1 px-2 text-left font-medium text-slate-700 whitespace-nowrap">Eye</th>
                        <th className="py-1 px-2 text-left font-medium text-slate-700 whitespace-nowrap">Axis</th>

                        {addPivot.addValues.map((a) => (
                          <th key={a} className="py-1 px-2 text-center font-medium text-slate-700 whitespace-nowrap bg-blue-100">+{Number(a).toFixed(2)}</th>
                        ))}

                        <th className="py-1 px-2 text-center font-medium text-slate-700 whitespace-nowrap bg-green-100">Row Total</th>
                      </tr>
                    </thead>

                    <tbody>
                      {addPivot.rows.map((r, idx) => (
                        <tr key={`${r.sph}_${r.cyl}_${r.eye}_${idx}`} className="hover:bg-slate-50 border-b border-slate-100">
                          <td className="py-1 px-2 font-medium text-slate-700">{Number(r.sph).toFixed(2)}</td>
                          <td className="py-1 px-2 font-medium text-slate-700">{Number(r.cyl).toFixed(2)}</td>
                          <td className="py-1 px-2 text-slate-700">{r.eye || "RL"}</td>
                          <td className="py-1 px-2 text-slate-700 font-mono tracking-tighter">{r.axis || "0"}</td>

                          {addPivot.addValues.map((a) => {
                             const vendors = getVendorsForCell(r.sph, r.cyl, a, r.eye);
                             const vendorTooltip = vendors.length > 0 ? `Vendors: ${vendors.join(', ')}` : "No purchase history";
                             
                             return (
                               <td key={`${r.sph}_${r.cyl}_${a}`} className="relative py-2 px-1 text-center text-slate-700 cursor-help group" title={vendorTooltip}>
                                 {vendors.length > 0 && (
                                   <div className="absolute top-1 right-1 text-[8px] text-slate-300 group-hover:text-blue-400 no-print">
                                      ⓘ
                                   </div>
                                 )}
                                 <div className="stock-cell-container flex flex-col items-center gap-1">
                                   <div className="stock-badge bg-slate-50 border border-slate-200 rounded px-2 py-1 font-bold text-slate-800 shadow-xs min-w-[3.5rem]">
                                     {r.stocks?.[a] || 0}
                                   </div>
                                   {r.barcodes?.[a] && (
                                     <div className="barcode-text text-[10px] text-slate-700 font-mono uppercase font-bold tracking-tight">
                                       {r.barcodes[a]}
                                     </div>
                                   )}
                                 </div>
                               </td>
                             );
                           })}

                          <td className="py-1 px-2 text-center font-semibold text-slate-700 bg-green-50">{r.total}</td>
                        </tr>
                      ))}

                      {/* Column Totals Row */}
                      <tr className="bg-yellow-50 font-semibold border-t-2 border-slate-300">
                        <td colSpan="4" className="py-1 px-2 text-right text-slate-700">Col Total:</td>
                        {addPivot.addValues.map((a) => {
                          const colTotal = addPivot.rows.reduce((sum, r) => sum + (r.stocks?.[a] || 0), 0);
                          return (
                            <td key={`col-total-${a}`} className="py-1 px-2 text-center font-semibold text-slate-700 bg-yellow-100">
                              {colTotal}
                            </td>
                          );
                        })}
                        <td className="py-1 px-2 text-center font-semibold text-slate-700 bg-orange-100">
                          {addPivot.rows.reduce((sum, r) => sum + r.total, 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {/* 2. REORDER TABLE (PIVOT) */}
                <h3 className="text-xs text-red-900 font-bold mb-3 mt-8 no-print uppercase tracking-wider">Reorder Shortage Summary (Min Stock - Current)</h3>

                {(!reorderPivot.rows || reorderPivot.rows.length === 0) ? (
                  <div className="text-center py-4 text-slate-500 text-xs">No reorder data</div>
                ) : (
                  <>
                    <table className="min-w-full table-auto text-xs border-collapse">
                      <thead>
                        <tr className="bg-red-100/50 border-b border-red-200">
                          <th className="py-1 px-2 text-left font-bold text-red-900 whitespace-nowrap">SPH</th>
                          <th className="py-1 px-2 text-left font-bold text-red-900 whitespace-nowrap">CYL</th>
                          <th className="py-1 px-2 text-left font-bold text-red-900 whitespace-nowrap">Eye</th>
                          <th className="py-1 px-2 text-left font-bold text-red-900 whitespace-nowrap">Axis</th>

                          {reorderPivot.addValues.map((a) => (
                            <th key={`reorder-head-${a}`} className="py-1 px-2 text-center font-bold text-red-900 whitespace-nowrap bg-red-100">+{Number(a).toFixed(2)}</th>
                          ))}
                          <th className="py-1 px-2 text-center font-bold text-slate-700 whitespace-nowrap bg-green-100">Row Σ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reorderPivot.rows.map((r, idx) => (
                          <tr key={`reorder-row-${r.sph}_${r.cyl}_${r.eye}_${idx}`} className="hover:bg-red-50/30 border-b border-red-100">
                            <td className="py-1 px-2 font-bold text-red-900 bg-red-50/30">{Number(r.sph).toFixed(2)}</td>
                            <td className="py-1 px-2 font-bold text-red-900 bg-red-50/30">{Number(r.cyl).toFixed(2)}</td>
                            <td className="py-1 px-2 font-bold text-red-900 bg-red-50/30">{r.eye || "RL"}</td>
                            <td className="py-1 px-2 font-bold text-red-900 bg-red-50/30">{r.axis || "0"}</td>

                            {reorderPivot.addValues.map((a) => {
                              const key = r.keys?.[a];
                              // Default from pivot sum (which handles the math per cell)
                              const defaultReorder = r.stocks?.[a] || 0;

                              const val = key && reorderValues[key] !== undefined ? reorderValues[key] : (defaultReorder === 0 ? "" : defaultReorder);
                              const isShort = defaultReorder > 0 || (val && Number(val) > 0);

                              return (
                                <td key={`reorder-cell-${r.sph}_${r.cyl}_${a}`} className={`py-1 px-2 text-center border-l border-red-100 ${isShort ? 'bg-red-100/40' : ''}`}>
                                  {key ? (
                                    <input
                                      type="number"
                                      value={val}
                                      onChange={(e) => handleReorderChange(key, e.target.value)}
                                      placeholder={defaultReorder > 0 ? defaultReorder : "-"}
                                      className={`w-12 text-center text-xs bg-transparent border-b border-dashed border-red-300 outline-none focus:border-red-600 focus:bg-white font-bold ${isShort ? 'text-red-700' : 'text-slate-300'}`}
                                    />
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-1 px-2 text-center font-semibold text-slate-700 bg-green-50">
                               {(() => {
                                 const total = reorderPivot.addValues.reduce((sum, a) => {
                                    const key = r.keys?.[a];
                                    const defaultReorder = r.stocks?.[a] || 0;
                                    const val = key && reorderValues[key] !== undefined ? reorderValues[key] : (defaultReorder === 0 ? "" : defaultReorder);
                                    return sum + (Number(val) || 0);
                                 }, 0);
                                 return total;
                               })()}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-yellow-50 font-semibold border-t-2 border-slate-300">
                          <td colSpan="4" className="py-1 px-2 text-right text-slate-700">Col Σ:</td>
                          {reorderPivot.addValues.map((a) => {
                            const colTotal = reorderPivot.rows.reduce((sum, r) => {
                               const key = r.keys?.[a];
                               const defaultReorder = r.stocks?.[a] || 0;
                               const val = key && reorderValues[key] !== undefined ? reorderValues[key] : (defaultReorder === 0 ? "" : defaultReorder);
                               return sum + (Number(val) || 0);
                            }, 0);
                            return <td key={`col-total-reorder-${a}`} className="py-1 px-2 text-center font-semibold text-slate-700 bg-yellow-100">{colTotal}</td>;
                          })}
                          <td className="py-1 px-2 text-center font-semibold text-slate-700 bg-orange-100">
                            {reorderPivot.rows.reduce((grandSum, r) => {
                               return grandSum + reorderPivot.addValues.reduce((sum, a) => {
                                  const key = r.keys?.[a];
                                  const defaultReorder = r.stocks?.[a] || 0;
                                  const val = key && reorderValues[key] !== undefined ? reorderValues[key] : (defaultReorder === 0 ? "" : defaultReorder);
                                  return sum + (Number(val) || 0);
                               }, 0);
                            }, 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="p-3 bg-red-50/20 flex justify-end border-t border-red-100 mt-4 no-print">
                      <button
                        onClick={handleGeneratePOFromPivot}
                        className="px-4 py-2 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg hover:bg-slate-800 transition active:scale-95 flex items-center gap-2"
                      >
                        <Plus className="w-3 h-3" />
                        Generate Purchase Order (From Summary)
                      </button>
                    </div>

                    {/* 3. EXCESS STOCK TABLE (PIVOT) */}
                    <h3 className="text-xs text-emerald-900 font-bold mb-3 mt-8 no-print uppercase tracking-wider">Excess Stock Summary (Current - Min Stock)</h3>
                    <table className="min-w-full table-auto text-xs border-collapse">
                      <thead>
                        <tr className="bg-emerald-100/50 border-b border-emerald-200">
                          <th className="py-1 px-2 text-left font-bold text-emerald-900 whitespace-nowrap">SPH</th>
                          <th className="py-1 px-2 text-left font-bold text-emerald-900 whitespace-nowrap">CYL</th>
                          <th className="py-1 px-2 text-left font-bold text-emerald-900 whitespace-nowrap">Eye</th>
                          <th className="py-1 px-2 text-left font-bold text-emerald-900 whitespace-nowrap">Axis</th>

                          {excessPivot.addValues.map((a) => (
                            <th key={`excess-head-${a}`} className="py-1 px-2 text-center font-bold text-emerald-900 whitespace-nowrap bg-emerald-100">+{Number(a).toFixed(2)}</th>
                          ))}
                          <th className="py-1 px-2 text-center font-bold text-slate-700 whitespace-nowrap bg-green-100">Row Σ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {excessPivot.rows.map((r, idx) => (
                          <tr key={`excess-row-${r.sph}_${r.cyl}_${r.eye}_${idx}`} className="hover:bg-emerald-50/30 border-b border-emerald-100">
                            <td className="py-1 px-2 font-bold text-emerald-900 bg-emerald-50/30">{Number(r.sph).toFixed(2)}</td>
                            <td className="py-1 px-2 font-bold text-emerald-900 bg-emerald-50/30">{Number(r.cyl).toFixed(2)}</td>
                            <td className="py-1 px-2 font-bold text-emerald-900 bg-emerald-50/30">{r.eye || "RL"}</td>
                            <td className="py-1 px-2 font-bold text-emerald-900 bg-emerald-50/30">{r.axis || "0"}</td>

                            {excessPivot.addValues.map((a) => {
                              const val = r.stocks?.[a];
                              const hasExcess = val > 0;
                              return (
                                <td key={`excess-cell-${r.sph}_${r.cyl}_${a}`} className={`py-1 px-2 text-center border-l border-emerald-100 ${hasExcess ? 'bg-emerald-100/40' : ''}`}>
                                  {hasExcess ? (
                                    <span className="font-bold text-emerald-700">{val}</span>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-1 px-2 text-center font-semibold text-slate-700 bg-green-50">
                               {excessPivot.addValues.reduce((sum, a) => {
                                  const val = r.stocks?.[a] || 0;
                                  return sum + (val > 0 ? val : 0);
                               }, 0)}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-yellow-50 font-semibold border-t-2 border-slate-300">
                          <td colSpan="4" className="py-1 px-2 text-right text-slate-700">Col Σ:</td>
                          {excessPivot.addValues.map((a) => {
                            const colTotal = excessPivot.rows.reduce((sum, r) => {
                               const val = r.stocks?.[a] || 0;
                               return sum + (val > 0 ? val : 0);
                            }, 0);
                            return <td key={`col-total-excess-${a}`} className="py-1 px-2 text-center font-semibold text-slate-700 bg-yellow-100">{colTotal}</td>;
                          })}
                          <td className="py-1 px-2 text-center font-semibold text-slate-700 bg-orange-100">
                            {excessPivot.rows.reduce((grandSum, r) => {
                               return grandSum + excessPivot.addValues.reduce((sum, a) => {
                                  const val = r.stocks?.[a] || 0;
                                  return sum + (val > 0 ? val : 0);
                               }, 0);
                            }, 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            ) : (
              /* original mini-tables rendering groupsToRender (unchanged) */
              <div className="space-y-4 print-detailed-tables">
                {groupsToRender.length === 0 && (
                  <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 text-center text-slate-500 text-xs">
                    No data
                  </div>
                )}

                {groupsToRender.map((g) => {
                  const cyls = Array.from(
                    new Set((g.combinations || []).map((c) => Number(c.cyl)))
                  ).sort(customSequenceSort);
                  const sphAxisRows = Array.from(
                    new Set((g.combinations || []).map((c) => {
                       const s = Number(c.sph).toFixed(2);
                       const a = (c.axis ?? newData?.axis ?? "").toString();
                       return `${s}__${a}`;
                    }))
                  ).sort((a,b) => {
                     const [sphA, axisA] = a.split("__");
                     const [sphB, axisB] = b.split("__");
                     if (sphA !== sphB) return customSequenceSort(sphA, sphB);
                     return axisA.localeCompare(axisB);
                  });

                  return (
                    <div key={g._id} className="space-y-4">
                      {/* 1. STOCK MATRIX (EXISTING) */}
                      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-x-auto">
                        <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-blue-50/50">
                          <h3 className="text-xs text-slate-700 font-semibold">ADD {parseFloat(g.addValue).toFixed(2)} - Stock</h3>
                          <span className="text-xs text-slate-600">
                            Grand Total: {" "}
                            {(g.combinations || []).reduce((sum, row) => {
                              const v = row?.initStock ?? 0;
                              return sum + (isNaN(Number(v)) ? 0 : Number(v));
                            }, 0)}
                          </span>
                        </div>

                        <div className="p-2 overflow-x-auto">
                          <table className="min-w-full table-fixed text-xs border-collapse">
                            <thead>
                              <tr className="bg-blue-50">
                                <th className="text-left py-1 px-2 text-slate-600 font-medium whitespace-nowrap" style={{ minWidth: 60 }}>
                                  SPH / CYL
                                </th>
                                <th className="text-left py-1 px-2 text-slate-600 font-medium border-l border-slate-200 whitespace-nowrap" style={{ minWidth: 60 }}>
                                  Axis
                                </th>

                                {cyls.map((cyl) => (
                                  <th key={`cyl-head-${g._id}-${cyl}`} className="text-center py-1 px-2 text-slate-600 font-medium border-l border-slate-200 whitespace-nowrap" style={{ minWidth: 60 }}>
                                    {Number(cyl).toFixed(2)}
                                  </th>
                                ))}

                                <th className="text-center py-1 px-2 text-slate-600 font-medium border-l border-slate-200 whitespace-nowrap bg-green-100" style={{ minWidth: 60 }}>
                                  Row Σ
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {sphAxisRows.map((rowKeyStr) => {
                                const [sph, axis] = rowKeyStr.split("__");
                                return (
                                  <tr key={`row-${g._id}-${rowKeyStr}`} className="hover:bg-slate-50 border-b border-slate-100">
                                    <td className="py-1 px-2 font-medium text-slate-700">
                                      <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">{sph}</span>
                                    </td>
                                    <td className="py-1 px-2 text-slate-700 border-l border-slate-200 text-xs font-mono">
                                      {axis || "0"}
                                    </td>

                                    {cyls.map((cyl) => {
                                      const key = `${sph}_${cyl}_${axis}`;
                                      const comb = findComb(g, sph, cyl, axis);
                                      const isEditing = editingGroupId === g._id;
                                      const currentEdit = editValues[g._id]?.[key] || {};

                                      const vendors = getVendorsForCell(sph, cyl, g.addValue, comb?.eye);
                                      const vendorTooltip = vendors.length > 0 ? `Vendors: ${vendors.join(', ')}` : "No purchase history";

                                      return (
                                        <td key={`cell-${g._id}-${sph}-${cyl}`} className="relative py-2 px-1 border-l border-slate-200 text-center cursor-help group" title={vendorTooltip}>
                                          {vendors.length > 0 && (
                                            <div className="absolute top-1 right-1 text-[8px] text-slate-300 group-hover:text-blue-400 no-print">
                                              ⓘ
                                            </div>
                                          )}
                                          <div className="stock-cell-container flex flex-col items-center gap-1">
                                            {isEditing ? (
                                              <input
                                                type="number"
                                                step="1"
                                                value={currentEdit.initStock ?? comb?.initStock ?? 0}
                                                onChange={(e) => handleEditInputChange(g._id, key, "initStock", e.target.value)}
                                                className="w-16 px-1 py-1 text-xs rounded border border-blue-200 font-bold outline-none text-center bg-white shadow-xs focus:ring-1 focus:ring-blue-400"
                                              />
                                            ) : (
                                              <div className="stock-badge bg-slate-50 border border-slate-200 rounded px-2 py-1 font-bold text-slate-800 shadow-xs min-w-[3.5rem] text-xs">
                                                {comb?.initStock ?? 0}
                                              </div>
                                            )}
                                            {comb?.barcode && (
                                              <div className="barcode-text text-[10px] text-slate-700 font-mono uppercase font-bold tracking-tight">
                                                {comb.barcode}
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                      );
                                    })}

                                    <td className="text-center py-1 px-2 border-l border-slate-200 font-semibold text-slate-700 bg-green-50 text-xs">
                                      {(() => {
                                        const total = (cyls || []).reduce((acc, cyl) => {
                                          const comb = findComb(g, sph, cyl, axis);
                                          return acc + Number(comb?.initStock ?? 0);
                                        }, 0);
                                        return total;
                                      })()}
                                    </td>
                                  </tr>
                                );
                              })}

                              {/* Column Totals Row */}
                              <tr className="bg-yellow-50 font-semibold border-t-2 border-slate-300">
                                <td colSpan="2" className="py-1 px-2 text-right text-slate-700 text-xs">Col Σ:</td>
                                {cyls.map((cyl) => {
                                  const colTotal = sphAxisRows.reduce((sum, rowKeyStr) => {
                                    const [sph, axis] = rowKeyStr.split("__");
                                    const comb = findComb(g, sph, cyl, axis);
                                    return sum + Number(comb?.initStock ?? 0);
                                  }, 0);
                                  return (
                                    <td key={`col-total-${g._id}-${cyl}`} className="text-center py-1 px-2 border-l border-slate-200 font-semibold text-slate-700 bg-yellow-100 text-xs">
                                      {colTotal}
                                    </td>
                                  );
                                })}
                                <td className="text-center py-1 px-2 border-l border-slate-200 font-semibold text-slate-700 bg-orange-100 text-xs">
                                  {sphAxisRows.reduce((grandSum, rowKeyStr) => {
                                    const [sph, axis] = rowKeyStr.split("__");
                                    return grandSum + cyls.reduce((sum, cyl) => {
                                      const comb = findComb(g, sph, cyl, axis);
                                      return sum + Number(comb?.initStock ?? 0);
                                    }, 0);
                                  }, 0)}
                                </td>
                              </tr>

                              {sphAxisRows.length === 0 && (
                                <tr>
                                  <td colSpan={4 + cyls.length} className="text-center py-4 text-slate-500 text-xs">No combinations for this ADD</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* 2. REORDER TABLE (NEW) */}
                      <div className="bg-slate-50 rounded-xl shadow-inner border border-slate-200 overflow-x-auto ring-1 ring-slate-200">
                        <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-red-50/50">
                          <h3 className="text-xs text-red-900 font-bold uppercase tracking-wider">Reorder Shortage (Min Stock - Current)</h3>
                        </div>

                        <div className="p-2 overflow-x-auto">
                          <table className="min-w-full table-fixed text-xs border-collapse">
                            <thead>
                              <tr className="bg-red-100/50">
                                <th className="text-left py-1 px-2 text-red-900 font-bold whitespace-nowrap" style={{ minWidth: 60 }}>
                                  SPH / CYL
                                </th>
                                <th className="text-left py-1 px-2 text-red-900 font-bold border-l border-red-200 whitespace-nowrap" style={{ minWidth: 60 }}>
                                  Axis
                                </th>
                                {cyls.map((cyl) => (
                                  <th key={`reorder-cyl-${g._id}-${cyl}`} className="text-center py-1 px-2 text-red-900 font-bold border-l border-red-200 whitespace-nowrap" style={{ minWidth: 60 }}>
                                    {Number(cyl).toFixed(2)}
                                  </th>
                                ))}
                                <th className="text-center py-1 px-2 text-slate-600 font-medium border-l border-slate-200 whitespace-nowrap bg-green-100" style={{ minWidth: 60 }}>Row Σ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sphAxisRows.map((rowKeyStr) => {
                                const [sph, axis] = rowKeyStr.split("__");
                                return (
                                  <tr key={`reorder-row-${g._id}-${rowKeyStr}`} className="border-b border-red-100 hover:bg-red-50/30">
                                    <td className="py-1 px-2 font-bold text-red-900 bg-red-50/30">
                                      {sph}
                                    </td>
                                    <td className="py-1 px-2 font-bold text-red-900 bg-red-50/30 border-l border-red-100">
                                      {axis || "0"}
                                    </td>
                                    {cyls.map((cyl) => {
                                      const comb = findComb(g, sph, cyl, axis);
                                      const stock = Number(comb?.initStock ?? 0);
                                      const alertQty = Number(comb?.alertQty ?? 0);
                                      const defaultReorder = Math.max(alertQty - stock, 0);

                                      const key = `${g._id}_${sph}_${cyl}_${axis}`;
                                      const val = reorderValues[key] !== undefined ? reorderValues[key] : (defaultReorder === 0 ? "" : defaultReorder);
                                      const isShort = defaultReorder > 0 || (val && Number(val) > 0);

                                      const vendors = getVendorsForCell(sph, cyl, g.addValue, comb?.eye);
                                      const vendorTooltip = vendors.length > 0 ? `Vendors: ${vendors.join(', ')}` : "No purchase history";

                                      return (
                                        <td key={`reorder-cell-${g._id}-${sph}-${cyl}`} className={`text-center py-1 px-2 border-l border-red-100 cursor-help ${isShort ? 'bg-red-100/40' : ''}`} title={vendorTooltip}>
                                          <input
                                            type="number"
                                            value={val}
                                            onChange={(e) => handleReorderChange(key, e.target.value)}
                                            placeholder={alertQty > 0 ? (stock < alertQty ? stock : "✓") : "-"}
                                            className={`w-12 text-center text-xs bg-transparent border-b border-dashed border-red-300 outline-none focus:border-red-600 focus:bg-white font-bold ${isShort ? 'text-red-700' : 'text-slate-300'}`}
                                          />
                                        </td>
                                      );
                                    })}
                                    <td className="text-center py-1 px-2 border-l border-slate-200 font-semibold text-slate-700 bg-green-50 text-xs">
                                      {cyls.reduce((acc, cyl) => {
                                         const comb = findComb(g, sph, cyl, axis);
                                         const stock = Number(comb?.initStock ?? 0);
                                         const alertQty = Number(comb?.alertQty ?? 0);
                                         const defaultReorder = Math.max(alertQty - stock, 0);
                                         const key = `${g._id}_${sph}_${cyl}_${axis}`;
                                         const val = reorderValues[key] !== undefined ? reorderValues[key] : (defaultReorder === 0 ? "" : defaultReorder);
                                         return acc + (Number(val) || 0);
                                      }, 0)}
                                    </td>
                                  </tr>
                                );
                              })}
                              {/* Column Totals Row */}
                              <tr className="bg-yellow-50 font-semibold border-t-2 border-slate-300">
                                <td colSpan="2" className="py-1 px-2 text-right text-slate-700 text-xs">Col Σ:</td>
                                {cyls.map((cyl) => {
                                  const colTotal = sphAxisRows.reduce((sum, rowKeyStr) => {
                                    const [sph, axis] = rowKeyStr.split("__");
                                    const comb = findComb(g, sph, cyl, axis);
                                    const stock = Number(comb?.initStock ?? 0);
                                    const alertQty = Number(comb?.alertQty ?? 0);
                                    const defaultReorder = Math.max(alertQty - stock, 0);
                                    const key = `${g._id}_${sph}_${cyl}_${axis}`;
                                    const val = reorderValues[key] !== undefined ? reorderValues[key] : (defaultReorder === 0 ? "" : defaultReorder);
                                    return sum + (Number(val) || 0);
                                  }, 0);
                                  return (
                                    <td key={`reorder-total-col-${g._id}-${cyl}`} className="text-center py-1 px-2 border-l border-slate-200 font-semibold text-slate-700 bg-yellow-100 text-xs">
                                      {colTotal}
                                    </td>
                                  );
                                })}
                                <td className="text-center py-1 px-2 border-l border-slate-200 font-semibold text-slate-700 bg-orange-100 text-xs">
                                  {sphAxisRows.reduce((grandSum, rowKeyStr) => {
                                    const [sph, axis] = rowKeyStr.split("__");
                                    return grandSum + cyls.reduce((sum, cyl) => {
                                      const comb = findComb(g, sph, cyl, axis);
                                      const stock = Number(comb?.initStock ?? 0);
                                      const alertQty = Number(comb?.alertQty ?? 0);
                                      const defaultReorder = Math.max(alertQty - stock, 0);
                                      const key = `${g._id}_${sph}_${cyl}_${axis}`;
                                      const val = reorderValues[key] !== undefined ? reorderValues[key] : (defaultReorder === 0 ? "" : defaultReorder);
                                      return sum + (Number(val) || 0);
                                    }, 0);
                                  }, 0)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <div className="p-3 bg-slate-100 flex justify-end border-t border-slate-200 no-print">
                          <button
                            onClick={() => handleGeneratePO(g)}
                            className="px-4 py-2 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg hover:bg-slate-800 transition active:scale-95 flex items-center gap-2"
                          >
                            <Plus className="w-3 h-3" />
                            Generate Purchase Order
                          </button>
                        </div>
                      </div>

                      {/* 3. EXCESS STOCK TABLE (NORMAL) */}
                      <div className="bg-emerald-50 rounded-xl shadow-inner border border-emerald-200 overflow-x-auto ring-1 ring-emerald-200">
                        <div className="flex items-center justify-between p-3 border-b border-emerald-200 bg-emerald-50">
                          <h3 className="text-xs text-emerald-900 font-bold uppercase tracking-wider">Excess Amount of Stock (Current - Min Stock)</h3>
                        </div>

                        <div className="p-2 overflow-x-auto">
                          <table className="min-w-full table-fixed text-xs border-collapse">
                            <thead>
                              <tr className="bg-emerald-100/50">
                                <th className="text-left py-1 px-2 text-emerald-900 font-bold whitespace-nowrap" style={{ minWidth: 60 }}>
                                  SPH / CYL
                                </th>
                                <th className="text-left py-1 px-2 text-emerald-900 font-bold border-l border-emerald-200 whitespace-nowrap" style={{ minWidth: 60 }}>
                                  Axis
                                </th>
                                {cyls.map((cyl) => (
                                  <th key={`excess-cyl-${g._id}-${cyl}`} className="text-center py-1 px-2 text-emerald-900 font-bold border-l border-emerald-200 whitespace-nowrap" style={{ minWidth: 60 }}>
                                    {Number(cyl).toFixed(2)}
                                  </th>
                                ))}
                                <th className="text-center py-1 px-2 text-slate-600 font-medium border-l border-slate-200 whitespace-nowrap bg-green-100" style={{ minWidth: 60 }}>Row Σ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sphAxisRows.map((rowKeyStr) => {
                                const [sph, axis] = rowKeyStr.split("__");
                                return (
                                  <tr key={`excess-row-${g._id}-${rowKeyStr}`} className="border-b border-emerald-100 hover:bg-emerald-50/30">
                                    <td className="py-1 px-2 font-bold text-emerald-900 bg-emerald-50/30">
                                      {sph}
                                    </td>
                                    <td className="py-1 px-2 font-bold text-emerald-900 bg-emerald-50/30 border-l border-emerald-100">
                                      {axis || "0"}
                                    </td>
                                    {cyls.map((cyl) => {
                                      const comb = findComb(g, sph, cyl, axis);
                                      const stock = Number(comb?.initStock ?? 0);
                                      const alertQty = Number(comb?.alertQty ?? 0);
                                      const excess = Math.max(stock - alertQty, 0);

                                      const vendors = getVendorsForCell(sph, cyl, g.addValue, comb?.eye);
                                      const vendorTooltip = vendors.length > 0 ? `Vendors: ${vendors.join(', ')}` : "No purchase history";

                                      return (
                                        <td key={`excess-cell-${g._id}-${sph}-${cyl}`} className={`text-center py-1 px-2 border-l border-emerald-100 cursor-help ${excess > 0 ? 'bg-emerald-100/40' : ''}`} title={vendorTooltip}>
                                          {excess > 0 ? (
                                            <span className="font-bold text-emerald-700">{excess}</span>
                                          ) : (
                                            <span className="text-slate-400">-</span>
                                          )}
                                        </td>
                                      );
                                    })}
                                    <td className="text-center py-1 px-2 border-l border-slate-200 font-semibold text-slate-700 bg-green-50 text-xs">
                                      {cyls.reduce((acc, cyl) => {
                                         const comb = findComb(g, sph, cyl, axis);
                                         const stock = Number(comb?.initStock ?? 0);
                                         const alertQty = Number(comb?.alertQty ?? 0);
                                         const excess = Math.max(stock - alertQty, 0);
                                         return acc + excess;
                                      }, 0)}
                                    </td>
                                  </tr>
                                );
                              })}
                              {/* Column Totals Row */}
                              <tr className="bg-yellow-50 font-semibold border-t-2 border-slate-300">
                                <td colSpan="2" className="py-1 px-2 text-right text-slate-700 text-xs">Col Σ:</td>
                                {cyls.map((cyl) => {
                                  const colTotal = sphAxisRows.reduce((sum, rowKeyStr) => {
                                    const [sph, axis] = rowKeyStr.split("__");
                                    const comb = findComb(g, sph, cyl, axis);
                                    const stock = Number(comb?.initStock ?? 0);
                                    const alertQty = Number(comb?.alertQty ?? 0);
                                    return sum + Math.max(stock - alertQty, 0);
                                  }, 0);
                                  return (
                                    <td key={`excess-total-col-${g._id}-${cyl}`} className="text-center py-1 px-2 border-l border-slate-200 font-semibold text-slate-700 bg-yellow-100 text-xs">
                                      {colTotal}
                                    </td>
                                  );
                                })}
                                <td className="text-center py-1 px-2 border-l border-slate-200 font-semibold text-slate-700 bg-orange-100 text-xs">
                                  {sphAxisRows.reduce((grandSum, rowKeyStr) => {
                                    const [sph, axis] = rowKeyStr.split("__");
                                    return grandSum + cyls.reduce((sum, cyl) => {
                                      const comb = findComb(g, sph, cyl, axis);
                                      const stock = Number(comb?.initStock ?? 0);
                                      const alertQty = Number(comb?.alertQty ?? 0);
                                      return sum + Math.max(stock - alertQty, 0);
                                    }, 0);
                                  }, 0)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Print styles
const printStyles = `
  @media print {
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }

    html {
      margin: 0 !important;
      padding: 0 !important;
    }

    body {
      margin: 0 !important;
      padding: 8px !important;
      background: white !important;
    }

    /* Hide sidebar and navigation */
    nav, aside, .sidebar, [class*="sidebar"] {
      display: none !important;
    }

    /* Hide all by default except what we want */
    .min-h-screen {
      background: white !important;
      min-height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    .max-w-[98vw] {
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    /* Hide everything inside min-h-screen first */
    .min-h-screen > * {
      display: none !important;
    }

    /* Then explicitly show the containers we want */
    .print-add-summary,
    .print-detailed-tables {
      display: block !important;
      margin: 0 !important;
      padding: 8px !important;
      background: white !important;
      border: none !important;
      page-break-inside: avoid !important;
    }

    /* Make sure all table children are visible */
    .print-add-summary *,
    .print-detailed-tables * {
      display: revert !important;
    }

    /* Tables */
    table {
      display: table !important;
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 0 !important;
      padding: 0 !important;
      page-break-inside: avoid !important;
      font-size: 11px !important;
    }

    thead {
      display: table-header-group !important;
    }

    tbody {
      display: table-row-group !important;
    }

    tr {
      display: table-row !important;
      page-break-inside: avoid !important;
    }

    th {
      display: table-cell !important;
      padding: 6px !important;
      border: 1px solid #000 !important;
      background: #e8e8e8 !important;
      font-weight: bold !important;
      text-align: center !important;
      color: #000 !important;
    }

    td {
      display: table-cell !important;
      padding: 6px !important;
      border: 1px solid #000 !important;
      text-align: center !important;
      color: #000 !important;
      background: white !important;
    }

    tr:nth-child(even) td {
      background: #f5f5f5 !important;
    }

    /* Color backgrounds */
    .bg-blue-50, .bg-blue-100 {
      background: #d9d9d9 !important;
    }

    .bg-green-50, .bg-green-100 {
      background: #d9e8d9 !important;
    }

    .bg-emerald-50, .bg-emerald-100 {
      background: #d9f2e8 !important;
    }

    .bg-yellow-50, .bg-yellow-100 {
      background: #e8e8d9 !important;
    }

    .bg-orange-100 {
      background: #e8d9d9 !important;
    }

    /* Text colors */
    .text-slate-700,
    .text-blue-800,
    .text-slate-600,
    .text-blue-700 {
      color: #000 !important;
    }

    /* Hide print label */
    .no-print {
      display: none !important;
    }

    /* Space between sections */
    .space-y-4 {
      display: block !important;
      margin: 0 !important;
    }

    .space-y-4 > * {
      display: block !important;
      margin-bottom: 20px !important;
      page-break-inside: avoid !important;
    }

    /* Remove UI styling */
    .rounded-xl, .rounded-md {
      border-radius: 0 !important;
    }

    .shadow-md {
      box-shadow: none !important;
    }

    .overflow-auto, .overflow-x-auto {
      overflow: visible !important;
    }

    .p-2, .p-3, .p-4, .p-6 {
      padding: 8px !important;
    }

    .border-b {
      border-bottom: 1px solid #000 !important;
    }

    .border-l {
      border-left: 1px solid #000 !important;
    }

    .border-t-2 {
      border-top: 2px solid #000 !important;
    }
  }
`;

if (typeof document !== "undefined" && !document.querySelector('style[data-print-styles]')) {
  const styleSheet = document.createElement("style");
  styleSheet.setAttribute('data-print-styles', 'true');
  styleSheet.textContent = printStyles;
  document.head.appendChild(styleSheet);
}

export default LensSPhCYLWise;
