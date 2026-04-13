import React, { useState, useEffect, useMemo } from "react";
import { Trash, Save, RotateCcw, Pencil, Search, Loader2 } from "lucide-react";
import { addGroup, getAllGroups, deleteGroup, updateGroup } from "../controllers/groupcontroller.js";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

function AddItemGroupMaster({ hideHeader = false, onSaveSuccess }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [searchText, setSearchText] = useState("");
  const initialForm = {
    groupName: "",
    date: new Date().toISOString().split("T")[0],
    saleDiscount: "",
    saleDiscountApplyAll: false,
    purchaseDiscount: "",
    hsnCode: "",
    hsnApplyAll: false,
    loyaltyPoint: "",
    loyaltyApplyAll: false,
    textCategory1: "",
    textCategory1ApplyAll: false,
    codeg1Limit: "",
    taxCategory2: "",
    alertNegativeQty: false,
    restrictNegativeQty: false,
  };

  const [formData, setFormData] = useState(initialForm);

  const fetchGroups = async () => {
    try {
      const res = await getAllGroups();
      if (res?.groups) {
        setGroups(res.groups);
      }
    } catch (error) {
      console.error("Failed to fetch groups:", error);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleReset = () => {
    setFormData(initialForm);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.groupName.trim()) {
      toast.error("Group Name is required.");
      return;
    }
    setLoading(true);
    try {
      if (editingId) {
        await updateGroup(editingId, formData);
        toast.success("Group updated successfully!");
      } else {
        await addGroup(formData);
        toast.success("Group added successfully!");
      }
      handleReset();
      fetchGroups();
      if (onSaveSuccess) onSaveSuccess();
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Operation failed.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (group) => {
    setEditingId(group._id);
    setFormData({
      ...group,
      date: group.date ? new Date(group.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this group?")) return;
    try {
      await deleteGroup(id);
      toast.success("Group deleted successfully");
      fetchGroups();
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to delete group";
      toast.error(errorMessage);
    }
  };

  const filteredGroups = useMemo(() => {
    return groups.filter((g) =>
      g.groupName.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [groups, searchText]);


  return (
    <div className={hideHeader ? "" : "min-h-screen bg-slate-50 p-4 md:p-6"}>
      <div className="max-w-6xl mx-auto space-y-6">
        {!hideHeader && (
          <h1 className="text-2xl font-bold text-slate-800">Add Item Group Master</h1>
        )}


        {/* Group Information Form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 md:p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            {editingId ? "Edit Group Master" : "Group Information"}
            {editingId && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-normal">Editing Mode</span>}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Group Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.groupName}
                onChange={(e) => handleInputChange("groupName", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Enter group name"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange("date", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-slate-100">
            {/* Search Input on the Left */}
            <div className="w-full sm:w-72 relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search groups..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            {/* Buttons on the Right */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                onClick={handleReset}
                className="px-5 py-2 bg-slate-100 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-200 transition-all flex items-center gap-2 shadow-sm whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 whitespace-nowrap"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingId ? "Update Group" : "Save Group"}
              </button>
            </div>
          </div>
        </div>

        {/* Existing Groups Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-bold text-slate-700">Existing Item Groups</h3>
            <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200">
              Total: {filteredGroups.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3">Sr No.</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Group Name</th>
                  <th className="px-5 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGroups.length > 0 ? (
                  filteredGroups.map((group, index) => (
                    <tr key={group._id} className="hover:bg-blue-50/50 transition-colors group">
                      <td className="px-5 py-3 text-slate-500">{index + 1}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {group.date ? new Date(group.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "-"}
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-800">{group.groupName}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(group)}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => group.canDelete !== false && handleDelete(group._id)}
                            disabled={group.canDelete === false}
                            className={`p-1.5 rounded-lg transition-colors ${group.canDelete === false ? 'text-slate-300 cursor-not-allowed' : 'text-red-600 hover:bg-red-100'}`}
                            title={group.canDelete === false ? "Cannot delete because it contains items" : "Delete"}
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-5 py-10 text-center text-slate-400 italic">
                      No groups found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddItemGroupMaster;