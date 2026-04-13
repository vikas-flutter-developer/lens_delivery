import React, { useState, useMemo } from "react";
import {
  Printer,
  FileSpreadsheet,
  RotateCcw,
  Search,
  Plus,
  Pencil,
  Trash,
} from "lucide-react";

const INITIAL_BILL_TYPES = [
  {
    id: 1,
    srno: 1,
    name: "5% GST(L)",
    category: "Sale",
    taxation: "Taxable",
    region: "Local",
  },
  {
    id: 2,
    srno: 2,
    name: "Exempt Purchase",
    category: "Purchase",
    taxation: "Exempt",
    region: "Interstate",
  },
];

export default function BillTypeMaster() {
  const [billTypes, setBillTypes] = useState(INITIAL_BILL_TYPES);
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const handleReset = () => {
    setSearchText("");
    setCategoryFilter("");
  };

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return billTypes.filter((b) => {
      const matchQ = !q || String(b.name).toLowerCase().includes(q);
      const matchCategory = !categoryFilter || b.category === categoryFilter;
      return matchQ && matchCategory;
    });
  }, [searchText, categoryFilter, billTypes]);

  const handleAdd = () => {
    const nextId = billTypes.length
      ? Math.max(...billTypes.map((b) => b.id)) + 1
      : 1;
    const newItem = {
      id: nextId,
      srno: nextId,
      name: "New Bill Type",
      category: "Sale",
      taxation: "Taxable",
      region: "Local",
    };
    setBillTypes((p) => [newItem, ...p]);
  };

  const handleEdit = (id) => {
    const item = billTypes.find((b) => b.id === id);
    if (!item) return;
    const newName = prompt("Edit Bill Type Name:", item.name);
    if (newName === null) return;
    setBillTypes((p) =>
      p.map((b) => (b.id === id ? { ...b, name: newName } : b))
    );
  };

  const handleDelete = (id) => {
    if (!confirm("Delete this bill type?")) return;
    setBillTypes((p) => p.filter((b) => b.id !== id));
  };

  const handleExport = () => {
    const headers = ["srno", "name", "category", "taxation", "region"];
    const csv = [
      headers.join(","),
      ...billTypes.map((r) =>
        headers.map((h) => `"${String(r[h] ?? "")}"`).join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    window.open(url);
  };

  const handlePrint = () => window.print();

  return (
    <div className="p-4 bg-slate-100 min-h-screen font-sans">
      <div className="max-w-[98vw] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Bill Master List
          </h1>
          <p className="text-slate-600">Manage Bill account</p>
        </div>

        {/* Filters & Actions (single-line) */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200  p-4 mb-4">
          <div className="flex items-center gap-3 whitespace-nowrap overflow-x-auto">
            {/* Search */}
            <div className="relative mt-2 min-w-[220px]">
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search by Bill Type Name"
                className="peer w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
              />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">
                Search
              </label>
            </div>

            {/* Category select */}
            <div className="flex items-center gap-2">
              <label htmlFor="billCategory" className="text-sm text-slate-600">
                Bill Category
              </label>
              <select
                id="billCategory"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">All</option>
                <option value="Sale">Sale</option>
                <option value="Purchase">Purchase</option>
              </select>
            </div>

            {/* Primary actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchText(searchText)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                <Search className="w-3.5 h-3.5" />
                Search
              </button>

              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors duration-200"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>

              <button
                onClick={handleAdd}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors duration-200"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
              <button
                onClick={handleExport}
                className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors duration-200 hover:shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
              <button
                onClick={handlePrint}
                className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200 hover:shadow-sm"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-slate-200">
              <thead className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200">
                <tr>
                  <th className="w-16 text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Sr No.
                  </th>
                  <th className="min-w-[220px] text-left py-4 px-3 text-slate-700 font-bold text-sm">
                    Bill Type Name
                  </th>
                  <th className="min-w-[140px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Bill Category
                  </th>
                  <th className="min-w-[140px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Taxation Type
                  </th>
                  <th className="min-w-[120px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Region
                  </th>
                  <th className="w-[80px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Edit
                  </th>
                  <th className="w-[80px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Delete
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-10 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-xl">No bill types found</p>
                        <p className="text-md">
                          Try adjusting your search criteria or add a new bill
                          type
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((b) => (
                    <tr
                      key={b.id}
                      className="hover:bg-slate-50 transition-colors duration-150 group text-sm"
                    >
                      <td className="text-center text-slate-600 font-medium py-4 px-2 align-top">
                        {b.srno}
                      </td>
                      <td className="py-4 px-3 text-slate-800 align-top">
                        <div className="font-medium">{b.name}</div>
                      </td>
                      <td className="py-4 px-3 text-slate-700 align-top text-center">
                        {b.category}
                      </td>
                      <td className="py-4 px-3 text-slate-700 align-top text-center">
                        {b.taxation}
                      </td>
                      <td className="py-4 px-3 text-slate-700 align-top text-center">
                        {b.region}
                      </td>

                      <td className="py-4 px-2 align-top text-center">
                        <button
                          onClick={() => handleEdit(b.id)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="py-4 px-2 align-top text-center">
                        <button
                          onClick={() => handleDelete(b.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
