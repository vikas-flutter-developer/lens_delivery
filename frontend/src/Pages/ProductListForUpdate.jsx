import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  RotateCcw,
  ArrowLeft,
  Edit,
  Trash2,
  Eye,
  FileSpreadsheet,
  Printer,
  Menu,
  ChevronDown,
  Check,
  X,
  FileText,
  Save,
  Trash
} from "lucide-react";
import { getAllItems, bulkUpdateItems, deleteItem, updateItem } from "../controllers/itemcontroller";
import { getAllGroups } from "../controllers/groupcontroller";
import { syncAllLenses } from "../controllers/LensRate.controller";
import toast from "react-hot-toast";

function ProductListForUpdate() {
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    productGroup: "",
    productName: "",
    barcode: ""
  });
  const [fillValueGroupName, setFillValueGroupName] = useState("");
  const [editData, setEditData] = useState({}); // Stores changes: { [itemId]: { field: value } }
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Formula State
  const [formulaField, setFormulaField] = useState("purchasePrice");
  const [formulaOp, setFormulaOp] = useState("+");
  const [formulaVal, setFormulaVal] = useState(0);

  useEffect(() => {
    fetchData();
    fetchGroups();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getAllItems();
      const itemsList = res.items || res.data?.items || (Array.isArray(res) ? res : []);
      setItems(itemsList);
    } catch (err) {
      toast.error("Failed to fetch items");
    } finally {
      setLoading(false);
    }
  };

  // Suggestions
  const productNamesSuggestions = useMemo(() => {
    const names = new Set(items.map(item => item.itemName).filter(Boolean));
    return Array.from(names).sort();
  }, [items]);

  const fetchGroups = async () => {
    try {
      const res = await getAllGroups();
      setGroups(res.groups || res.data?.groups || (Array.isArray(res) ? res : []));
    } catch (err) {
      console.error("Failed to fetch groups", err);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleReset = () => {
    setFilters({
      productGroup: "",
      productName: "",
      barcode: ""
    });
    setEditData({});
    setSelectedIds(new Set());
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Get the current value of Group, accounting for unsaved edits
      const currentGroupName = editData[item._id]?.groupName !== undefined
        ? editData[item._id].groupName
        : (item.groupName || item.itemGroup || "");

      // Normalize group name (handle string or object)
      const getGroupNameString = (val) => {
        if (!val) return "";
        if (typeof val === 'object') return (val.groupName || val.name || "").toString();
        return val.toString();
      };

      const itemGroupStr = getGroupNameString(currentGroupName).toLowerCase().trim();
      const filterGroupStr = (filters.productGroup || "").toLowerCase().trim();

      const matchesGroup = !filterGroupStr || itemGroupStr === filterGroupStr;

      const matchesName = !filters.productName ||
        (item.itemName || "").toLowerCase().includes(filters.productName.toLowerCase());

      return matchesGroup && matchesName;
    });
  }, [filters, items, editData]);

  const handleInputChange = (itemId, field, value) => {
    setEditData(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [field]: value
      }
    }));

    // Auto-select the row when an input is changed to ensure it gets updated
    if (!selectedIds.has(itemId)) {
      const newSelected = new Set(selectedIds);
      newSelected.add(itemId);
      setSelectedIds(newSelected);
    }
  };

  const getEffectiveValue = (item, field) => {
    // If we have an unsaved edit, return that first
    if (editData[item._id] && editData[item._id][field] !== undefined) {
      return editData[item._id][field];
    }

    const val = item[field];

    // Handle Case where price might be an object { default: X }
    if (val && typeof val === 'object') {
      if (val.default !== undefined) return val.default;
      // Fallback: search for first numeric value in case of old category structure
      const firstNum = Object.values(val).find(v => typeof v === 'number');
      return firstNum !== undefined ? firstNum : "";
    }

    // Return the value if it exists (including 0), else empty string
    return (val !== undefined && val !== null) ? val : "";
  };

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i._id)));
    }
  };

  const handleFillAll = () => {
    if (!fillValueGroupName) {
      toast.error("Please select a group name to fill");
      return;
    }
    const newEditData = { ...editData };
    filteredItems.forEach(item => {
      if (selectedIds.has(item._id)) {
        newEditData[item._id] = {
          ...(newEditData[item._id] || {}),
          groupName: fillValueGroupName
        };
      }
    });
    setEditData(newEditData);
    toast.success("Group names updated for selected items");
  };

  const handleCalculate = () => {
    const newEditData = { ...editData };
    const val = parseFloat(formulaVal) || 0;

    filteredItems.forEach(item => {
      if (selectedIds.has(item._id)) {
        const currentVal = parseFloat(getEffectiveValue(item, formulaField)) || 0;
        let result = currentVal;

        if (formulaOp === "+") result = currentVal + val;
        else if (formulaOp === "-") result = currentVal - val;
        else if (formulaOp === "*") result = currentVal * val;
        else if (formulaOp === "/") result = val !== 0 ? currentVal / val : currentVal;

        newEditData[item._id] = {
          ...(newEditData[item._id] || {}),
          [formulaField]: result.toFixed(2)
        };
      }
    });
    setEditData(newEditData);
    toast.success("Calculations applied to selected items");
  };

  const handleItemNameBlur = async (itemId) => {
    const updates = editData[itemId];
    if (!updates || updates.itemName === undefined) return;

    const itemName = updates.itemName;
    const originalItem = items.find((i) => i._id === itemId);
    if (originalItem && originalItem.itemName === itemName) return;

    try {
      await updateItem(itemId, { itemName });
      toast.success(`Item name updated to "${itemName}"`);
      
      // Update local state to reflect the change
      setItems((prev) =>
        prev.map((i) => (i._id === itemId ? { ...i, itemName } : i))
      );
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update item name");
    }
  };

  const handleUpdateBulk = async () => {
    const itemsToUpdate = Object.entries(editData)
      .filter(([id]) => selectedIds.has(id))
      .map(([id, updates]) => ({
        id,
        ...updates
      }));

    if (itemsToUpdate.length === 0) {
      toast.error("No changes to update for selected items");
      return;
    }

    try {
      setLoading(true);
      await bulkUpdateItems(itemsToUpdate);
      toast.success("Items updated successfully");
      await fetchData(); // Refresh
      setEditData({});
    } catch (err) {
      toast.error("Bulk update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBulk = async () => {
    if (selectedIds.size === 0) {
      toast.error("No items selected for deletion");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} items?`)) return;

    try {
      setLoading(true);
      const deletePromises = Array.from(selectedIds).map(id => deleteItem(id));
      await Promise.all(deletePromises);
      toast.success("Selected items deleted");
      await fetchData();
      setSelectedIds(new Set());
    } catch (err) {
      toast.error("Failed to delete some items");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAll = async () => {
    if (!window.confirm("This will synchronize all lens prices from the Lens Rate Master to the item list. Continue?")) return;

    try {
      setLoading(true);
      const res = await syncAllLenses();
      if (res.success) {
        toast.success(res.data?.message || "Lenses synchronized successfully");
        await fetchData();
      } else {
        toast.error(res.error?.message || "Failed to synchronize lenses");
      }
    } catch (err) {
      toast.error("An error occurred during synchronization");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      {/* Top Header Bar */}
      <div className="bg-[#1E40AF] text-white px-4 py-2 flex items-center justify-between shadow-md">
        <h1 className="text-lg font-bold">Update/Delete Item In Bulk</h1>
        <div className="flex items-center gap-4 text-sm font-medium">
          <span>SADGURU OPTICALS (C0004)</span>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Filter Section */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-emerald-600 uppercase">Product Group</label>
              <select
                className="border border-slate-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500 bg-white"
                value={filters.productGroup}
                onChange={(e) => handleFilterChange("productGroup", e.target.value)}
              >
                <option value="">ALL GROUPS</option>
                {groups.map(g => (
                  <option key={g._id} value={g.groupName}>{g.groupName}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-emerald-600 uppercase">Product Name</label>
              <input
                type="text"
                list="product-name-suggestions"
                className="border border-slate-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                value={filters.productName}
                onChange={(e) => handleFilterChange("productName", e.target.value)}
              />
              <datalist id="product-name-suggestions">
                {productNamesSuggestions.map((name, i) => (
                  <option key={i} value={name} />
                ))}
              </datalist>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={fetchData} className="bg-[#1D4ED8] text-white px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1 hover:bg-blue-700 transition-colors">
                <Search className="w-3.5 h-3.5" /> Search
              </button>
              <button
                onClick={handleSyncAll}
                disabled={loading}
                title="Sync all lens prices from Master"
                className="bg-emerald-600 text-white px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1 hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> Sync All Lenses
              </button>
              <button onClick={handleReset} className="bg-slate-200 text-slate-700 p-1.5 rounded hover:bg-slate-300">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button className="bg-slate-50 text-emerald-600 border border-emerald-200 p-1.5 rounded hover:bg-emerald-50">
                <FileSpreadsheet className="w-4 h-4" />
              </button>
              <button className="bg-slate-50 text-slate-600 border border-slate-200 p-1.5 rounded">
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Master Table Section */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="max-h-[60vh] overflow-y-auto overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="sticky top-0 bg-[#F1F5F9] border-b border-slate-300 z-10">
                <tr className="text-slate-600 uppercase font-bold text-[10px]">
                  <th className="px-3 py-3 border-r border-slate-300 w-10">SN</th>
                  <th className="px-3 py-3 border-r border-slate-300 min-w-[200px]">Item Name</th>
                  <th className="px-3 py-3 border-r border-slate-300 min-w-[150px]">Item Group</th>
                  <th className="px-3 py-3 border-r border-slate-300 w-20 text-right">Pur Price</th>
                  <th className="px-3 py-3 border-r border-slate-300 w-20 text-right">Sale Price</th>
                  <th className="px-3 py-3 border-r border-slate-300 w-20 text-right">Mrp Price</th>

                  <th className="px-2 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredItems.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-20 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-slate-500 font-medium">Loading items...</p>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-20 text-center text-slate-400 italic">No products matched your search</td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => (
                    <tr key={item._id} className={`${selectedIds.has(item._id) ? 'bg-blue-50/50' : 'hover:bg-slate-50'} transition-colors`}>
                      <td className="px-3 py-2 border-r border-slate-200 text-slate-500 text-center font-medium">{idx + 1}.</td>
                      <td className="px-3 py-2 border-r border-slate-200">
                        <input
                          type="text"
                          className="w-full border border-slate-200 rounded px-1.5 py-1 outline-none focus:border-blue-400 bg-transparent font-bold text-slate-700"
                          value={getEffectiveValue(item, "itemName")}
                          onChange={(e) => handleInputChange(item._id, "itemName", e.target.value)}
                          onBlur={() => handleItemNameBlur(item._id)}
                        />
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 font-bold text-slate-700">{item.groupName}</td>
                      {/* <td className="px-3 py-2 border-r border-slate-200">
                        <input
                          type="text"
                          className="w-full border border-slate-200 rounded px-1.5 py-1 outline-none focus:border-blue-400 bg-transparent font-medium"
                          value={getEffectiveValue(item, "groupName")}
                          onChange={(e) => handleInputChange(item._id, "groupName", e.target.value)}
                        />
                      </td> */}
                      <td className="px-3 py-2 border-r border-slate-200">
                        <input
                          type="number"
                          className="w-full text-right border border-slate-200 rounded px-1.5 py-1 outline-none focus:border-blue-400 bg-transparent font-bold text-slate-800"
                          value={getEffectiveValue(item, "purchasePrice")}
                          onChange={(e) => handleInputChange(item._id, "purchasePrice", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200">
                        <input
                          type="number"
                          className="w-full text-right border border-slate-200 rounded px-1.5 py-1 outline-none focus:border-blue-400 bg-transparent font-bold text-slate-800"
                          value={getEffectiveValue(item, "salePrice")}
                          onChange={(e) => handleInputChange(item._id, "salePrice", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200">
                        <input
                          type="number"
                          className="w-full text-right border border-slate-200 rounded px-1.5 py-1 outline-none focus:border-blue-400 bg-transparent font-bold text-slate-800"
                          value={getEffectiveValue(item, "mrpPrice")}
                          onChange={(e) => handleInputChange(item._id, "mrpPrice", e.target.value)}
                        />
                      </td>

                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5"
                          checked={selectedIds.has(item._id)}
                          onChange={() => toggleSelect(item._id)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="bg-white p-3 rounded-lg shadow-md border border-slate-200 flex flex-col gap-4">


          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={handleUpdateBulk}
              disabled={loading}
              className="bg-[#F59E0B] text-white px-6 py-2 rounded font-bold text-xs flex items-center gap-2 hover:bg-amber-600 transition-colors shadow shadow-amber-200"
            >
              <Save className="w-4 h-4" /> Update Item
            </button>
            <button
              onClick={handleDeleteBulk}
              disabled={loading}
              className="bg-red-600 text-white px-6 py-2 rounded font-bold text-xs flex items-center gap-2 hover:bg-red-700 shadow shadow-red-200"
            >
              <Trash className="w-4 h-4" /> Delete
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductListForUpdate;