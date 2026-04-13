import React, { useCallback, useEffect, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import {
  getAllTaxCategories,
  deleteTaxCategory,
} from "../controllers/TaxCategoryController.js";
import { useNavigate } from "react-router-dom";
import {
  FileSpreadsheet,
  Printer,
  Plus,
  RotateCcw,
  Pencil,
  Trash,
} from "lucide-react";
import { roundAmount } from "../utils/amountUtils";

export default function TaxCategoryList() {
  const [taxCategories, setTaxCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  const navigate = useNavigate();

  const extractList = (payload) => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.categories)) return payload.categories;
    if (Array.isArray(payload.taxCategories)) return payload.taxCategories;
    if (Array.isArray(payload.data)) return payload.data;
    return [];
  };

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAllTaxCategories();
      if (res && res.success) {
        const list = extractList(res.data);
        setTaxCategories(list);
      } else {
        const message = res?.error?.message || res?.error || "Failed to fetch";
        setError(message);
        toast.error(message);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message || "Unknown error");
      toast.error(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const filteredCategories = taxCategories.filter((cat) =>
    (cat.Name ?? cat.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleAddTaxCategory = () => {
    navigate("/masters/billandothermaster/Addtaxcategory");
  };

  const handleEdit = (id) => {
    navigate(`/masters/billandothermaster/Addtaxcategory/${id}`);
  };
  const handleDelete = async (id) => {
    try {
      const res = await deleteTaxCategory(id);

      if (res?.success) {
        // Update UI instantly
        setTaxCategories((prev) => prev.filter((cat) => cat._id !== id));

        toast.success("Category deleted successfully");
      } else {
        toast.error(res?.message || "Failed to delete");
      }
    } catch (err) {
      console.log(err);
      toast.error("Something went wrong");
    }
  };

  return (
    <div className="p-4 md:p-6">

      <div className="bg-white rounded-xl shadow-md border border-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-800">Tax Category</h2>
        </div>

        {/* Top Controls */}
        <div className="p-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search by Name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 outline-none"
          />

          <button
            className="px-4 py-2 bg-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-300 inline-flex items-center gap-1"
            onClick={() => setSearch("")}
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>

          <button
            onClick={handleAddTaxCategory}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 inline-flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>

          <button className="px-3 py-2 bg-slate-200 rounded-lg hover:bg-slate-300">
            <FileSpreadsheet className="w-5 h-5 text-slate-700" />
          </button>

          <button className="px-3 py-2 bg-slate-200 rounded-lg hover:bg-slate-300">
            <Printer className="w-5 h-5 text-slate-700" />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto p-4">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-slate-700 font-semibold text-xs">
                <th className="py-2 px-3 text-left">#</th>
                <th className="py-2 px-3 text-left">Name</th>
                <th className="py-2 px-3 text-left">Type</th>
                <th className="py-2 px-3 text-right">CGST</th>
                <th className="py-2 px-3 text-right">SGST</th>
                <th className="py-2 px-3 text-right">IGST</th>
                <th className="py-2 px-3 text-right">CESS</th>
                <th className="py-2 px-3 text-center">Tax on MRP</th>
                <th className="py-2 px-3 text-center">Default</th>{" "}
                {/* New column */}
                <th className="py-2 px-3 text-left">Remarks</th>
                <th className="py-2 px-3 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-slate-100">
              {filteredCategories.length > 0 ? (
                filteredCategories.map((cat, idx) => {
                  const name = cat.Name ?? cat.name ?? "-";
                  const type = cat.type ?? "-";
                  const cgst = cat.localTax1 ?? 0;
                  const sgst = cat.localTax2 ?? 0;
                  const igst = cat.centralTax ?? 0;
                  const cess = cat.cessTax ?? 0;
                  const taxOnMRP =
                    cat.taxOnMRP === true || cat.taxOnMRP === "yes"
                      ? "Yes"
                      : "No";
                  const isDefault = cat.isDefault === true ? "Yes" : "No"; // New display

                  return (
                    <tr
                      key={cat._id ?? `${name}-${idx}`}
                      className="hover:bg-slate-50"
                    >
                      <td className="py-2 px-3">{idx + 1}</td>
                      <td className="py-2 px-3">{name}</td>
                      <td className="py-2 px-3">{type}</td>
                      <td className="py-2 px-3 text-right">
                        {roundAmount(cgst)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {roundAmount(sgst)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {roundAmount(igst)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {roundAmount(cess)}
                      </td>
                      <td className="py-2 px-3 text-center">{taxOnMRP}</td>
                      <td className="py-2 px-3 text-center">
                        {isDefault}
                      </td>{" "}
                      {/* New column */}
                      <td className="py-2 px-3">{cat.remarks ?? ""}</td>
                      <td className="py-2 px-3 text-center flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(cat._id)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cat._id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={11}
                    className="text-center py-4 text-slate-500 italic"
                  >
                    No categories found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
