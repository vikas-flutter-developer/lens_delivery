import React, { useState, useRef, useEffect } from "react";
import { Eye, Save, X, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { addGroup, getAllGroups } from "../controllers/groupcontroller";
import { getAllItems } from "../controllers/itemcontroller";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  getLensPower,
} from "../controllers/LensGroupCreationController";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import { editLensRate } from "../controllers/LensRate.controller";
import { roundAmount } from "../utils/amountUtils";

function LensRate() {
  const navigate = useNavigate();
  const toNum = (val) => Number(val) || 0;

  const [newData, setNewData] = useState(null);
  const [formData, setFormData] = useState({
    groupName: "",
    productName: "",
    purchasePrice: "",
    saleDefault: "",
    powerGroupId: "",
    axis: "",
    eye: "",
  });
  const [powerGroups, setPowerGroups] = useState([]);

  // NEW: collapsed state for settings card
  const [collapsed, setCollapsed] = useState(false);
  const { id } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const powerGroupIdFromUrl = queryParams.get("powerGroupId");

  useEffect(() => {
    if (!id) return;

    const fetchById = async () => {
      try {
        const res = await getLensPower({ id });
        const d = res?.data?.data ?? res?.data ?? res;

        if (res?.success === false) {
          toast.error(res?.message || "No data found for this ID");
          return;
        }
        if (!d || Object.keys(d).length === 0) {
          toast.error("No data found for this ID");
          return;
        }

        const pgFromUrl = d.powerGroups?.find(pg => pg._id === powerGroupIdFromUrl);

        setFormData((prev) => ({
          ...prev,
          groupName: d.groupName ?? "",
          productName: d.productName ?? "",
          axis: d.axis ?? "",
          eye: d.eye ?? "",
          purchasePrice: pgFromUrl ? (pgFromUrl.purchasePrice || 0) : (d.purchasePrice ?? ""),
          saleDefault: pgFromUrl ? (pgFromUrl.salePrice || 0) : (d.salePrice?.default ?? ""),
          powerGroupId: powerGroupIdFromUrl || "",
        }));

        setPowerGroups(d.powerGroups || []);
        // set UI data
        setLensPower(d);
        setNewData(d);
        setShowDetails(true);
        toast.success("Loaded previous data!");
      } catch (err) {
        console.error("fetchById error:", err);
        toast.error("Error fetching data");
      }
    };

    fetchById();
  }, [id, powerGroupIdFromUrl]);

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

  // Sync power groups with loaded data
  useEffect(() => {
    if (newData && Array.isArray(newData.powerGroups)) {
      setPowerGroups(newData.powerGroups);
    }
  }, [newData]);

  const [groupSuggestions, setGroupSuggestions] = useState([]);
  const [showGroupSuggestions, setShowGroupSuggestions] = useState(false);
  const [groupActiveIndex, setGroupActiveIndex] = useState(-1);
  const groupRef = useRef(null);

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

  // SINGLE setState update and suggestion logic
  const handleInputChange = (field, value) => {
    // Update formData once
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      // if groupName changed, reset productName
      ...(field === "groupName" ? { productName: "" } : {}),
    }));

    if (field === "groupName") {
      const q = value.trim().toLowerCase();
      const filtered = (Groups || [])
        .map((g) => g.groupName)
        .filter((name) => !q || (name && name.toLowerCase().includes(q)));
      setGroupSuggestions(filtered);
      setShowGroupSuggestions(filtered.length > 0);
      setGroupActiveIndex(-1);

      // Clear selection states (group changed)
      setProductSuggestions([]);
      setShowProductSuggestions(false);
      setProductActiveIndex(-1);
      setPowerGroups([]);
      setNewData(null);
    }

    if (field === "productName") {
      const q = value.trim().toLowerCase();
      const currentGroup = (formData.groupName || "").trim().toLowerCase();
      const groupFiltered = (Items || []).filter(
        (item) => !currentGroup || (item.groupName || "").trim().toLowerCase() === currentGroup
      );

      const filtered = groupFiltered
        .map((item) => item.itemName)
        .filter((name) => !q || (name && name.toLowerCase().includes(q)));

      setProductSuggestions(filtered);
      setShowProductSuggestions(filtered.length > 0);
      setProductActiveIndex(-1);

      if (q && q.length > 0) {
        const foundItem = groupFiltered.find(item => item.itemName?.toLowerCase() === q);
        if (foundItem) {
          // auto fill group name if empty
          if (!formData.groupName) {
             setFormData(prev => ({ ...prev, groupName: foundItem.groupName }));
          }
        }
      }
      
      // Clear power groups when typing new product name
      setPowerGroups([]);
      setNewData(null);
    }

    if (field === "powerGroupId") {
      const pg = powerGroups.find(g => g._id === value);
      if (pg) {
        setFormData(prev => ({
          ...prev,
          powerGroupId: value,
          purchasePrice: pg.purchasePrice || 0,
          saleDefault: pg.salePrice || 0
        }));
      } else {
        setFormData(prev => ({ ...prev, powerGroupId: value }));
      }
    }
  };

  const selectGroupSuggestion = (value) => {
    setFormData((prev) => ({ ...prev, groupName: value, productName: "" }));
    setShowGroupSuggestions(false);
    setGroupActiveIndex(-1);

    // Clear product suggestions
    setProductSuggestions([]);
    setShowProductSuggestions(false);
    setProductActiveIndex(-1);
  };

  const selectProductSuggestion = async (value) => {
    const foundItem = (Items || []).find(item => item.itemName === value);
    setFormData((prev) => ({ 
      ...prev, 
      productName: value, 
      powerGroupId: "",
      groupName: prev.groupName || (foundItem?.groupName || "")
    }));
    setShowProductSuggestions(false);
    setProductActiveIndex(-1);

    // Fetch power groups for this product
    try {
      const result = await getLensPower({ 
        productName: value, 
        groupName: formData.groupName || (foundItem?.groupName || "") 
      });
      if (result.success && result.data) {
        const d = result.data?.data || result.data;
        setPowerGroups(d.powerGroups || []);
        // If editing an existing lens power, we might already have newData
        setNewData(d);
      }
    } catch (err) {
      console.error("Error fetching power groups:", err);
    }
  };

  // keyboard handlers
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

  const [lensPower, setLensPower] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleShowList = async () => {
    try {
      if (showDetails) {
        setShowDetails(false);
        setLensPower(null);
        setNewData(null);
        return;
      }
      if (!formData.productName) {
        toast.error("Please enter product name");
        return;
      }

      if (!formData.groupName) {
        toast.error("Please enter group name");
        return;
      }

      const queryData = {
        productName: formData.productName,
        groupName: formData.groupName,
      };

      const result = await getLensPower(queryData);
      if (!result) {
        toast.error("No response from server.");
        return;
      }
      if (!result.success) {
        toast.error("No lens powers found");
        setTimeout(() => {
          const create = window.confirm(
            result.error + " Do you want to create lens power?"
          );
          if (create) {
            navigate("/lenstransaction/lensgroupcreation");
          } else {
            toast.info("Lens creation cancelled.");
          }
        }, 500);

        setShowDetails(false);
        setLensPower(null);
        setNewData(null);
        return;
      }

      // success path
      const data = result.data?.data || result.data;
      if (!data || Object.keys(data).length === 0) {
        toast.error("No lens powers found.");
        return;
      }

      setLensPower(data);
      setNewData(data);
      setPowerGroups(data.powerGroups || []);
      setShowDetails(true);
      toast.success("Lens list loaded!");
    } catch (err) {
      console.error("handleShowList error:", err);
      toast.error("Something went wrong");
    }
  };

  // NEW filtering state
  const [filteredRows, setFilteredRows] = useState(null);
  const [filtersApplied, setFiltersApplied] = useState(false);

  // flattenedRows derived from newData
  const flattenedRows = (newData?.addGroups || [])
    .flatMap((g) =>
      (g.combinations || []).map((c) => ({ ...c, addValue: g.addValue }))
    )
    .sort((a, b) => {
      if (a.sph !== b.sph) return a.sph - b.sph;
      if (a.cyl !== b.cyl) return a.cyl - b.cyl;
      return a.addValue - b.addValue;
    });

  const handleFilter = () => {
    if (!newData) {
      toast.error("No data to filter.");
      return;
    }

    const sphMin = formData.sphMin === "" ? null : parseFloat(formData.sphMin);
    const sphMax = formData.sphMax === "" ? null : parseFloat(formData.sphMax);

    const cylMin = formData.cylMin === "" ? null : parseFloat(formData.cylMin);
    const cylMax = formData.cylMax === "" ? null : parseFloat(formData.cylMax);

    const addMin = formData.addMin === "" ? null : parseFloat(formData.addMin);
    const addMax = formData.addMax === "" ? null : parseFloat(formData.addMax);

    const axisFilter = formData.axis === "" ? null : formData.axis.toString();
    const eyeFilter = formData.eye === "" ? null : formData.eye.toString();

    const filtered = flattenedRows.filter((row) => {
      const sph = row.sph != null ? parseFloat(row.sph) : null;
      const cyl = row.cyl != null ? parseFloat(row.cyl) : null;
      const add = row.addValue != null ? parseFloat(row.addValue) : null;

      if (sphMin !== null && sph !== null && sph < sphMin) return false;
      if (sphMax !== null && sph !== null && sph > sphMax) return false;

      if (cylMin !== null && cyl !== null && cyl < cylMin) return false;
      if (cylMax !== null && cyl !== null && cyl > cylMax) return false;

      if (addMin !== null && add !== null && add < addMin) return false;
      if (addMax !== null && add !== null && add > addMax) return false;

      if (axisFilter !== null) {
        const rowAxis = (row.axis ?? newData.axis ?? "").toString();
        if (rowAxis !== axisFilter) return false;
      }

      if (eyeFilter !== null) {
        const rowEye = (row.eye ?? newData.eye ?? "").toString();
        if (eyeFilter === "RL") {
          if (rowEye !== "R" && rowEye !== "L") return false;
        } else if (rowEye !== eyeFilter) return false;
      }

      return true;
    });

    setFilteredRows(filtered);
    setFiltersApplied(true);
    toast.success(`Filters applied (${filtered.length} results)`);
  };

  const clearFilters = () => {
    setFilteredRows(null);
    setFiltersApplied(false);
    toast.success("Filters cleared");
  };

  const handleSave = async () => {
    try {
      const payload = {
        id: newData?._id ?? undefined,
        powerGroupId: formData.powerGroupId,
        groupName: formData.groupName,
        productName: formData.productName,
        purchasePrice: toNum(formData.purchasePrice),
        salePrice: {
          default: toNum(formData.saleDefault),
        },
      };

      const res = await editLensRate(payload);

      if (res.success) {
        toast.success(
          res.data.message || "Lens group price updated successfully"
        );
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.error(res.error?.message || "Something went wrong");
        console.error("Update error:", res.error);
      }
    } catch (err) {
      console.log(err);
      toast.error("Error while saving.");
    }
  };

  const handleCancel = () => {
    setFormData({
      groupName: "",
      productName: "",
      eye: "",
      purchasePrice: "",
      saleDefault: "",
      powerGroupId: "",
      axis: "",
    });
    setPowerGroups([]);
  };

  // Rows to display: if filteredRows present, use that; else show full flattenedRows
  const displayRows = filteredRows ?? flattenedRows;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 font-sans p-6">

      <div className="max-w-[98vw] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Lens Rate</h1>
          <p className="text-slate-600">
            Manage lens pricing and power specifications
          </p>
        </div>

        {/* Form Section - with collapse control */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 mb-6">
          {/* collapse header */}
          <div className="flex items-center justify-between p-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Settings</h3>
              <p className="text-xs text-slate-500">
                Collapse to hide all controls
              </p>
            </div>

            <button
              type="button"
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((c) => !c)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm hover:bg-slate-100 transition"
            >
              {collapsed ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* original content wrapped so it can be hidden */}
          <div
            className={`overflow-hidden transition-all duration-500 ease-in-out ${collapsed
              ? "max-h-0 opacity-0 scale-y-95"
              : "max-h-[1000px] opacity-100 scale-y-100"
              } p-6`}
          >
            <div className="flex items-center gap-4 mb-6">
              {/* Inputs wrapper (80%) */}
              <div className="flex w-[80%] gap-4">
                {/* Group Name */}
                <div className="relative w-full" ref={groupRef}>
                  <input
                    type="text"
                    id="groupName"
                    value={formData.groupName}
                    onFocus={() => handleInputChange("groupName", formData.groupName)}
                    onChange={(e) =>
                      handleInputChange("groupName", e.target.value)
                    }
                    onKeyDown={onGroupKeyDown}
                    autoComplete="off"
                    placeholder="Group Name"
                    className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl text-sm"
                  />
                  <label
                    htmlFor="groupName"
                    className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500"
                  >
                    Group Name
                  </label>

                  {/* Group suggestions dropdown */}
                  {showGroupSuggestions && groupSuggestions.length > 0 && (
                    <ul
                      role="listbox"
                      aria-label="Group suggestions"
                      className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-md z-30 max-h-40 overflow-auto"
                    >
                      {groupSuggestions.map((g, i) => (
                        <li
                          key={g + "_" + i}
                          role="option"
                          aria-selected={groupActiveIndex === i}
                          onMouseDown={(ev) => {
                            // use onMouseDown to avoid blur before click
                            ev.preventDefault();
                            selectGroupSuggestion(g);
                          }}
                          onMouseEnter={() => setGroupActiveIndex(i)}
                          className={`px-3 py-2 cursor-pointer text-sm ${groupActiveIndex === i
                            ? "bg-blue-50 text-blue-800"
                            : "text-slate-700"
                            }`}
                        >
                          {g}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Item Name */}
                <div className="relative w-full" ref={productRef}>
                  <input
                    type="text"
                    id="productName"
                    value={formData.productName}
                    onFocus={() => handleInputChange("productName", formData.productName)}
                    onChange={(e) =>
                      handleInputChange("productName", e.target.value)
                    }
                    onKeyDown={onItemKeyDown}
                    autoComplete="off"
                    placeholder="Item Name"
                    className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl text-sm"
                  />
                  <label
                    htmlFor="productName"
                    className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500"
                  >
                    Item Name
                  </label>

                  {/* Product suggestions dropdown */}
                  {showProductSuggestions && productSuggestions.length > 0 && (
                    <ul
                      role="listbox"
                      aria-label="Product suggestions"
                      className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-md z-30 max-h-40 overflow-auto"
                    >
                      {productSuggestions.map((p, i) => (
                        <li
                          key={p + "_" + i}
                          role="option"
                          aria-selected={productActiveIndex === i}
                          onMouseDown={(ev) => {
                            ev.preventDefault();
                            selectProductSuggestion(p);
                          }}
                          onMouseEnter={() => setProductActiveIndex(i)}
                          className={`px-3 py-2 cursor-pointer text-sm ${productActiveIndex === i
                            ? "bg-blue-50 text-blue-800"
                            : "text-slate-700"
                            }`}
                        >
                          {p}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Button (20%) */}
              <div className="w-[20%] flex justify-end">
                <button
                  onClick={handleShowList}
                  className={`w-full px-6 py-2 font-semibold rounded-xl inline-flex items-center justify-center gap-2 transition-colors duration-200 ${showDetails
                    ? "bg-gray-300 text-gray-500"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                >
                  <Eye className="w-4 h-4" />
                  {showDetails ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Power Range Section */}
            <h3 className="text-lg font-semibold text-slate-700 mb-4">
              Power Range
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4">
              <div className="relative">
                <select
                  id="powerGroupId"
                  value={formData.powerGroupId}
                  onChange={(e) => handleInputChange("powerGroupId", e.target.value)}
                  className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm bg-white appearance-none"
                >
                  <option value="">Select Power Group</option>
                  {(powerGroups || []).map(pg => (
                    <option key={pg._id} value={pg._id}>
                      {pg.label || `SPH: ${pg.sphMin} to ${pg.sphMax}, CYL: ${pg.cylMin} to ${pg.cylMax}, ADD: ${pg.addMin} to ${pg.addMax}`}
                    </option>
                  ))}
                </select>
                <label
                  htmlFor="powerGroupId"
                  className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500"
                >
                  Power Group
                </label>
              </div>

              <div className="relative">
                <input
                  type="number"
                  id="axis"
                  value={formData.axis}
                  onChange={(e) => handleInputChange("axis", e.target.value)}
                  placeholder="Axis"
                  className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
                />
                <label
                  htmlFor="axis"
                  className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500"
                >
                  Axis
                </label>
              </div>
              <div className="relative">
                <select
                  id="eye"
                  value={formData.eye}
                  onChange={(e) => handleInputChange("eye", e.target.value)}
                  className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm bg-white appearance-none"
                >
                  <option value="">Select Eye</option>
                  <option value="R">R</option>
                  <option value="L">L</option>
                  <option value="RL">RL</option>
                </select>
                <label
                  htmlFor="eye"
                  className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500"
                >
                  Eye (R/L)
                </label>
              </div>

              <div className="flex items-center gap-2 col-span-2">
                <button
                  onClick={handleFilter}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition"
                >
                  <Filter />
                </button>

                <button
                  onClick={clearFilters}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition ${filtersApplied ? "bg-gray-200" : "bg-gray-100"
                    }`}
                >
                  Clear Filters
                </button>
              </div>
            </div>
            {/* Purchase Price Section */}
            <h3 className="text-lg font-semibold text-slate-700 mb-4">
              Enter Purchase Price
            </h3>
            <div className="mb-6">
              <div className="relative w-full md:w-1/3">
                <input
                  type="number"
                  id="purchasePrice"
                  value={formData.purchasePrice}
                  onChange={(e) =>
                    handleInputChange("purchasePrice", e.target.value)
                  }
                  placeholder="Purchase Price"
                  className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
                />
                <label
                  htmlFor="purchasePrice"
                  className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500"
                >
                  Purchase Price
                </label>
              </div>
            </div>

            {/* Sale Price Section */}
            <h3 className="text-lg font-semibold text-slate-700 mb-4">
              Enter Sale Price
            </h3>
            <div className="grid grid-cols-1 md:w-1/3 gap-4 mb-6">
              <div className="relative">
                <input
                  type="number"
                  id="saleDefault"
                  value={formData.saleDefault}
                  onChange={(e) =>
                    handleInputChange("saleDefault", e.target.value)
                  }
                  placeholder="Default"
                  className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
                />
                <label
                  htmlFor="saleDefault"
                  className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500"
                >
                  Sale Price (Default)
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors duration-200"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={handleCancel}
                className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors duration-200"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>

        {/* FLAT DATA TABLE - showDetails */}
        {showDetails && newData && (
          <div className="bg-white rounded-xl mt-5 shadow-md border border-slate-200 overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed divide-y divide-slate-200">
                <thead className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="w-12 text-center border-gray-300 border-r py-4 px-3 text-slate-700 font-bold text-sm">
                      Sr No.
                    </th>
                    <th className="min-w-[150px] border-gray-300 border-r text-left py-4 px-3 text-slate-700 font-bold text-sm">
                      Name
                    </th>
                    <th className="w-20 text-center py-4 px-3 border-gray-300 border-r text-slate-700 font-bold text-sm">
                      SPH
                    </th>
                    <th className="w-20 text-center py-4 px-3 border-gray-300 border-r text-slate-700 font-bold text-sm">
                      CYL
                    </th>
                    <th className="w-20 text-center py-4 px-3 border-gray-300 border-r text-slate-700 font-bold text-sm">
                      Add
                    </th>
                    <th className="w-16 text-center py-4 px-3 border-gray-300 border-r text-slate-700 font-bold text-sm">
                      Eye
                    </th>
                    <th className="w-16 text-center py-4 px-3 border-gray-300 border-r text-slate-700 font-bold text-sm">
                      Axis
                    </th>
                    <th className="w-28 text-center py-4 px-3 border-gray-300 border-r text-slate-700 font-bold text-sm">
                      Barcode
                    </th>
                    <th className="w-24 text-center py-4 px-3 border-gray-300 border-r text-slate-700 font-bold text-sm">
                      Pur Price
                    </th>
                    <th className="w-24 text-center py-4 px-3 border-gray-300 border-r text-slate-700 font-bold text-sm">
                      Sale Price
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {displayRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={15}
                        className="text-center py-6 text-slate-500"
                      >
                        No data
                      </td>
                    </tr>
                  ) : (
                    displayRows.map((row, idx) => (
                      <tr
                        key={`${row.sph}_${row.cyl}_${row.addValue}_${idx}`}
                        className="hover:bg-slate-50  transition-colors duration-150 text-sm"
                      >
                        <td className="text-center border-gray-300 border-r text-slate-600 font-medium py-3 px-3">
                          {idx + 1}
                        </td>

                        {/* Name (product + group) */}
                        <td className="w-32 py-3 px-3 border-gray-300 border-r text-slate-800">
                          <div className="font-medium">
                            {newData.productName}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {newData.groupName}
                          </div>
                        </td>

                        {/* SPH */}
                        <td className="text-center border-gray-300 border-r py-3 px-3">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-xs font-semibold">
                            {row.sph}
                          </span>
                        </td>

                        {/* CYL */}
                        <td className="text-center border-gray-300 border-r py-3 px-3">
                          <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-md text-xs font-semibold">
                            {row.cyl}
                          </span>
                        </td>

                        {/* ADD */}
                        <td className="text-center border-gray-300 border-r py-3 px-3">
                          {row.addValue}
                        </td>

                        {/* EYE */}
                        <td className="text-center  border-gray-300 border-r py-3 px-3">
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded-md text-xs font-medium">
                            {row.eye ?? newData.eye}
                          </span>
                        </td>

                        {/* AXIS */}
                        <td className="text-center border-gray-300 border-r py-3 px-3">
                          {row.axis ?? newData.axis}
                        </td>

                        {/* BARCODE (from combination) */}
                        <td className="text-center border-gray-300 border-r py-3 px-3">
                          {row.barcode ?? ""}
                        </td>

                        {/* PURCHASE PRICE (top-level) */}
                        <td className="text-center border-gray-300 border-r py-3 px-3">
                          {newData.purchasePrice != null
                            ? `₹${roundAmount(newData.purchasePrice)}`
                            : ""}
                        </td>

                        {/* SALE PRICE default (top-level salePrice.default) */}
                        <td className="text-center border-gray-300 border-r py-3 px-3">
                          {newData.salePrice?.default != null
                            ? `₹${roundAmount(newData.salePrice.default)}`
                            : ""}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LensRate;