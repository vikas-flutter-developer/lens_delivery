import React, { useCallback, useEffect, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import {
  getAllVendors,
  deleteVendor,
} from "../controllers/Vendor.controller";
import { useNavigate } from "react-router-dom";
import {
  FileSpreadsheet,
  Printer,
  Plus,
  RotateCcw,
  Pencil,
  Trash,
} from "lucide-react";

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const extractList = (payload) => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.data)) return payload.data;
    return [];
  };

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAllVendors();
      if (res?.success) {
        setVendors(extractList(res.data));
      } else {
        toast.error(res?.message || "Failed to fetch vendors");
      }
    } catch (err) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const filteredVendors = vendors.filter((v) => {
    const q = search.toLowerCase().trim();

    if (!q) return true;

    return (
      (v.name ?? "").toLowerCase().includes(q) ||
      (v.email ?? "").toLowerCase().includes(q) ||
      (v.phone ?? "").toLowerCase().includes(q) ||
      (v.address ?? "").toLowerCase().includes(q) ||
      (v.gstNo ?? "").toLowerCase().includes(q) ||
      (Array.isArray(v.tags) && v.tags.join(" ").toLowerCase().includes(q))
    );
  });

  const handleAddVendor = () => {
    navigate("/masters/addvendors");
  };

  const handleEdit = (id) => {
    navigate(`/masters/addvendors/${id}`);
  };

  const handleDelete = async (id) => {
    try {
      const res = await deleteVendor(id);
      if (res?.success) {
        setVendors((prev) => prev.filter((v) => v._id !== id));
        toast.success("Vendor deleted successfully");
      } else {
        toast.error(res?.message || "Delete failed");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  const handleExportExcel = () => {
    if (!filteredVendors.length) {
      toast.error("No data to export");
      return;
    }

    const headers = ["#", "Name", "Email", "Phone", "GST No", "Address", "Tags", "Remark"];
    const csvRows = filteredVendors.map((v, i) => [
      i + 1,
      `"${v.name || ""}"`,
      `"${v.email || ""}"`,
      `"${v.phone || ""}"`,
      `"${v.gstNo || ""}"`,
      `"${(v.address || "").replace(/"/g, '""')}"`,
      `"${(v.tags || []).join(", ")}"`,
      `"${(v.remark || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers, ...csvRows]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Vendors_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Vendors exported successfully");
  };

  const handlePrint = () => {
    if (!filteredVendors.length) {
      toast.error("No data to print");
      return;
    }

    const printWindow = window.open("", "_blank");
    const tableRows = filteredVendors.map((v, i) => `
      <tr>
        <td>${i + 1}</td>
        <td style="font-weight: 600;">${v.name || "-"}</td>
        <td>${v.email || "-"}</td>
        <td>${v.phone || "-"}</td>
        <td>${v.gstNo || "-"}</td>
        <td>${v.address || "-"}</td>
        <td>${(v.tags || []).join(", ") || "-"}</td>
        <td>${v.remark || "-"}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Vendor List - ${new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1e293b; }
            .header { border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .header h1 { margin: 0; color: #1e3a8a; font-size: 24px; }
            .header p { margin: 5px 0 0 0; color: #64748b; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; border: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; }
            td { border: 1px solid #e2e8f0; padding: 8px; font-size: 11px; vertical-align: top; }
            tr:nth-child(even) { background-color: #f1f5f9; }
            .footer { margin-top: 20px; text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Vendor List</h1>
              <p>Generated on ${new Date().toLocaleString()}</p>
            </div>
            <div style="text-align: right;">
              <p>Total Vendors: <strong>${filteredVendors.length}</strong></p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th style="width: 150px;">Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>GST No</th>
                <th>Address</th>
                <th>Tags</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div class="footer">
            Computer Generated Report - ${new Date().getFullYear()}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="bg-white rounded-xl shadow-md border border-slate-200">

        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-800">Vendors</h2>
        </div>

        {/* Top Controls */}
        <div className="p-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search by Name,Email,GST,Mob,Tags, "
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 w-[250px] py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 outline-none"
          />

          <button
            onClick={() => setSearch("")}
            className="px-4 py-2 bg-slate-200 text-sm rounded-lg flex items-center gap-1"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>

          <button
            onClick={handleAddVendor}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Vendor
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3 py-2 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors"
            title="Export to Excel"
          >
            <FileSpreadsheet className="w-5 h-5" />
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors"
            title="Print"
          >
            <Printer className="w-5 h-5" />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto p-4">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-xs font-semibold text-slate-600">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">GST No</th>
                <th className="px-3 py-2 text-left">Address</th>
                <th className="px-3 py-2">Tags</th>
                <th className="px-3 py-2 text-left">Remark</th>
                <th className="px-3 py-2 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredVendors.length ? (
                filteredVendors.map((v, i) => (
                  <tr key={v._id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2">{v.name}</td>
                    <td className="px-3 py-2">{v.email || "-"}</td>
                    <td className="px-3 py-2">{v.phone || "-"}</td>
                    <td className="px-3 py-2">{v.gstNo || "-"}</td>
                    <td className="px-3 py-2">{v.address || "-"}</td>
                    <td className="px-3 py-2">
                      {v.tags?.length ? v.tags.join(", ") : "-"}
                    </td>
                    <td className="px-3 py-2">{v.remark || "-"}</td>
                    <td className="px-3 py-2 flex justify-center gap-2">
                      <button
                        onClick={() => handleEdit(v._id)}
                        className="text-blue-600"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(v._id)}
                        className="text-red-600"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-slate-400">
                    No vendors found
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
