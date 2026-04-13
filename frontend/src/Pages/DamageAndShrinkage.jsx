import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Printer,
  FileSpreadsheet,
  Pencil,
  Trash2,
  Search,
  RotateCcw,
  Menu,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getAllDamageEntries,
  deleteDamageEntry,
} from "../controllers/DamageEntry.controller";

// ── helpers ────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return d;
  }
};

const fmtINR = (n) =>
  (Number(n) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ── component ──────────────────────────────────────────────────────────────
export default function DamageAndShrinkage() {
  const navigate = useNavigate();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const [filters, setFilters] = useState({
    billSeries: "",
    dateFrom: "",
    dateTo: "",
    searchText: "",
  });

  // ── fetch all entries ──
  const fetchEntries = async () => {
    setLoading(true);
    const res = await getAllDamageEntries();
    if (res.success) {
      setEntries(res.data || []);
    } else {
      toast.error(res.error || "Failed to load entries");
      setEntries([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  // ── filters ──
  const handleFilterChange = (field, value) =>
    setFilters((p) => ({ ...p, [field]: value }));

  const handleReset = () =>
    setFilters({ billSeries: "", dateFrom: "", dateTo: "", searchText: "" });

  const filtered = useMemo(() => {
    const q = filters.searchText.toLowerCase();
    return entries.filter((v) => {
      if (
        q &&
        !`${v.billNo} ${v.billSeries} ${v.type} ${v.godown} ${(v.items || [])
          .map((it) => it.itemName)
          .join(" ")}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      if (
        filters.billSeries &&
        !(v.billSeries || "")
          .toLowerCase()
          .includes(filters.billSeries.toLowerCase())
      )
        return false;
      if (filters.dateFrom) {
        const d = v.date ? new Date(v.date) : null;
        if (!d || d < new Date(filters.dateFrom)) return false;
      }
      if (filters.dateTo) {
        const d = v.date ? new Date(v.date) : null;
        if (!d || d > new Date(filters.dateTo + "T23:59:59")) return false;
      }
      return true;
    });
  }, [entries, filters]);

  // ── totals ──
  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, v) => ({
        qty: acc.qty + (Number(v.totalQty) || 0),
        amt: acc.amt + (Number(v.totalAmt) || 0),
      }),
      { qty: 0, amt: 0 }
    );
  }, [filtered]);

  // ── export to Excel (CSV) ──
  const handleExportExcel = () => {
    if (!filtered.length) { toast.error("No records to export"); return; }

    // CSV header
    const headers = ["Sr No.", "Bill Date", "Bill Series", "Bill No.", "Type", "Godown", "Item Names", "Total Qty", "Total Amt (₹)"];

    // CSV rows — one row per entry
    const rows = filtered.map((v, i) => [
      i + 1,
      fmtDate(v.date),
      v.billSeries || "",
      v.billNo || "",
      v.type || "",
      v.godown || "",
      `"${(v.items || []).map((it) => it.itemName).filter(Boolean).join(", ")}"`,
      v.totalQty ?? 0,
      (Number(v.totalAmt) || 0).toFixed(2),
    ]);

    // Totals row
    rows.push(["", "", "", "", "", "", "TOTALS", totals.qty, totals.amt.toFixed(2)]);

    const csvContent =
      [headers, ...rows]
        .map((r) => r.join(","))
        .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `DamageAndShrinkage_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} record(s) exported`);
  };

  // ── print all filtered entries ──
  const handlePrintAll = () => {
    if (!filtered.length) { toast.error("No records to print"); return; }

    const tableRows = filtered
      .map(
        (v, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${fmtDate(v.date)}</td>
          <td>${v.billSeries || "-"}</td>
          <td>${v.billNo || "-"}</td>
          <td><span class="badge ${v.type === 'Damage' ? 'dmg' : 'shrk'}">${v.type || "-"}</span></td>
          <td>${v.godown || "-"}</td>
          <td class="items-cell">${(v.items || []).map((it) => it.itemName).filter(Boolean).join(", ") || "-"}</td>
          <td>${v.totalQty ?? 0}</td>
          <td>₹${fmtINR(v.totalAmt)}</td>
        </tr>`
      )
      .join("");

    const dateRange = filters.dateFrom || filters.dateTo
      ? ` | ${filters.dateFrom ? "From: " + filters.dateFrom : ""} ${filters.dateTo ? "To: " + filters.dateTo : ""}`.trim()
      : "";

    const win = window.open("", "", "height=1000,width=1100");
    win.document.write(`
      <!DOCTYPE html>
      <html><head><title>Damage &amp; Shrinkage Report</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 15mm; }
        .report-header { border-bottom: 3px solid #1e40af; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
        .report-header h1 { font-size: 20px; color: #1e40af; }
        .report-header p { font-size: 10px; color: #64748b; margin-top: 3px; }
        .report-meta { font-size: 10px; color: #475569; text-align: right; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #1e40af; color: #fff; padding: 7px 6px; text-align: center; font-size: 10px; letter-spacing: 0.03em; }
        td { padding: 6px; border: 1px solid #e2e8f0; text-align: center; font-size: 11px; }
        td.items-cell { text-align: left; max-width: 200px; }
        tr:nth-child(even) td { background: #f8fafc; }
        tr:hover td { background: #eff6ff; }
        .badge { display: inline-block; padding: 2px 7px; border-radius: 9999px; font-size: 10px; font-weight: 600; }
        .badge.dmg { background: #fee2e2; color: #b91c1c; }
        .badge.shrk { background: #fef9c3; color: #854d0e; }
        tfoot td { font-weight: 700; background: #dbeafe; color: #1e40af; border-top: 2px solid #1e40af; }
        .footer { margin-top: 30px; font-size: 9px; text-align: center; color: #94a3b8; }
        @media print { @page { size: A4 landscape; margin: 8mm; } body { padding: 0; } }
      </style></head>
      <body>
        <div class="report-header">
          <div>
            <h1>Damage &amp; Shrinkage Report</h1>
            <p>Total Records: <strong>${filtered.length}</strong>${dateRange}</p>
          </div>
          <div class="report-meta">
            <p>Printed: ${new Date().toLocaleString("en-IN")}</p>
            ${filters.billSeries ? `<p>Bill Series: <strong>${filters.billSeries}</strong></p>` : ""}
          </div>
        </div>
        <table>
          <thead><tr>
            <th>#</th><th>Bill Date</th><th>Bill Series</th><th>Bill No.</th>
            <th>Type</th><th>Godown</th><th>Items</th><th>Total Qty</th><th>Total Amt</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
          <tfoot><tr>
            <td colspan="7" style="text-align:right">GRAND TOTAL</td>
            <td>${totals.qty}</td>
            <td>₹${fmtINR(totals.amt)}</td>
          </tr></tfoot>
        </table>
        <p class="footer">Computer-generated report &mdash; Damage &amp; Shrinkage Module</p>
      </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  // ── delete ──
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this damage entry?")) return;
    setDeletingId(id);
    const res = await deleteDamageEntry(id);
    if (res.success) {
      toast.success("Entry deleted");
      setEntries((prev) => prev.filter((e) => e._id !== id));
    } else {
      toast.error(res.error || "Failed to delete");
    }
    setDeletingId(null);
  };

  // ── print single entry ──
  const handlePrint = (entry) => {
    const itemRows = (entry.items || [])
      .map(
        (it, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${it.itemName || "-"}</td>
          <td>${it.unit || "-"}</td>
          <td>${it.eye || "-"}</td>
          <td>${it.sph ?? "-"}</td>
          <td>${it.cyl ?? "-"}</td>
          <td>${it.axis ?? "-"}</td>
          <td>${it.add ?? "-"}</td>
          <td>${it.qty ?? 0}</td>
          <td>₹${fmtINR(it.price)}</td>
          <td>₹${fmtINR(it.totalAmt)}</td>
        </tr>`
      )
      .join("");

    const win = window.open("", "", "height=900,width=900");
    win.document.write(`
      <html><head><title>Damage Entry - ${entry.billSeries}-${entry.billNo}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20mm 15mm; font-size: 12px; color:#1e293b; }
        h1 { font-size: 18px; color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 8px; margin-bottom:14px; }
        .meta { display:flex; gap:30px; margin-bottom:16px; }
        .meta p { margin:2px 0; }
        table { width:100%; border-collapse:collapse; margin-top:10px; }
        th { background:#1e40af; color:#fff; padding:7px 8px; text-align:center; font-size:10px; }
        td { padding:6px 8px; border:1px solid #e2e8f0; text-align:center; font-size:11px; }
        tr:nth-child(even) td { background:#f8fafc; }
        tfoot td { font-weight:700; background:#dbeafe; }
        @media print { @page { size:A4; margin:10mm; } body{padding:0;} }
      </style></head><body>
      <h1>Damage &amp; Shrinkage Entry</h1>
      <div class="meta">
        <div>
          <p><strong>Bill Series:</strong> ${entry.billSeries}</p>
          <p><strong>Bill No:</strong> ${entry.billNo}</p>
          <p><strong>Date:</strong> ${fmtDate(entry.date)}</p>
        </div>
        <div>
          <p><strong>Type:</strong> ${entry.type}</p>
          <p><strong>Godown:</strong> ${entry.godown}</p>
          ${entry.remark ? `<p><strong>Remark:</strong> ${entry.remark}</p>` : ""}
        </div>
      </div>
      <table>
        <thead><tr>
          <th>#</th><th>Item Name</th><th>Unit</th><th>Eye</th>
          <th>SPH</th><th>CYL</th><th>Axis</th><th>Add</th>
          <th>Qty</th><th>Price</th><th>Total</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
        <tfoot><tr>
          <td colspan="8" style="text-align:right">Grand Total</td>
          <td>${entry.totalQty}</td><td></td>
          <td>₹${fmtINR(entry.totalAmt)}</td>
        </tr></tfoot>
      </table>
      <p style="margin-top:40px;font-size:9px;text-align:center;color:#94a3b8;">Computer-generated document</p>
      </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div className="p-4 bg-slate-100 min-h-screen font-sans">
      <div className="max-w-[98vw] mx-auto">

        {/* ─── Header ─── */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 mb-1">
            Damage and Shrinkage
          </h1>
          <p className="text-slate-500 text-sm">
            Manage damage and shrinkage inventory records
          </p>
        </div>

        {/* ─── Filters ─── */}
        <div className="bg-white rounded-xl shadow border border-slate-200 p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="relative">
              <input
                type="text"
                value={filters.billSeries}
                onChange={(e) => handleFilterChange("billSeries", e.target.value)}
                placeholder=" "
                className="peer w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 outline-none text-sm"
              />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">
                Bill Series
              </label>
            </div>

            <div className="relative">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                className="peer w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 outline-none text-sm"
              />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">
                From Date
              </label>
            </div>

            <div className="relative">
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                className="peer w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 outline-none text-sm"
              />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">
                To Date
              </label>
            </div>

            <div className="relative">
              <input
                type="text"
                value={filters.searchText}
                onChange={(e) => handleFilterChange("searchText", e.target.value)}
                placeholder=" "
                className="peer w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 outline-none text-sm"
              />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">
                Search
              </label>
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={fetchEntries}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
              >
                <Search className="w-3.5 h-3.5" /> Search
              </button>
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              <button
                onClick={() => navigate("/lenstransaction/adddamageentry")}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Entry
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExportExcel}
                title="Export to Excel (CSV)"
                className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 hover:shadow transition"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
              <button
                onClick={handlePrintAll}
                title="Print all filtered records"
                className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 hover:shadow transition"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ─── Table ─── */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200">
                <tr>
                  {[
                    "Sr No.",
                    "Bill Date",
                    "Bill Series",
                    "Bill No.",
                    "Type",
                    "Godown",
                    "Items",
                    "Total Qty",
                    "Total Amt",
                    "Action",
                  ].map((h) => (
                    <th
                      key={h}
                      className="py-4 px-3 text-center text-slate-700 font-bold text-sm whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-slate-400">
                      <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2" />
                      Loading entries…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-14 text-center text-slate-500">
                      <p className="text-xl mb-1">No records found</p>
                      <p className="text-sm text-slate-400">
                        Try adjusting your filters or add a new entry
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((v, i) => {
                    const itemNames = (v.items || [])
                      .map((it) => it.itemName)
                      .filter(Boolean)
                      .join(", ");
                    return (
                      <tr
                        key={v._id}
                        className="hover:bg-slate-50 transition group"
                      >
                        <td className="py-4 px-3 text-center text-slate-500">{i + 1}</td>
                        <td className="py-4 px-3 text-center text-slate-700 whitespace-nowrap">
                          {fmtDate(v.date)}
                        </td>
                        <td className="py-4 px-3 text-center">
                          <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2 py-0.5 rounded">
                            {v.billSeries}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-center font-bold text-slate-800">
                          {v.billNo}
                        </td>
                        <td className="py-4 px-3 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${v.type === "Damage"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                              }`}
                          >
                            {v.type}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-center text-slate-600">
                          {v.godown || "-"}
                        </td>
                        <td className="py-4 px-3 text-slate-600 max-w-[220px] truncate" title={itemNames}>
                          <span className="text-xs">{itemNames || "-"}</span>
                        </td>
                        <td className="py-4 px-3 text-center font-semibold text-slate-800">
                          {v.totalQty ?? 0}
                        </td>
                        <td className="py-4 px-3 text-center font-semibold text-slate-800">
                          ₹{fmtINR(v.totalAmt)}
                        </td>
                        <td className="py-4 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() =>
                                navigate(`/lenstransaction/adddamageentry/${v._id}`)
                              }
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(v._id)}
                              disabled={deletingId === v._id}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                              title="Delete"
                            >
                              {deletingId === v._id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handlePrint(v)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition"
                              title="Print"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Totals footer */}
              {!loading && filtered.length > 0 && (
                <tfoot className="bg-blue-50 border-t-2 border-blue-200">
                  <tr>
                    <td colSpan={7} className="py-3 px-3 text-right font-bold text-slate-700">
                      Totals
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-blue-800">
                      {totals.qty}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-blue-800">
                      ₹{fmtINR(totals.amt)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}