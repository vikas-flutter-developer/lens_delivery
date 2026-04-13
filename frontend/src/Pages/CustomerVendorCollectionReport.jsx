import React, { useState, useEffect, useMemo } from "react";
import ApiClient from "../ApiClient";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Search,
  Calendar,
  Download,
  Printer,
  Clock,
  Edit3,
  History,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  X,
  Users,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

// ─── Helpers ────────────────────────────────────────────────────────────────
const INR = (v) =>
  `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const getStatusColor = (perf) => {
  if (perf >= 100) return "emerald";
  if (perf >= 70)  return "amber";
  return "rose";
};

// ─── ComparisonChart ─────────────────────────────────────────────────────────
const ComparisonChart = ({ data = [], color = "indigo" }) => {
  const top5 = [...data].sort((a, b) => b.received - a.received).slice(0, 5);
  if (!top5.length) {
    return (
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 h-full flex items-center justify-center text-slate-300 text-[10px] font-black uppercase tracking-widest">
        Waiting for performance data…
      </div>
    );
  }
  const maxVal = Math.max(...top5.map((d) => Math.max(d.targetAmount, d.received)), 1);
  return (
    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 h-full">
      <div className="flex items-center gap-2 mb-6 border-b border-slate-50 pb-4">
        <BarChart3 className={`w-4 h-4 text-${color}-500`} />
        <h3 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-widest">
          Target vs Received (Top 5)
        </h3>
      </div>
      <div className="space-y-6">
        {top5.map((d, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-tight">
              <span>{d.partyName}</span>
              <span>
                {d.received.toLocaleString()} / {d.targetAmount.toLocaleString()}
              </span>
            </div>
            <div className="relative h-4 w-full bg-slate-50 rounded-lg overflow-hidden border border-slate-100 shadow-inner">
              <div
                className="absolute inset-y-0 left-0 bg-slate-200 opacity-40 transition-all duration-1000"
                style={{ width: `${(d.targetAmount / maxVal) * 100}%` }}
              />
              <div
                className={`absolute inset-y-0 left-0 bg-${color}-500 rounded-lg shadow-sm transition-all duration-1000 flex items-center justify-end px-2`}
                style={{ width: `${Math.min((d.received / maxVal) * 100, 100)}%` }}
              >
                <div className="w-1 h-2 bg-white/40 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── CollectionSection ───────────────────────────────────────────────────────
const CollectionSection = ({ targetType, filters }) => {
  const [loading, setLoading]   = useState(false);
  const [report, setReport]     = useState({ summary: {}, data: [] });
  const [search, setSearch]     = useState("");
  const [editModal, setEditModal]     = useState(false);
  const [historyModal, setHistoryModal] = useState(false);
  const [selectedParty, setSelectedParty] = useState(null);
  const [historyData, setHistoryData]   = useState([]);
  const [targetForm, setTargetForm]     = useState({ amount: 0 });

  const isCustomer = targetType === "Customer";
  const accentColor = isCustomer ? "indigo" : "violet";
  const label        = isCustomer ? "Customer" : "Vendor";

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await ApiClient.post("/reports/collection-target/report", {
        ...filters,
        targetType,
      });
      if (res.data.success) setReport(res.data);
    } catch {
      toast.error(`Failed to load ${label} collection report`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [filters.year, filters.periodType, filters.month, filters.quarter]);

  const filtered = useMemo(() => {
    if (!search) return report.data || [];
    return (report.data || []).filter((p) =>
      p.partyName.toLowerCase().includes(search.toLowerCase())
    );
  }, [report.data, search]);

  const handleSaveTarget = async () => {
    if (targetForm.amount < 0) return toast.error("Amount cannot be negative");

    let start, end;
    if (filters.periodType === "Monthly") {
      start = new Date(filters.year, filters.month - 1, 1).toISOString();
      end   = new Date(filters.year, filters.month, 0).toISOString();
    } else if (filters.periodType === "Quarterly") {
      start = new Date(filters.year, (filters.quarter - 1) * 3, 1).toISOString();
      end   = new Date(filters.year, filters.quarter * 3, 0).toISOString();
    } else {
      start = new Date(filters.year, 0, 1).toISOString();
      end   = new Date(filters.year, 11, 31).toISOString();
    }

    try {
      const payload = {
        partyId: selectedParty.partyName,
        partyName: selectedParty.partyName,
        targetAmount: targetForm.amount,
        targetType,
        periodType: filters.periodType,
        year: filters.year,
        month: filters.periodType === "Monthly" ? filters.month : undefined,
        quarter: filters.periodType === "Quarterly" ? filters.quarter : undefined,
        startDate: start,
        endDate: end,
      };
      const res = await ApiClient.post("/reports/collection-target/save", payload);
      if (res.data.success) {
        toast.success(`Target updated for ${selectedParty.partyName}`);
        setEditModal(false);
        fetchReport();
      }
    } catch {
      toast.error("Failed to save target");
    }
  };

  const fetchHistory = async (partyName) => {
    try {
      const res = await ApiClient.get(
        `/reports/collection-target/history/${encodeURIComponent(partyName)}/${targetType}`
      );
      if (res.data.success) {
        setHistoryData(res.data.data);
        setHistoryModal(true);
      }
    } catch {
      toast.error("Failed to load history");
    }
  };

  const handleExport = () => {
    const rows = filtered.map((p, i) => ({
      "Sr.No.": i + 1,
      "Party Name": p.partyName,
      "Target ₹": p.targetAmount,
      "Received ₹": p.received,
      "Balance ₹": p.balance,
      "Excess ₹": p.excess,
      "Performance %": p.performance + "%",
      Status: p.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${label} Collection`);
    XLSX.writeFile(wb, `${label}_Collection_${filters.periodType}_${filters.year}.xlsx`);
  };

  const { summary = {} } = report;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "Total Target",
            val: INR(summary.totalTarget),
            icon: isCustomer ? Users : ShoppingBag,
            color: accentColor,
            raw: summary.totalTarget,
          },
          {
            label: "Total Received",
            val: INR(summary.totalReceived),
            icon: TrendingUp,
            color: "emerald",
            raw: summary.totalReceived,
          },
          {
            label: "Achievement %",
            val: `${summary.achievement || 0}%`,
            icon: BarChart3,
            color: (summary.achievement || 0) >= 90 ? "emerald" : "amber",
            raw: summary.achievement,
          },
          {
            label: "Balance / Excess",
            val: summary.totalExcess > 0
              ? `+${INR(summary.totalExcess)}`
              : `-${INR(summary.totalBalance)}`,
            icon: summary.totalExcess > 0 ? ArrowUpRight : ArrowDownRight,
            color: summary.totalExcess > 0 ? "emerald" : "rose",
            raw: null,
          },
        ].map((card, i) => (
          <div
            key={i}
            className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-all transform group-hover:scale-125 -rotate-12">
              <card.icon className={`w-16 h-16 text-${card.color}-600`} />
            </div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              {card.label}
            </span>
            <div className="mt-2">
              <span className="text-2xl font-black text-slate-800 tracking-tight">
                {card.val}
              </span>
            </div>
            <div className="mt-4 h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
              <div
                className={`h-full bg-${card.color}-500 transition-all duration-1000`}
                style={{ width: card.raw !== null ? `${Math.min(card.raw, 100)}%` : "100%" }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Chart + Insight */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <ComparisonChart data={report.data} color={accentColor} />
        </div>
        <div
          className={`lg:col-span-4 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center relative overflow-hidden group`}
        >
          <div className={`absolute top-0 left-0 w-full h-1 bg-${accentColor}-600`} />
          <div className={`p-4 bg-${accentColor}-50 rounded-3xl mb-4 group-hover:scale-110 transition-transform`}>
            <Wallet className={`w-8 h-8 text-${accentColor}-600`} />
          </div>
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-tight">
            {label} Insights
          </h4>
          <p className="text-[10px] font-bold text-slate-400 mt-2 px-4 uppercase leading-relaxed">
            {(summary.achievement || 0) >= 90
              ? `Excellent! ${label} collection is on track. Keep up the momentum.`
              : (summary.achievement || 0) >= 50
              ? `Balanced performance. Focus on parties below 70% to improve overall collection.`
              : `Opportunity for growth. Review targets and increase collection touchpoints.`}
          </p>
          <div className={`mt-8 flex items-center gap-2 text-xs font-black text-${accentColor}-600 group-hover:gap-4 transition-all cursor-pointer`}>
            VIEW STRATEGY <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Search + Export */}
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          <input
            type="text"
            placeholder={`Search ${label.toLowerCase()}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-4 py-2.5 text-xs font-black placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
            title="Export Excel"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.print()}
            className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
            title="Print"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 uppercase text-[10px] font-black tracking-widest border-b border-slate-100">
                <th className="px-8 py-5">SR</th>
                <th className="px-6 py-5">Party Details</th>
                <th className="px-6 py-5 text-right">Target</th>
                <th className="px-6 py-5 text-right">Received</th>
                <th className="px-6 py-5 text-right">Balance</th>
                <th className="px-6 py-5 text-right">Excess</th>
                <th className="px-10 py-5">Performance %</th>
                <th className="px-6 py-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-32 text-center text-slate-300 font-black uppercase text-xs animate-pulse tracking-widest">
                    Loading collection data…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-24 text-center text-slate-300 font-black uppercase text-xs tracking-widest">
                    No {label.toLowerCase()} parties found
                  </td>
                </tr>
              ) : (
                filtered.map((p, idx) => {
                  const colorClass = getStatusColor(p.performance);
                  const isOver = p.received >= p.targetAmount && p.targetAmount > 0;
                  const isNoTarget = p.targetAmount === 0;
                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-50/30 transition-colors group ${isOver ? "bg-emerald-50/20" : ""}`}
                    >
                      <td className="px-8 py-6 text-xs font-black text-slate-300">{idx + 1}</td>

                      <td className="px-6 py-6">
                        <div className="flex flex-col">
                          <span className={`text-sm font-black text-slate-800 uppercase tracking-tight group-hover:text-${accentColor}-600 transition-colors`}>
                            {p.partyName}
                          </span>
                          <span
                            className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded mt-1.5 w-fit ${
                              isNoTarget
                                ? "bg-slate-100 text-slate-400"
                                : `bg-${colorClass}-50 text-${colorClass}-600`
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-6 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-black text-slate-700">{INR(p.targetAmount)}</span>
                          <span className="text-[9px] font-bold text-slate-300">Target</span>
                        </div>
                      </td>

                      <td className="px-6 py-6 text-right">
                        <div className="flex flex-col items-end">
                          <span className={`text-sm font-black ${p.received > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                            {INR(p.received)}
                          </span>
                          <span className="text-[9px] font-bold text-slate-300">Collected</span>
                        </div>
                      </td>

                      <td className="px-6 py-6 text-right">
                        <span className={`text-sm font-black ${p.balance > 0 ? "text-rose-500" : "text-slate-300"}`}>
                          {p.balance > 0 ? INR(p.balance) : "—"}
                        </span>
                      </td>

                      <td className="px-6 py-6 text-right">
                        <span className={`text-sm font-black ${p.excess > 0 ? "text-emerald-500" : "text-slate-300"}`}>
                          {p.excess > 0 ? `+${INR(p.excess)}` : "—"}
                        </span>
                      </td>

                      <td className="px-10 py-6">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 h-3 bg-slate-50 rounded-full border border-slate-100 p-0.5 overflow-hidden shadow-inner">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r from-${colorClass}-400 to-${colorClass}-600 shadow-sm transition-all duration-1000`}
                              style={{ width: `${Math.min(p.performance, 100)}%` }}
                            />
                          </div>
                          <span
                            className={`text-sm font-black w-14 ${
                              p.performance >= 100 ? "text-emerald-600" : p.performance >= 70 ? "text-amber-600" : "text-rose-600"
                            }`}
                          >
                            {isNoTarget ? "0%" : `${p.performance}%`}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-6">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedParty(p);
                              setTargetForm({ amount: p.targetAmount });
                              setEditModal(true);
                            }}
                            className={`p-2 text-${accentColor}-400 hover:text-${accentColor}-600 hover:bg-${accentColor}-50 rounded-xl transition-all`}
                            title="Edit Target"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedParty(p);
                              fetchHistory(p.partyName);
                            }}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                            title="View History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Target Modal */}
      {editModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditModal(false)} />
          <div className="bg-white rounded-3xl w-full max-w-md relative z-10 shadow-2xl overflow-hidden">
            <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 bg-${accentColor}-600 rounded-xl`}>
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">
                  Set Collection Target
                </h3>
              </div>
              <button onClick={() => setEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className={`p-4 bg-${accentColor}-50/50 rounded-2xl border border-${accentColor}-100`}>
                <span className={`text-[10px] font-black text-${accentColor}-400 uppercase tracking-widest block mb-1`}>
                  {label}
                </span>
                <h4 className={`text-lg font-black text-${accentColor}-900 uppercase tracking-tight`}>
                  {selectedParty?.partyName}
                </h4>
                <div className={`mt-2 flex items-center gap-2 text-[11px] font-bold text-${accentColor}-500 bg-white w-fit px-2 py-1 rounded-lg border border-${accentColor}-100`}>
                  <Calendar className="w-3 h-3" /> {filters.periodType} • {filters.year}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Target Amount (₹)
                </label>
                <input
                  autoFocus
                  type="number"
                  value={targetForm.amount}
                  onChange={(e) => setTargetForm({ amount: Number(e.target.value) })}
                  className={`w-full bg-slate-50 border-2 border-slate-100 h-16 rounded-2xl px-6 text-3xl font-black text-slate-800 focus:border-${accentColor}-600 transition-all outline-none`}
                />
              </div>

              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100/50">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] font-bold text-amber-700 leading-relaxed uppercase">
                  This target applies only for the selected {filters.periodType.toLowerCase()} period.
                </p>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setEditModal(false)} className="flex-1 py-4 text-slate-500 font-black text-sm uppercase hover:text-slate-800 transition-all">
                Cancel
              </button>
              <button
                onClick={handleSaveTarget}
                className={`flex-1 bg-${accentColor}-600 text-black rounded-2xl font-black text-sm uppercase shadow-lg shadow-${accentColor}-100 hover:bg-${accentColor}-700 transition-all flex items-center justify-center gap-2`}
              >
                <CheckCircle2 className="w-4 h-4" /> Save Target
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setHistoryModal(false)} />
          <div className="bg-white rounded-3xl w-full max-w-2xl relative z-10 shadow-2xl overflow-hidden">
            <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">Collection History</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {selectedParty?.partyName}
                  </p>
                </div>
              </div>
              <button onClick={() => setHistoryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X />
              </button>
            </div>
            <div className="p-0 h-[400px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Period</th>
                    <th className="px-6 py-4 text-right">Target</th>
                    <th className="px-6 py-4 text-right">Received</th>
                    <th className="px-6 py-4">Performance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {historyData.map((h, i) => {
                    const cc = getStatusColor(h.performance);
                    return (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] font-black text-indigo-600 border border-slate-100">
                              {h.month ? "M" : h.quarter ? "Q" : "Y"}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-700">
                                {h.year} {h.month ? `Month ${h.month}` : h.quarter ? `Q${h.quarter}` : "Full Year"}
                              </span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                {h.periodType}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <span className="text-sm font-black text-slate-800">{INR(h.targetAmount)}</span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <span className="text-sm font-black text-emerald-600">{INR(h.received)}</span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-4">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-${cc}-50 text-${cc}-600`}>
                                {h.status}
                              </span>
                              <span className={`text-xs font-black text-${cc}-600`}>{h.performance}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                              <div
                                className={`h-full bg-${cc}-500 transition-all duration-1000`}
                                style={{ width: `${Math.min(h.performance, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {historyData.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-20 text-center text-slate-300 italic font-medium">
                        No previous targets recorded
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-6 bg-slate-50 text-center">
              <button
                onClick={() => setHistoryModal(false)}
                className="px-8 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase text-slate-600 hover:text-indigo-600 transition-all shadow-sm"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────
const CustomerVendorCollectionReport = () => {
  const [activeTab, setActiveTab] = useState("Customer");
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    periodType: "Monthly",
    month: new Date().getMonth() + 1,
    quarter: Math.ceil((new Date().getMonth() + 1) / 3),
  });

  return (
    <div className="flex flex-col gap-6 min-h-screen pb-10 bg-slate-50/30">
      {/* Sticky Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl shadow-lg shadow-indigo-100 ring-4 ring-indigo-50">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">
              Customer / Vendor Collection Report
            </h1>
            <p className="text-slate-400 text-xs font-bold mt-1.5 uppercase tracking-widest">
              Collection Target Tracking &amp; Performance
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 space-y-6">
        {/* Period Filter Bar */}
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-wrap items-center gap-6 print:hidden">
          <div className="flex items-center gap-3 border-r border-slate-100 pr-6">
            <div className="p-2 bg-slate-50 rounded-xl text-indigo-600">
              <Clock className="w-4 h-4" />
            </div>
            <div className="flex bg-slate-50 p-1 rounded-xl">
              {["Monthly", "Quarterly", "Yearly"].map((tp) => (
                <button
                  key={tp}
                  onClick={() => setFilters((f) => ({ ...f, periodType: tp }))}
                  className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${
                    filters.periodType === tp
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {tp}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 flex-1">
            <select
              value={filters.year}
              onChange={(e) => setFilters((f) => ({ ...f, year: Number(e.target.value) }))}
              className="bg-slate-50 border-none rounded-xl px-4 py-2.5 text-xs font-black text-slate-700 focus:ring-2 focus:ring-indigo-100 outline-none"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {filters.periodType === "Monthly" && (
              <select
                value={filters.month}
                onChange={(e) => setFilters((f) => ({ ...f, month: Number(e.target.value) }))}
                className="bg-slate-50 border-none rounded-xl px-4 py-2.5 text-xs font-black text-slate-700 focus:ring-2 focus:ring-indigo-100 outline-none"
              >
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            )}

            {filters.periodType === "Quarterly" && (
              <select
                value={filters.quarter}
                onChange={(e) => setFilters((f) => ({ ...f, quarter: Number(e.target.value) }))}
                className="bg-slate-50 border-none rounded-xl px-4 py-2.5 text-xs font-black text-slate-700 focus:ring-2 focus:ring-indigo-100 outline-none"
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>Quarter {q}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-2">
          {[
            { key: "Customer", icon: Users, label: "Customer Collection", color: "indigo" },
            { key: "Vendor",   icon: ShoppingBag, label: "Vendor Collection", color: "violet" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-wider transition-all ${
                activeTab === tab.key
                  ? `bg-${tab.color}-600 text-black shadow-lg shadow-${tab.color}-100`
                  : "bg-white text-slate-400 border border-slate-200 hover:text-slate-700 shadow-sm"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Render active section */}
        <CollectionSection key={activeTab} targetType={activeTab} filters={filters} />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .print\\:hidden { display: none !important; }
          body { background-color: #fff !important; }
          .shadow-sm, .shadow-lg { box-shadow: none !important; }
          table { border: 1px solid #eee !important; }
          thead { background-color: #f8fafc !important; }
        }
      ` }} />
    </div>
  );
};

export default CustomerVendorCollectionReport;
