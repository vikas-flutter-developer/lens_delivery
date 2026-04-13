import React, { useState, useEffect, useMemo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  RotateCcw, 
  Percent, 
  Search, 
  Calendar, 
  Download, 
  Printer, 
  Filter, 
  ChevronDown, 
  Activity,
  BarChart3 as BarIcon,
  PieChart as PieIcon,
  User,
  ArrowRight,
  ShoppingCart,
  Receipt,
  AlertCircle
} from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import ApiClient from "../ApiClient";

const CancelledOrderRatioReport = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState({ 
        summary: { sale: {}, purchase: {} }, 
        details: [], 
        partyWise: [], 
        trend: [] 
    });
    const [filters, setFilters] = useState({
        dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
        transactionType: "Both", // Sale, Purchase, Both
        partyName: ""
    });
    const [searchTerm, setSearchTerm] = useState("");
    const [partySearchTerm, setPartySearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: 'ratio', direction: 'desc' });

    const fetchReport = async () => {
        setLoading(true);
        try {
            const response = await ApiClient.post(`/reports/cancelled-order-ratio`, filters);
            if (response.data.success) {
                setData(response.data);
            }
        } catch (error) {
            console.error("Error fetching report:", error);
            toast.error("Failed to load report data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [filters.dateFrom, filters.dateTo, filters.transactionType, filters.partyName]);

    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const filteredDetails = useMemo(() => {
        let items = data.details.filter(d => d.status?.toLowerCase() === 'cancelled');
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            items = items.filter(d => 
                d.partyName.toLowerCase().includes(term) || 
                d.label.toLowerCase().includes(term)
            );
        }
        return items;
    }, [data.details, searchTerm]);

    const sortedPartyWise = useMemo(() => {
        let items = [...data.partyWise];
        if (partySearchTerm) {
            const term = partySearchTerm.toLowerCase();
            items = items.filter(p => p.partyName.toLowerCase().includes(term));
        }
        return items.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [data.partyWise, sortConfig, partySearchTerm]);

    const handleExport = () => {
        const exportData = filteredDetails.map((d, idx) => ({
            "Sr. No.": idx + 1,
            "Date": d.date,
            "Type": d.transactionType,
            "Document": d.label,
            "Party Name": d.partyName,
            "Status": d.status,
            "Amount": d.netAmount.toLocaleString(),
            "Cancelled": d.cancelledOrders ? "Yes" : "No"
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Cancelled Orders");
        XLSX.writeFile(wb, `Cancelled_Order_Ratio_${filters.dateFrom}_to_${filters.dateTo}.xlsx`);
    };

    const handlePrint = () => {
        window.print();
    };

    const setPeriod = (type) => {
        const now = new Date();
        let from, to = now.toISOString().split('T')[0];
        if (type === 'current_month') {
            from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        } else if (type === 'last_quarter') {
            const q = Math.floor(now.getMonth() / 3);
            from = new Date(now.getFullYear(), (q - 1) * 3, 1).toISOString().split('T')[0];
            to = new Date(now.getFullYear(), q * 3, 0).toISOString().split('T')[0];
        } else if (type === 'current_year') {
            from = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        }
        setFilters(prev => ({ ...prev, dateFrom: from, dateTo: to }));
    };

    // Custom Chart Components
    const SimplePieChart = ({ summary }) => {
        const total = summary.totalOrders || 0;
        const cancelled = summary.cancelledOrders || 0;
        const active = total - cancelled;
        const cancelledAngle = total > 0 ? (cancelled / total) * 360 : 0;
        
        return (
            <div className="relative w-32 h-32 mx-auto">
                <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-emerald-500" strokeWidth="4" />
                    <circle 
                        cx="18" cy="18" r="15.5" fill="none" 
                        className="stroke-red-500" strokeWidth="4"
                        strokeDasharray={`${(cancelledAngle / 360) * 100} 100`}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">Ratio</span>
                    <span className="text-sm font-black text-slate-800">{summary.ratio}%</span>
                </div>
            </div>
        );
    };

    const ComparisonBarChart = ({ summary }) => {
        const saleRatio = summary.sale?.ratio || 0;
        const purchaseRatio = summary.purchase?.ratio || 0;
        const maxRatio = Math.max(saleRatio, purchaseRatio, 10);

        return (
            <div className="space-y-6 w-full">
                <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase">
                        <span>Sale Cancellation</span>
                        <span>{saleRatio}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                            style={{ width: `${(saleRatio / maxRatio) * 100}%` }}
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase">
                        <span>Purchase Cancellation</span>
                        <span>{purchaseRatio}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-amber-500 rounded-full transition-all duration-1000"
                            style={{ width: `${(purchaseRatio / maxRatio) * 100}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    };

    const TrendLineChart = ({ trend }) => {
        if (!trend || trend.length === 0) return <div className="h-32 flex items-center justify-center text-slate-400 italic">No trend data</div>;
        const maxRatio = Math.max(...trend.map(t => t.ratio), 5);
        
        return (
            <div className="flex items-end justify-between h-32 gap-1 pt-4">
                {trend.slice(-12).map((t, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center group relative">
                        <div 
                            className={`w-full hover:opacity-80 transition-all duration-300 pointer-events-auto cursor-help rounded-t ${t.ratio > 10 ? 'bg-red-400' : 'bg-slate-400'}`}
                            style={{ height: `${(t.ratio / maxRatio) * 100}%` }}
                        >
                            <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10 shadow-xl">
                                {t.period}: {t.ratio}%
                            </div>
                        </div>
                        <span className="text-[8px] text-slate-400 rotate-45 mt-4 origin-left whitespace-nowrap">{t.period}</span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6 min-h-screen pb-10 bg-slate-50/30">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:p-0 print:hidden">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-600 rounded-2xl shadow-lg shadow-red-200">
                        <Activity className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                            Cancelled Order Ratio Report
                        </h1>
                        <p className="text-slate-500 text-sm font-medium mt-0.5">
                            Analyze cancellation trends and ratios across transactions
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleExport}
                        className="p-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 font-bold text-sm shadow-sm"
                    >
                        <Download className="w-4 h-4" /> Export
                    </button>
                    <button 
                         onClick={handlePrint}
                        className="p-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2 font-bold text-sm shadow-md"
                    >
                        <Printer className="w-4 h-4" /> Print
                    </button>
                </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block text-center mb-10 border-b pb-6">
                <h1 className="text-3xl font-black uppercase text-slate-900">Cancelled Order Ratio Report</h1>
                <div className="mt-2 text-slate-500 font-bold flex justify-center gap-6">
                    <span>Period: {filters.dateFrom} to {filters.dateTo}</span>
                    <span>Type: {filters.transactionType}</span>
                </div>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-4 md:px-0">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <Activity className="w-14 h-14 text-indigo-600" />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Orders</span>
                    <h2 className="text-3xl font-black text-slate-800 mt-1">{data.summary.totalOrders?.toLocaleString() || 0}</h2>
                    <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 w-fit px-3 py-1 rounded-full">
                        Gross orders count
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <AlertCircle className="w-14 h-14 text-red-600" />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cancelled Orders</span>
                    <h2 className="text-3xl font-black text-red-600 mt-1">{data.summary.cancelledOrders?.toLocaleString() || 0}</h2>
                    <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-red-600 bg-red-50 w-fit px-3 py-1 rounded-full">
                        Total cancellations
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <TrendingUp className="w-14 h-14 text-emerald-600" />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Orders</span>
                    <h2 className="text-3xl font-black text-emerald-600 mt-1">{data.summary.activeOrders?.toLocaleString() || 0}</h2>
                    <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-3 py-1 rounded-full">
                        Processable orders
                    </div>
                </div>

                <div className={`p-6 rounded-2xl shadow-sm border relative overflow-hidden group transition-all ${data.summary.ratio > 20 ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                    <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-110 transition-transform">
                        <Percent className={`w-14 h-14 ${data.summary.ratio > 20 ? 'text-red-600' : 'text-blue-600'}`} />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${data.summary.ratio > 20 ? 'text-red-400' : 'text-blue-400'}`}>Cancellation Ratio</span>
                    <h2 className={`text-3xl font-black mt-1 ${data.summary.ratio > 20 ? 'text-red-700' : 'text-blue-700'}`}>{data.summary.ratio}%</h2>
                    <div className={`mt-4 flex items-center gap-1.5 text-[10px] font-bold w-fit px-3 py-1 rounded-full ${data.summary.ratio > 20 ? 'text-red-700 bg-red-100' : 'text-blue-700 bg-blue-100'}`}>
                        {data.summary.ratio > 20 ? <TrendingUp className="w-3.5 h-3.5"/> : <TrendingDown className="w-3.5 h-3.5"/>}
                        {data.summary.ratio > 20 ? 'Attention Needed' : 'Optimized Flow'}
                    </div>
                </div>
            </div>

            {/* Filter & Charts Section */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 px-4 md:px-0 print:hidden">
                {/* Primary Filters & Quick Insights */}
                <div className="xl:col-span-8 space-y-6">
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-50 pb-6 mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <Filter className="w-5 h-5 text-blue-600" />
                                </div>
                                <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em]">Filter Configuration</h3>
                            </div>
                            <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                                {[
                                    { id: 'current_month', label: 'Month' },
                                    { id: 'last_quarter', label: 'Quarter' },
                                    { id: 'current_year', label: 'Year' }
                                ].map(p => (
                                    <button 
                                        key={p.id}
                                        onClick={() => setPeriod(p.id)}
                                        className="px-6 py-2 text-[10px] font-black uppercase rounded-xl transition-all hover:bg-white hover:text-blue-600 hover:shadow-sm"
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            <div className="space-y-2.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 tracking-widest pl-1">
                                    <Calendar className="w-3.5 h-3.5" /> From
                                </label>
                                <input 
                                    type="date"
                                    value={filters.dateFrom}
                                    onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-100 transition-all outline-none border-transparent hover:border-slate-300"
                                />
                            </div>
                            <div className="space-y-2.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 tracking-widest pl-1">
                                    <Calendar className="w-3.5 h-3.5" /> To
                                </label>
                                <input 
                                    type="date"
                                    value={filters.dateTo}
                                    onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-100 transition-all outline-none border-transparent hover:border-slate-300"
                                />
                            </div>
                            <div className="space-y-2.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 tracking-widest pl-1">
                                    <Activity className="w-3.5 h-3.5" /> Type
                                </label>
                                <select 
                                    value={filters.transactionType}
                                    onChange={(e) => setFilters(prev => ({ ...prev, transactionType: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-100 transition-all outline-none border-transparent hover:border-slate-300 appearance-none"
                                >
                                    <option value="Both">Both (Sale/Purchase)</option>
                                    <option value="Sale">Sales Only</option>
                                    <option value="Purchase">Purchase Only</option>
                                </select>
                            </div>
                            <div className="space-y-2.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 tracking-widest pl-1">
                                    <Search className="w-3.5 h-3.5" /> Quick Search
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                                    <input 
                                        type="text"
                                        placeholder="Party / Document..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-5 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-100 transition-all outline-none border-transparent hover:border-slate-300"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-2 bg-red-50 rounded-lg">
                                    <TrendingDown className="w-5 h-5 text-red-600" />
                                </div>
                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">High Cancellation Parties</span>
                            </div>
                            <div className="space-y-3">
                                {data.partyWise.filter(p => p.ratio > 25).sort((a,b) => b.ratio - a.ratio).slice(0, 4).map((p, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-red-50/50 border border-red-100/50 rounded-2xl hover:bg-red-50 transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 font-bold text-xs">{i+1}</div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-red-900 group-hover:text-red-700 transition-colors uppercase">{p.partyName}</span>
                                                <span className="text-[9px] font-bold text-red-400 uppercase tracking-tighter">{p.totalOrders} total orders</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-black text-red-700">{p.ratio}%</span>
                                            <p className="text-[8px] font-bold text-red-400 uppercase">Ratio</p>
                                        </div>
                                    </div>
                                ))}
                                {data.partyWise.filter(p => p.ratio > 25).length === 0 && (
                                    <div className="text-xs text-slate-400 italic p-10 text-center border-2 border-dashed rounded-3xl border-slate-100">Optimal performance across all parties</div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-2 bg-indigo-50 rounded-lg">
                                    <BarIcon className="w-5 h-5 text-indigo-600" />
                                </div>
                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Sale vs Purchase Index</span>
                            </div>
                            <div className="flex items-center justify-center h-full min-h-[200px]">
                                <ComparisonBarChart summary={data.summary} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Secondary Insights & Trend */}
                <div className="xl:col-span-4 space-y-6">
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 flex flex-col items-center">
                        <div className="flex items-center gap-3 mb-8 self-start w-full border-b border-slate-50 pb-6">
                            <PieIcon className="w-5 h-5 text-indigo-500" />
                            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Overall Composition</h3>
                        </div>
                        <SimplePieChart summary={data.summary} />
                        <div className="mt-10 grid grid-cols-2 gap-4 w-full">
                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100/50 hover:bg-white hover:shadow-md transition-all">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Active</span>
                                </div>
                                <span className="text-lg font-black text-slate-800">{data.summary.activeOrders || 0}</span>
                            </div>
                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100/50 hover:bg-white hover:shadow-md transition-all">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-200"></div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Cancelled</span>
                                </div>
                                <span className="text-lg font-black text-slate-800">{data.summary.cancelledOrders || 0}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 overflow-hidden">
                        <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-6">
                            <TrendingUp className="w-5 h-5 text-blue-500" />
                            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Cancellation Trend</h3>
                        </div>
                        <TrendLineChart trend={data.trend} />
                    </div>
                </div>
            </div>

            {/* Detailed Table Section */}
            <div className="px-4 md:px-0">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-slate-900 rounded-2xl">
                                <Receipt className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 text-lg tracking-tight">Transactional Breakdown</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Audit log of all processed entries</p>
                            </div>
                        </div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl">
                            Live Result Count: <span className="text-blue-600 text-sm font-black">{filteredDetails.length}</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                             <thead>
                                <tr className="bg-slate-50/50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-100">
                                    <th className="px-8 py-5">Date</th>
                                    <th className="px-8 py-5">Type</th>
                                    <th className="px-8 py-5">Doc Type</th>
                                    <th className="px-8 py-5">Party Name</th>
                                    <th className="px-8 py-5">Amount</th>
                                    <th className="px-8 py-5 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="py-24 text-center">
                                            <div className="flex flex-col items-center gap-5">
                                                <div className="w-12 h-12 border-4 border-slate-200 border-t-red-600 rounded-full animate-spin"></div>
                                                <span className="text-slate-400 font-black text-[10px] tracking-[0.3em] uppercase">Aggregating Transactional data</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredDetails.map((d, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-700">{d.date}</span>
                                                <span className="text-[9px] font-bold text-slate-400">TIMESTAMP LOG</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${d.transactionType === 'Sale' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                                {d.transactionType}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-xs font-bold text-slate-500 uppercase">{d.label}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-all">
                                                    <User className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-black text-slate-800 uppercase tracking-tight group-hover:translate-x-1 transition-transform">{d.partyName}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 font-black text-slate-800 text-sm">₹{d.netAmount.toLocaleString()}</td>
                                        <td className="px-8 py-5">
                                            <div className="flex justify-center">
                                                <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ${d.status?.toLowerCase() === 'cancelled' ? 'bg-red-600 text-white' : 'bg-emerald-500 text-white'}`}>
                                                    {d.status}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredDetails.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={6} className="py-24 text-center">
                                            <div className="flex flex-col items-center gap-3 opacity-30">
                                                <AlertCircle className="w-12 h-12 text-slate-400" />
                                                <p className="text-slate-500 font-black uppercase text-xs tracking-widest italic">Inventory log is currently empty for filters</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Party Stats Table Section */}
             <div className="px-4 md:px-0">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-600 rounded-2xl">
                                <User className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 text-lg tracking-tight">Party-wise Performance</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Consolidated ratio per account</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                             {/* Party Quick Search */}
                            <div className="relative min-w-[240px]">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text"
                                    placeholder="Search party..."
                                    value={partySearchTerm}
                                    onChange={(e) => setPartySearchTerm(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-2 text-xs font-bold focus:ring-4 focus:ring-indigo-100 transition-all outline-none border-transparent hover:border-slate-300"
                                />
                            </div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Sort: <span className="text-indigo-600">{sortConfig.key} ({sortConfig.direction})</span>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-100">
                                    <th className="px-8 py-5 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('partyName')}>Party Name</th>
                                    <th className="px-8 py-5 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('totalOrders')}>Total Orders</th>
                                    <th className="px-8 py-5 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('cancelledOrders')}>Cancelled</th>
                                    <th className="px-8 py-5 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('ratio')}>Cancellation %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedPartyWise.map((p, idx) => (
                                    <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                                        <td className="px-8 py-5">
                                            <span className="text-sm font-black text-slate-700 uppercase">{p.partyName}</span>
                                        </td>
                                        <td className="px-8 py-5 text-center font-bold text-slate-600">{p.totalOrders}</td>
                                        <td className="px-8 py-5 text-center font-bold text-red-500">{p.cancelledOrders}</td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center justify-center gap-6">
                                                <div className="flex-1 max-w-[120px] h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full ${p.ratio > 20 ? 'bg-red-500' : 'bg-blue-500'}`}
                                                        style={{ width: `${Math.min(p.ratio * 2.5, 100)}%` }}
                                                    />
                                                </div>
                                                <span className={`text-sm font-black w-12 text-right ${p.ratio > 20 ? 'text-red-600' : 'text-slate-700'}`}>{p.ratio}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Print Footer */}
            <div className="hidden print:block mt-12 pt-8 border-t border-slate-200 text-center text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                <p>System Generated Analytical Report • Printed on: {new Date().toLocaleString()}</p>
                <p>© Product of Vision Management Intelligence</p>
            </div>
            
            {/* Global Styles for print */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    body { background: white !important; font-size: 10px !important; }
                    .print\\:hidden { display: none !important; }
                    .print\\:block { display: block !important; }
                    .shadow-sm, .shadow-md, .shadow-lg, .shadow-2xl, .shadow-xl { box-shadow: none !important; }
                    .border, .border-slate-100 { border: 1px solid #f1f1f1 !important; }
                    table { border-collapse: collapse !important; width: 100% !important; }
                    th, td { border: 1px solid #f1f1f1 !important; padding: 6px !important; }
                    .bg-white { background: white !important; }
                    .bg-slate-50, .bg-slate-50\\/50, .bg-slate-50\\/30 { background: #fafafa !important; }
                    .text-white { color: black !important; }
                    .bg-red-600, .bg-slate-900, .bg-indigo-600, .bg-emerald-500 { background: #f0f0f0 !important; color: black !important; border: 1px solid black !important; }
                }
            ` }} />
        </div>
    );
};

export default CancelledOrderRatioReport;
