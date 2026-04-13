import React, { useState, useEffect, useMemo } from "react";
import ApiClient from "../ApiClient";
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Search, 
  Calendar, 
  Download, 
  Printer, 
  Filter, 
  ChevronDown, 
  History,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Clock,
  BarChart3,
  Plus,
  ArrowRight,
  X
} from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";


const SaleTargetReport = () => {
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState({ summary: {}, data: [] });
    const [filters, setFilters] = useState({
        year: new Date().getFullYear(),
        periodType: "Monthly", // Monthly, Quarterly, Yearly
        month: new Date().getMonth() + 1,
        quarter: Math.floor(new Date().getMonth() / 3) + 1
    });
    const [searchTerm, setSearchTerm] = useState("");
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedParty, setSelectedParty] = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [targetForm, setTargetForm] = useState({ amount: 0 });

    const fetchReport = async () => {
        setLoading(true);
        try {
            const response = await ApiClient.post(`/reports/sale-target/report`, filters);
            if (response.data.success) {
                setReportData(response.data);
            }
        } catch (error) {
            console.error("Error fetching target report:", error);
            toast.error("Failed to load report data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [filters.year, filters.periodType, filters.month, filters.quarter]);

    const handleSaveTarget = async () => {
        if (targetForm.amount < 0) return toast.error("Target amount cannot be negative");
        
        // Define dates based on period
        let start, end;
        if (filters.periodType === 'Monthly') {
            start = new Date(filters.year, filters.month - 1, 1).toISOString();
            end = new Date(filters.year, filters.month, 0).toISOString();
        } else if (filters.periodType === 'Quarterly') {
            start = new Date(filters.year, (filters.quarter - 1) * 3, 1).toISOString();
            end = new Date(filters.year, filters.quarter * 3, 0).toISOString();
        } else {
            start = new Date(filters.year, 0, 1).toISOString();
            end = new Date(filters.year, 11, 31).toISOString();
        }

        try {
            const payload = {
                partyId: selectedParty.partyName,
                partyName: selectedParty.partyName,
                targetAmount: targetForm.amount,
                periodType: filters.periodType,
                year: filters.year,
                month: filters.periodType === 'Monthly' ? filters.month : undefined,
                quarter: filters.periodType === 'Quarterly' ? filters.quarter : undefined,
                startDate: start,
                endDate: end
            };

            const response = await ApiClient.post(`/reports/sale-target/save`, payload);

            if (response.data.success) {
                toast.success(`Target updated for ${selectedParty.partyName}`);
                setIsEditModalOpen(false);
                fetchReport();
            }
        } catch (error) {
            console.error("Error saving target:", error);
            toast.error("Failed to save target");
        }
    };

    const fetchHistory = async (partyName) => {
        try {
            const response = await ApiClient.get(`/reports/sale-target/history/${partyName}`);
            if (response.data.success) {
                setHistoryData(response.data.data);
                setIsHistoryModalOpen(true);
            }
        } catch (error) {
            toast.error("Failed to load history");
        }
    };

    const filteredTableData = useMemo(() => {
        if (!searchTerm || !reportData?.data) return reportData?.data || [];
        return reportData.data.filter(p => p?.partyName && p.partyName.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [reportData?.data, searchTerm]);

    const handleExport = () => {
        const exportData = filteredTableData.map((p, idx) => ({
            "Sr. No.": idx + 1,
            "Party Name": p.partyName,
            "Period": `${p.periodType} (${p.year}${p.month ? '-' + p.month : ''}${p.quarter ? '-Q' + p.quarter : ''})`,
            "Target Amount": p.targetAmount,
            "Achieved Amount": p.achieved,
            "Difference": p.difference,
            "Achievement %": p.ratio + "%",
            "Status": p.status
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sale Targets");
        XLSX.writeFile(wb, `Sale_Target_Report_${filters.periodType}_${filters.year}.xlsx`);
    };

    // UI Helpers
    const getStatusColor = (ratio) => {
        if (ratio >= 100) return "emerald";
        if (ratio >= 70) return "amber";
        return "rose";
    };

    // Add a simple chart for Target vs Achieved
    const ComparisonChart = ({ data = [] }) => {
        const top5 = [...(data || [])].sort((a,b) => b.achieved - a.achieved).slice(0, 5);
        if (top5.length === 0) return (
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 h-full flex items-center justify-center text-slate-300 text-[10px] font-black uppercase tracking-widest">
                Waiting for Performance Data...
            </div>
        );
        const maxVal = Math.max(...top5.map(d => Math.max(d.targetAmount, d.achieved)), 1);

        return (
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 h-full">
                <div className="flex items-center gap-2 mb-6 border-b border-slate-50 pb-4">
                    <BarChart3 className="w-4 h-4 text-indigo-500" />
                    <h3 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-widest">Target vs Achieved (Top 5)</h3>
                </div>
                <div className="space-y-6">
                    {top5.map((d, i) => (
                        <div key={i} className="space-y-2">
                            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-tight">
                                <span>{d.partyName}</span>
                                <span>{d.achieved.toLocaleString()} / {d.targetAmount.toLocaleString()}</span>
                            </div>
                            <div className="relative h-4 w-full bg-slate-50 rounded-lg overflow-hidden border border-slate-100 shadow-inner">
                                {/* Target bar (faded background) */}
                                <div 
                                    className="absolute inset-y-0 left-0 bg-slate-200 opacity-50 transition-all duration-1000"
                                    style={{ width: `${(d.targetAmount / maxVal) * 100}%` }}
                                />
                                {/* Achieved bar (foreground) */}
                                <div 
                                    className={`absolute inset-y-0 left-0 bg-indigo-500 rounded-lg shadow-sm transition-all duration-1000 flex items-center justify-end px-2`}
                                    style={{ width: `${(d.achieved / maxVal) * 100}%` }}
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

    return (
        <div className="flex flex-col gap-6 min-h-screen pb-10 bg-slate-50/30">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm print:hidden">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100 ring-4 ring-indigo-50">
                        <Target className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Sale Target Report</h1>
                        <p className="text-slate-400 text-xs font-bold mt-1.5 uppercase tracking-widest flex items-center gap-1">
                            Performance Tracking & Planning
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleExport} className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all shadow-sm group">
                        <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    </button>
                    <button onClick={() => window.print()} className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all shadow-sm group">
                        <Printer className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            </div>

            <div className="px-6 space-y-6">
                {/* Summary Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: "Total Target", val: reportData.summary.totalTarget, icon: Target, color: "indigo" },
                        { label: "Total Achieved", val: reportData.summary.totalAchieved, icon: TrendingUp, color: "emerald" },
                        { label: "Achievement %", val: reportData.summary.ratio, icon: BarChart3, color: reportData.summary.ratio >= 90 ? "emerald" : "amber", suffix: "%" },
                        { label: "Total Shortfall", val: reportData.summary.shortfall, icon: TrendingDown, color: "rose" }
                    ].map((card, i) => (
                        <div key={i} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden group">
                           <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-all transform group-hover:scale-125 -rotate-12`}>
                                <card.icon className={`w-16 h-16 text-${card.color}-600`} />
                           </div>
                           <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{card.label}</span>
                           <div className="mt-2 flex items-baseline gap-1">
                                <span className="text-2xl font-black text-slate-800 tracking-tight">
                                    {card.suffix !== "%" ? "₹" : ""}{card.val?.toLocaleString()}{card.suffix}
                                </span>
                           </div>
                           <div className="mt-4 h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                                <div className={`h-full bg-${card.color}-500 transition-all duration-1000`} style={{ width: card.suffix === "%" ? `${card.val}%` : "100%" }} />
                           </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8">
                        <ComparisonChart data={reportData.data} />
                    </div>
                    <div className="lg:col-span-4 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600" />
                         <div className="p-4 bg-indigo-50 rounded-3xl mb-4 group-hover:scale-110 transition-transform">
                            <Target className="w-8 h-8 text-indigo-600" />
                        </div>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-tight">Targets Insights</h4>
                        <p className="text-[10px] font-bold text-slate-400 mt-2 px-6 uppercase leading-relaxed">
                            {reportData.summary.ratio >= 90 ? "Excellent business momentum! You're nearly achieving all targets." : 
                             reportData.summary.ratio >= 50 ? "Balanced performance. Focus on parties below 70% to improve overall numbers." :
                             "Opportunity for growth. Consider revising targets or increasing touchpoints for major parties."}
                        </p>
                        <div className="mt-8 flex items-center gap-2 text-xs font-black text-indigo-600 group-hover:gap-4 transition-all cursor-pointer">
                            VIEW STRATEGY <ArrowRight className="w-4 h-4" />
                        </div>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-wrap items-center gap-6 print:hidden">
                    <div className="flex items-center gap-3 border-r border-slate-100 pr-6">
                        <div className="p-2 bg-slate-50 rounded-xl text-indigo-600">
                            <Clock className="w-4 h-4" />
                        </div>
                        <div className="flex bg-slate-50 p-1 rounded-xl">
                            {['Monthly', 'Quarterly', 'Yearly'].map(tp => (
                                <button 
                                    key={tp}
                                    onClick={() => setFilters(prev => ({ ...prev, periodType: tp }))}
                                    className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${filters.periodType === tp ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {tp}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 flex-1">
                        <select 
                            value={filters.year}
                            onChange={(e) => setFilters(prev => ({ ...prev, year: Number(e.target.value) }))}
                            className="bg-slate-50 border-none rounded-xl px-4 py-2.5 text-xs font-black text-slate-700 focus:ring-2 focus:ring-indigo-100 outline-none"
                        >
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
                        </select>

                        {filters.periodType === 'Monthly' && (
                            <select 
                                value={filters.month}
                                onChange={(e) => setFilters(prev => ({ ...prev, month: Number(e.target.value) }))}
                                className="bg-slate-50 border-none rounded-xl px-4 py-2.5 text-xs font-black text-slate-700 focus:ring-2 focus:ring-indigo-100 outline-none"
                            >
                                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                            </select>
                        )}

                        {filters.periodType === 'Quarterly' && (
                            <select 
                                value={filters.quarter}
                                onChange={(e) => setFilters(prev => ({ ...prev, quarter: Number(e.target.value) }))}
                                className="bg-slate-50 border-none rounded-xl px-4 py-2.5 text-xs font-black text-slate-700 focus:ring-2 focus:ring-indigo-100 outline-none"
                            >
                                {[1,2,3,4].map(q => <option key={q} value={q}>Quarter {q}</option>)}
                            </select>
                        )}

                        <div className="relative flex-1 max-w-sm ml-auto">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                            <input 
                                type="text"
                                placeholder="Search party performance..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 border-none rounded-2xl pl-11 pr-4 py-2.5 text-xs font-black placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-100 outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Main Table */}
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 text-slate-400 uppercase text-[10px] font-black tracking-widest border-b border-slate-100">
                                    <th className="px-8 py-5">Sr. No.</th>
                                    <th className="px-6 py-5">Party Details</th>
                                    <th className="px-6 py-5 text-right">Target</th>
                                    <th className="px-6 py-5 text-right">Achieved</th>
                                    <th className="px-6 py-5 text-right">Diff / Gap</th>
                                    <th className="px-10 py-5">Performance Progress</th>
                                    <th className="px-6 py-5 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="py-32 text-center text-slate-300 font-black uppercase text-xs animate-pulse tracking-widest">
                                            Synchronizing Targets & Transactions...
                                        </td>
                                    </tr>
                                ) : filteredTableData.map((p, idx) => {
                                    const colorClass = getStatusColor(p.ratio);
                                    return (
                                        <tr key={idx} className="hover:bg-slate-50/30 transition-colors group">
                                            <td className="px-8 py-6 text-xs font-black text-slate-300">{idx + 1}</td>
                                            <td className="px-6 py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-800 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{p.partyName}</span>
                                                    <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded mt-1.5 w-fit ${p.targetAmount === 0 ? 'bg-slate-100 text-slate-400' : `bg-${colorClass}-50 text-${colorClass}-600`}`}>
                                                        {p.status}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-sm font-black text-slate-700">₹{p.targetAmount.toLocaleString()}</span>
                                                    <span className="text-[9px] font-bold text-slate-300">Target</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={`text-sm font-black text-slate-700`}>₹{p.achieved.toLocaleString()}</span>
                                                    <span className="text-[9px] font-bold text-slate-300">Sales</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={`text-xs font-black ${p.difference > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                        {p.difference > 0 ? '-' : '+'}₹{Math.abs(p.difference).toLocaleString()}
                                                    </span>
                                                    <span className="text-[8px] font-bold text-slate-300 italic uppercase">to target</span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex-1 h-3 bg-slate-50 rounded-full border border-slate-100 p-0.5 overflow-hidden shadow-inner">
                                                        <div 
                                                            className={`h-full rounded-full bg-gradient-to-r from-${colorClass}-400 to-${colorClass}-600 shadow-sm transition-all duration-1000 flex items-center justify-end px-1`}
                                                            style={{ width: `${Math.min(p.ratio, 100)}%` }}
                                                        >
                                                            {p.ratio > 30 && <div className="w-1 h-1 bg-white ring-2 ring-white/20 rounded-full" />}
                                                        </div>
                                                    </div>
                                                    <span className={`text-sm font-black w-14 ${p.ratio >= 100 ? 'text-emerald-600' : p.ratio >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>
                                                        {p.ratio}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button 
                                                        onClick={() => {
                                                            setSelectedParty(p);
                                                            setTargetForm({ amount: p.targetAmount });
                                                            setIsEditModalOpen(true);
                                                        }}
                                                        className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                        title="Edit Target"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => fetchHistory(p.partyName)}
                                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-all"
                                                        title="View History"
                                                    >
                                                        <History className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal - Set Target */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
                    <div className="bg-white rounded-3xl w-full max-w-md relative z-10 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-600 rounded-xl">
                                    <Target className="w-5 h-5 text-white" />
                                </div>
                                <h3 className="text-xl font-black text-slate-800 tracking-tight">Set Sales Target</h3>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Target Individual</span>
                                <h4 className="text-lg font-black text-indigo-900 uppercase tracking-tight">{selectedParty.partyName}</h4>
                                <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-indigo-500 bg-white w-fit px-2 py-1 rounded-lg border border-indigo-100">
                                    <Calendar className="w-3 h-3" /> {filters.periodType} • {filters.year}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    Target Amount (₹)
                                </label>
                                <input 
                                    autoFocus
                                    type="number"
                                    value={targetForm.amount}
                                    onChange={(e) => setTargetForm({ amount: Number(e.target.value) })}
                                    className="w-full bg-slate-50 border-2 border-slate-100 h-16 rounded-2xl px-6 text-3xl font-black text-slate-800 focus:border-indigo-600 transition-all outline-none"
                                />
                            </div>

                            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100/50">
                                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-[11px] font-bold text-amber-700 leading-relaxed uppercase">
                                    This target will apply only to the selected {filters.periodType.toLowerCase()} period. Historical targets will remain unaffected.
                                </p>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-4 text-slate-500 font-black text-sm uppercase hover:text-slate-800 transition-all">Cancel</button>
                            <button onClick={handleSaveTarget} className="flex-1 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-4 h-4" /> Save Target
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal - View History */}
            {isHistoryModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsHistoryModalOpen(false)} />
                    <div className="bg-white rounded-3xl w-full max-w-2xl relative z-10 shadow-2xl overflow-hidden">
                        <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                                    <History className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Performance History</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedParty?.partyName}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X /></button>
                        </div>
                        <div className="p-0 h-[400px] overflow-y-auto">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-white border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Period</th>
                                        <th className="px-6 py-4 text-right">Target</th>
                                        <th className="px-6 py-4">Performance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {historyData.map((h, i) => {
                                        const colorClass = getStatusColor(h.ratio);
                                        return (
                                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] font-black text-indigo-600 border border-slate-100">
                                                            {h.month ? 'M' : h.quarter ? 'Q' : 'Y'}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black text-slate-700">{h.year} {h.month ? `Month ${h.month}` : h.quarter ? `Q${h.quarter}` : 'Full Year'}</span>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{h.periodType}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-sm font-black text-slate-800">₹{h.targetAmount.toLocaleString()}</span>
                                                        <span className="text-[9px] font-medium text-slate-400">Achieved: ₹{h.achieved.toLocaleString()}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex items-center justify-between gap-4">
                                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-${colorClass}-50 text-${colorClass}-600`}>
                                                                {h.status}
                                                            </span>
                                                            <span className={`text-xs font-black text-${colorClass}-600`}>{h.ratio}%</span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100 shadow-inner">
                                                            <div 
                                                                className={`h-full bg-${colorClass}-500 transition-all duration-1000`}
                                                                style={{ width: `${Math.min(h.ratio, 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {historyData.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="py-20 text-center text-slate-300 italic font-medium">No previous targets recorded</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-6 bg-slate-50 text-center">
                            <button onClick={() => setIsHistoryModalOpen(false)} className="px-8 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase text-slate-600 hover:text-indigo-600 transition-all shadow-sm">Close Record</button>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    .print\\:hidden { display: none !important; }
                    .bg-indigo-600 { background-color: #4f46e5 !important; -webkit-print-color-adjust: exact; }
                    .text-white { color: #fff !important; }
                    body { background-color: #fff !important; }
                    .p-6 { padding: 0 !important; }
                    .shadow-sm, .shadow-lg { box-shadow: none !important; }
                    table { border: 1px solid #eee !important; border-radius: 0 !important; }
                    thead { background-color: #f8fafc !important; }
                    footer { display: none !important; }
                }
            ` }} />
        </div>
    );
};

export default SaleTargetReport;
