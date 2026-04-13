import React, { useState, useMemo } from "react";
import { Printer, Search, RotateCcw, Plus, FileSpreadsheet, Pencil, Trash } from "lucide-react";

const INITIAL_SUNDRIES = [
  { id: 1, srno: 1, name: "Cess Sundry", printName: "Cess Sundry", type: "Additive", defaultType: "0" },
  { id: 2, srno: 2, name: "GST Sundry", printName: "GST Sundry", type: "Tax", defaultType: "1" },
];

export default function SundryMasterList() {
  const [sundries, setSundries] = useState(INITIAL_SUNDRIES);
  const [searchText, setSearchText] = useState("");

  const handleReset = () => setSearchText("");

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return sundries;
    return sundries.filter((s) => {
      return (
        String(s.name).toLowerCase().includes(q) ||
        String(s.printName).toLowerCase().includes(q) ||
        String(s.type).toLowerCase().includes(q)
      );
    });
  }, [searchText, sundries]);

  const handleAdd = () => {
    const nextId = sundries.length ? Math.max(...sundries.map((s) => s.id)) + 1 : 1;
    const newItem = { id: nextId, srno: nextId, name: "New Sundry", printName: "New Sundry", type: "Type", defaultType: "0" };
    setSundries((p) => [newItem, ...p]);
  };

  const handleDelete = (id) => {
    setSundries((p) => p.filter((s) => s.id !== id));
  };

  const handleEdit = (id) => {
    // simple inline edit demo: prompt (replace with modal/form in real app)
    const item = sundries.find((s) => s.id === id);
    if (!item) return;
    const newName = prompt("Edit Sundry Name:", item.name);
    if (newName === null) return;
    setSundries((p) => p.map((s) => (s.id === id ? { ...s, name: newName } : s)));
  };

  const handleExport = () => {
    // mock CSV export - convert to CSV and open in new tab
    const headers = ["srno", "name", "printName", "type", "defaultType"];
    const csv = [headers.join(","), ...sundries.map((r) => headers.map((h) => `"${String(r[h] ?? "")}"`).join(","))].join("\n");
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
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Sundry Master List</h1>
          <p className="text-slate-600">Manage Sundry account</p>
        </div>

        {/* Search & Actions */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 mb-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="relative">
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search by Sundry Name , Print Name , Type"
                className="peer w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
              />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Search</label>
            </div>

            <div className="flex flex-wrap justify-start gap-2">
              <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200">
                <Search className="w-3.5 h-3.5" />
                Search
              </button>
              <button onClick={handleReset} className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors duration-200">
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
              <button onClick={handleAdd} className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors duration-200">
                <Plus className="w-3.5 h-3.5" />
                Add Sundry
              </button>

              <button onClick={handleExport} className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors duration-200 hover:shadow-sm">
                <FileSpreadsheet className="w-4 h-4" />
              </button>
              <button onClick={handlePrint} className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200 hover:shadow-sm">
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
                  <th className="w-16 text-center py-4 px-3 text-slate-700 font-bold text-sm">Sr No.</th>
                  <th className="min-w-[220px] text-left py-4 px-3 text-slate-700 font-bold text-sm">Sundry Name</th>
                  <th className="min-w-[180px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Print Name</th>
                  <th className="min-w-[140px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Sundry Type</th>
                  <th className="min-w-[120px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Default Type</th>
                  <th className="w-[80px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Edit</th>
                  <th className="w-[80px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Delete</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-10 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-xl">No sundry found</p>
                        <p className="text-md">Try adjusting your search criteria or add a new sundry</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors duration-150 group text-sm">
                      <td className="text-center text-slate-600 font-medium py-4 px-2 align-top">{s.srno}</td>
                      <td className="py-4 px-3 text-slate-800 align-top">
                        <div className="font-medium">{s.name}</div>
                      </td>
                      <td className="py-4 px-3 text-slate-700 align-top text-center">{s.printName}</td>
                      <td className="py-4 px-3 text-slate-700 align-top text-center">{s.type}</td>
                      <td className="py-4 px-3 text-slate-700 align-top text-center">{s.defaultType}</td>
                      <td className="py-4 px-2 align-top text-center">
                        <button onClick={() => handleEdit(s.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="py-4 px-2 align-top text-center">
                        <button onClick={() => handleDelete(s.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200">
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
