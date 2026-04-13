import React, { useState, useRef, useEffect, useMemo } from "react";
import { addGroup, getAllGroups } from "../controllers/groupcontroller";
import { getAllItems } from "../controllers/itemcontroller";
import { addLenspower } from "../controllers/LensGroupCreationController";
import { getLensPower } from "../controllers/LensGroupCreationController";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { addItems } from "../Store/Slices/lensItemSlice.js";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import {
  Pencil,
  Trash,
  RotateCcw,
  Plus,
  Eye,
  ChevronDown,
  ChevronUp,
  Filter,
} from "lucide-react";

function LensAddMultipleItems() {
  const dispatch = useDispatch();
  const [newData, setNewData] = useState(null);
  const [formData, setFormData] = useState({
    groupName: "",
    productName: "",
    sphMin: "",
    sphMax: "",
    cylMin: "",
    cylMax: "",
    addMin: "",
    addMax: "",
    eye: "",
  });

  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [lensPower, setLensPower] = useState(null);
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

      setProductSuggestions([]);
      setShowProductSuggestions(false);
      setProductActiveIndex(-1);
    }

    if (field === "productName") {
      const q = value.trim().toLowerCase();
      if (q.length === 0) {
        setProductSuggestions([]);
        setShowProductSuggestions(false);
      } else {
        const currentGroup = (formData.groupName || "").trim().toLowerCase();
        const groupFiltered = (Items || []).filter(
          (item) => (item.groupName || "").trim().toLowerCase() === currentGroup
        );
        const finalFiltered = groupFiltered
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
  };
  const selectProductSuggestion = (value) => {
    setFormData((prev) => ({ ...prev, productName: value }));
    setShowProductSuggestions(false);
    setProductActiveIndex(-1);
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
      console.log(result.data);
      if (!result.success || !result.data) {
        toast.error("No lens powers found for the given inputs.");
        setLensPower(null);
        setNewData(null);
        setShowDetails(false);
        return;
      }

      setLensPower(result.data);
      setNewData(result.data);
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

  // helper find combination
  const findComb = (group, sph, cyl) => {
    if (!group || !Array.isArray(group.combinations)) return null;
    return (
      group.combinations.find((c) => {
        const cs = typeof c.sph === "string" ? parseFloat(c.sph) : c.sph;
        const cc = typeof c.cyl === "string" ? parseFloat(c.cyl) : c.cyl;
        return (
          parseFloat(cs) === parseFloat(sph) &&
          parseFloat(cc) === parseFloat(cyl)
        );
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

  const groupsToRender = useMemo(() => {
    if (!newData?.addGroups) return [];
    if (!filteredRows) return newData.addGroups;

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
  // NEW: qtyInputs per combination
  // ---------------------------
  const [qtyInputs, setQtyInputs] = useState({});

  const handleQtyChange = (groupId, sph, cyl, value) => {
    const sanitized = value === "" ? "" : String(value).replace(/[^\d]/g, "");
    const key = `${groupId}_${sph}_${cyl}`;
    setQtyInputs((prev) => ({ ...prev, [key]: sanitized }));
  };

  const getSelectedItems = () => {
    const out = [];
    groupsToRender.forEach((g) => {
      const gAdd = parseFloat(g.addValue);
      (g.combinations || []).forEach((c) => {
        const barcode = c.barcode;
        const itemName = lensPower.productName;
        const sph = Number(c.sph);
        const cyl = Number(c.cyl);
        const key = `${g._id}_${sph}_${cyl}`;
        const qtyRaw = qtyInputs[key];
        const qty = qtyRaw === "" || qtyRaw == null ? 0 : Number(qtyRaw);
        if (qty > 0) {
          const purchasePrice =
            c.purchasePrice ??
            c.purchase_price ??
            g.purchasePrice ??
            g.purchase_price ??
            0;
          const salePrice = lensPower.salePrice;
          out.push({
            barcode,
            itemName,
            groupId: g._id,
            addValue: gAdd,
            sph,
            cyl,
            eye: c.eye ?? newData?.eye ?? "RL",
            initStock: c.initStock ?? 0,
            purchasePrice,
            salePrice,
            qty,
          });
        }
      });
    });
    return out;
  };

  const navigate = useNavigate()

  const HandleAddMultipleItems = async () => {
    const selectedItems = getSelectedItems();
    if (!selectedItems || selectedItems.length === 0) {
      toast.error("No items selected (qty > 0)");
      return;
    }

    // Build minimal payload for redux: keep the fields you asked for
    const itemsForRedux = selectedItems.map((s) => ({
      barcode: s.barcode ?? "",
      itemName: s.itemName ?? "",
      groupId: s.groupId,
      addValue: Number(s.addValue) || 0,
      sph: Number(s.sph) || 0,
      cyl: Number(s.cyl) || 0,
      eye: s.eye ?? "RL",
      qty: Number(s.qty) || 0,
      purchasePrice: Number(s.purchasePrice) || 0,
      // salePrice can be included if you want to show prices later
      salePrice: s.salePrice ?? null,
    }));

    // store in redux (merge logic in slice will handle duplicates)
    dispatch(addItems(itemsForRedux));
    toast.success(`${itemsForRedux.length} items stored to session`);
  
    navigate(-1);

  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 font-sans p-6">

      <div className="max-w-[98vw] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Lens</h1>
        </div>

        {/* Form & filters (collapsed wrapper) */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 mb-6">
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

          <div
            className={` transition-all duration-500 ease-in-out ${
              collapsed
                ? "max-h-0 opacity-0 scale-y-95"
                : "max-h-[1000px] opacity-100 scale-y-100"
            } p-6`}
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="flex w-[75%] gap-4">
                {/* Group input */}
                <div className="relative w-full" ref={groupRef}>
                  <input
                    type="text"
                    id="groupName"
                    value={formData.groupName}
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
                  {showGroupSuggestions && groupSuggestions.length > 0 && (
                    <ul className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-md z-30 max-h-40 overflow-auto">
                      {groupSuggestions.map((g, i) => (
                        <li
                          key={`${g}_${i}`}
                          role="option"
                          aria-selected={groupActiveIndex === i}
                          onMouseDown={(ev) => {
                            ev.preventDefault();
                            selectGroupSuggestion(g);
                          }}
                          onMouseEnter={() => setGroupActiveIndex(i)}
                          className={`px-3 py-2 cursor-pointer text-sm ${
                            groupActiveIndex === i
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

                {/* Product input */}
                <div className="relative w-full" ref={productRef}>
                  <input
                    type="text"
                    id="productName"
                    value={formData.productName}
                    onChange={(e) =>
                      handleInputChange("productName", e.target.value)
                    }
                    onKeyDown={onItemKeyDown}
                    autoComplete="off"
                    placeholder="Product Name"
                    className="peer w-full px-4 py-2 border-2 border-slate-300 rounded-xl text-sm"
                  />
                  <label
                    htmlFor="productName"
                    className="absolute left-3 -top-2.5 text-xs font-medium bg-white px-2 text-gray-500"
                  >
                    Product Name
                  </label>
                  {showProductSuggestions && productSuggestions.length > 0 && (
                    <ul className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-md z-30 max-h-40 overflow-auto">
                      {productSuggestions.map((g, i) => (
                        <li
                          key={`${g}_${i}`}
                          role="option"
                          aria-selected={productActiveIndex === i}
                          onMouseDown={(ev) => {
                            ev.preventDefault();
                            selectProductSuggestion(g);
                          }}
                          onMouseEnter={() => setProductActiveIndex(i)}
                          className={`px-3 py-2 cursor-pointer text-sm ${
                            productActiveIndex === i
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
                <div className="w-full">
                  <button
                    type="button"
                    className="px-4 py-2 bg-blue-600 w-fit hover:bg-blue-700 text-white rounded-xl"
                    onClick={handleShowList}
                  >
                    {showDetails ? "Hide List" : "Show List"}
                  </button>
                </div>
              </div>
            </div>

            {/* Filters */}
            {showDetails && (
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="number"
                  placeholder="Sph Min"
                  value={formData.sphMin}
                  onChange={(e) => handleInputChange("sphMin", e.target.value)}
                  className="px-3 py-1 border rounded-md w-24"
                />
                <input
                  type="number"
                  placeholder="Sph Max"
                  value={formData.sphMax}
                  onChange={(e) => handleInputChange("sphMax", e.target.value)}
                  className="px-3 py-1 border rounded-md w-24"
                />
                <input
                  type="number"
                  placeholder="Cyl Min"
                  value={formData.cylMin}
                  onChange={(e) => handleInputChange("cylMin", e.target.value)}
                  className="px-3 py-1 border rounded-md w-24"
                />
                <input
                  type="number"
                  placeholder="Cyl Max"
                  value={formData.cylMax}
                  onChange={(e) => handleInputChange("cylMax", e.target.value)}
                  className="px-3 py-1 border rounded-md w-24"
                />
                <input
                  type="number"
                  placeholder="Add Min"
                  value={formData.addMin}
                  onChange={(e) => handleInputChange("addMin", e.target.value)}
                  className="px-3 py-1 border rounded-md w-24"
                />
                <input
                  type="number"
                  placeholder="Add Max"
                  value={formData.addMax}
                  onChange={(e) => handleInputChange("addMax", e.target.value)}
                  className="px-3 py-1 border rounded-md w-24"
                />

                <select
                  value={formData.eye}
                  onChange={(e) => handleInputChange("eye", e.target.value)}
                  className="px-3 py-1 border rounded-md"
                >
                  <option value="">Eye</option>
                  <option value="R">R</option>
                  <option value="L">L</option>
                  <option value="RL">RL</option>
                </select>

                <button
                  onClick={handleFilter}
                  className="px-4 py-2 bg-green-600 text-white rounded-md"
                >
                  Apply Filter
                </button>
                <button
                  onClick={HandleAddMultipleItems}
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                >
                  Add Selected Items
                </button>
                {filtersApplied && (
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 bg-red-600 text-white rounded-md"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Table of items */}
        {showDetails && (
          <div className="overflow-x-auto bg-white rounded-xl  p-4 shadow-md">
            <table className="w-full table-auto border-collapse border rounded-2xl border-slate-300">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-1">Sph</th>
                  <th className="border border-slate-300 px-2 py-1">Cyl</th>
                  <th className="border border-slate-300 px-2 py-1">Add</th>
                  <th className="border border-slate-300 px-2 py-1">Eye</th>
                  <th className="border border-slate-300 px-2 py-1">Qty</th>
                </tr>
              </thead>
              <tbody>
                {groupsToRender.map((g) =>
                  (g.combinations || []).map((c) => {
                    const key = `${g._id}_${c.sph}_${c.cyl}`;
                    return (
                      <tr key={key}>
                        <td className="border border-slate-300 px-2 py-1">
                          {c.sph}
                        </td>
                        <td className="border border-slate-300 px-2 py-1">
                          {c.cyl}
                        </td>
                        <td className="border border-slate-300 px-2 py-1">
                          {g.addValue}
                        </td>
                        <td className="border border-slate-300 px-2 py-1">
                          {c.eye ?? newData?.eye}
                        </td>
                        <td className="border border-slate-300 px-2 py-1">
                          <input
                            type="tel"
                            min={0}
                            value={qtyInputs[key] ?? ""}
                            onChange={(e) =>
                              handleQtyChange(
                                g._id,
                                c.sph,
                                c.cyl,
                                e.target.value
                              )
                            }
                            className="w-16 px-2 py-1 border rounded-md text-sm"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <div className="mt-4 flex justify-end"></div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LensAddMultipleItems;
