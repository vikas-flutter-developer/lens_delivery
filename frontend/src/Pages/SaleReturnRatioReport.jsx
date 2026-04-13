import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  RotateCcw, 
  Percent, 
  Search, 
  Calendar, 
  Download, 
  Printer, 
  Filter, 
  ChevronDown, 
  ChevronUp,
  ArrowRight,
  User,
  ExternalLink,
  PieChart as PieIcon,
  BarChart3 as BarIcon,
  Activity
} from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import ApiClient from "../ApiClient";

const SaleReturnRatioReport = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState({ summary: {}, partyWise: [], trend: [] });
    const [filters, setFilters] = useState({
        dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
        customerName: "",
        periodType: "Monthly" // Monthly, Quarterly, Yearly
    });
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: 'ratio', direction: 'desc' });

    const fetchReport = async () => {
        setLoading(true);
        try {
            const response = await ApiClient.post(`/reports/sale-return-ratio`, filters);
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
    }, [filters.dateFrom, filters.dateTo, filters.customerName]);

    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const sortedData = useMemo(() => {
        let items = [...data.partyWise];
        if (searchTerm) {
            items = items.filter(p => p.partyName.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        return items.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [data.partyWise, searchTerm, sortConfig]);

    const handleExport = () => {
        const exportData = sortedData.map((p, idx) => ({
            "Sr. No.": idx + 1,
            "Party Name": p.partyName,
            "Total Sale": p.totalSale.toLocaleString(),
            "Total Return": p.totalReturn.toLocaleString(),
            "Net Sale": p.netSale.toLocaleString(),
            "Return %": p.ratio + "%"
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sale Return Ratio");
        XLSX.writeFile(wb, `Sale_Return_Ratio_Report_${filters.dateFrom}_to_${filters.dateTo}.xlsx`);
    };

    const handlePrint = () => {
        window.print();
    };

    // Preset Filters
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
    const SimpleBarChart = ({ data }) => {
        const maxVal = Math.max(...data.map(d => d.ratio), 10);
        return (
            <div className="space-y-3 mt-4">
                {data.slice(0, 5).map((d, i) => (
                    <div key={i} className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                            <span>{d.partyName}</span>
                            <span>{d.ratio}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-1000 ${d.ratio > 15 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                style={{ width: `${(d.ratio / maxVal) * 100}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const SimplePieChart = ({ summary }) => {
        const { netSale, totalReturn } = summary;
        const total = (netSale || 0) + (totalReturn || 0);
        const returnAngle = total > 0 ? (totalReturn / total) * 360 : 0;
        
        return (
            <div className="relative w-32 h-32 mx-auto">
                <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-emerald-500" strokeWidth="3" />
                    <circle 
                        cx="18" cy="18" r="15.5" fill="none" 
                        className="stroke-red-500" strokeWidth="3"
                        strokeDasharray={`${(returnAngle / 360) * 100} 100`}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">Ratio</span>
                    <span className="text-sm font-black text-slate-800">{summary.ratio}%</span>
                </div>
            </div>
        );
    };

    const TrendChart = ({ trend }) => {
        if (!trend || trend.length === 0) return <div className="h-32 flex items-center justify-center text-slate-400 italic">No trend data</div>;
        const maxRatio = Math.max(...trend.map(t => t.ratio), 5);
        return (
            <div className="flex items-end justify-between h-32 gap-1 pt-4">
                {trend.slice(-12).map((t, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center group relative">
                        <div 
                            className="w-full bg-blue-500 hover:bg-blue-600 rounded-t transition-all duration-300 pointer-events-auto cursor-help"
                            style={{ height: `${(t.ratio / maxRatio) * 100}%` }}
                        >
                            <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
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
        <div className="flex flex-col gap-6 min-h-screen pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-200">
                            <Activity className="w-5 h-5 text-white" />
                        </div>
                        Sale Return Ratio Report
                    </h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">
                        Monitor business performance and party-wise return trends
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleExport}
                        className="p-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 font-bold text-sm shadow-sm"
                    >
                        <Download className="w-4 h-4" /> Export
                    </button>
                    <button 
                         onClick={handlePrint}
                        className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2 font-bold text-sm shadow-md"
                    >
                        <Printer className="w-4 h-4" /> Print
                    </button>
                </div>
            </div>

            {/* Print Only Header */}
            <div className="hidden print:block text-center mb-8 border-b-2 border-slate-900 pb-4">
                <h1 className="text-3xl font-black uppercase tracking-widest">Sale Return Ratio Report</h1>
                <p className="text-slate-600 font-bold mt-2">Period: {filters.dateFrom} to {filters.dateTo}</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                        <DollarSign className="w-12 h-12 text-blue-600" />
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Sale</span>
                    <h2 className="text-2xl font-black text-slate-800 mt-1">₹ {data.summary.totalSale?.toLocaleString()}</h2>
                    <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 w-fit px-2 py-0.5 rounded-full">
                        Gross amount
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                        <RotateCcw className="w-12 h-12 text-red-600" />
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Return</span>
                    <h2 className="text-2xl font-black text-slate-800 mt-1">₹ {data.summary.totalReturn?.toLocaleString()}</h2>
                    <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 w-fit px-2 py-0.5 rounded-full">
                        Returned amount
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                        <TrendingUp className="w-12 h-12 text-emerald-600" />
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Net Sale</span>
                    <h2 className="text-2xl font-black text-slate-800 mt-1">₹ {data.summary.netSale?.toLocaleString()}</h2>
                    <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-full">
                        Actual business
                    </div>
                </div>

                <div className={`p-5 rounded-2xl shadow-sm border relative overflow-hidden group transition-colors ${data.summary.ratio > 10 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                    <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:scale-110 transition-transform">
                        <Percent className={`w-12 h-12 ${data.summary.ratio > 10 ? 'text-red-600' : 'text-emerald-600'}`} />
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-wider ${data.summary.ratio > 10 ? 'text-red-400' : 'text-emerald-400'}`}>Return Ratio</span>
                    <h2 className={`text-2xl font-black mt-1 ${data.summary.ratio > 10 ? 'text-red-700' : 'text-emerald-700'}`}>{data.summary.ratio}%</h2>
                    <div className={`mt-3 flex items-center gap-1 text-[10px] font-bold w-fit px-2 py-0.5 rounded-full ${data.summary.ratio > 10 ? 'text-red-700 bg-red-100' : 'text-emerald-700 bg-emerald-100'}`}>
                        {data.summary.ratio > 10 ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
                        {data.summary.ratio > 10 ? 'High' : 'Healthy'}
                    </div>
                </div>
            </div>

            {/* Filters & Visuals Section */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 print:hidden">
                {/* Filters */}
                <div className="xl:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-50 pb-4 mb-6">
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-blue-600" />
                            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Filters</h3>
                        </div>
                        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                            {[
                                { id: 'current_month', label: 'Month' },
                                { id: 'last_quarter', label: 'Quarter' },
                                { id: 'current_year', label: 'Year' }
                            ].map(p => (
                                <button 
                                    key={p.id}
                                    onClick={() => setPeriod(p.id)}
                                    className="px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all hover:bg-white hover:text-blue-600"
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Date From
                            </label>
                            <input 
                                type="date"
                                value={filters.dateFrom}
                                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Date To
                            </label>
                            <input 
                                type="date"
                                value={filters.dateTo}
                                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                                <Search className="w-3 h-3" /> Quick Search
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text"
                                    placeholder="Search party name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Insights Mini Section */}
                    <div className="mt-8 pt-8 border-t border-slate-50 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingDown className="w-4 h-4 text-red-500" />
                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Highest Return Alert</span>
                            </div>
                            <div className="space-y-2">
                                {data.partyWise.filter(p => p.ratio > 15).sort((a,b) => b.ratio - a.ratio).slice(0, 3).map((p, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600 font-bold text-xs">{i+1}</div>
                                            <span className="text-xs font-bold text-red-900 truncate max-w-[120px]">{p.partyName}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-black text-red-700">{p.ratio}%</span>
                                            <span className="text-[8px] font-bold text-red-400 uppercase">Return Rate</span>
                                        </div>
                                    </div>
                                ))}
                                {data.partyWise.filter(p => p.ratio > 15).length === 0 && (
                                    <div className="text-xs text-slate-400 italic p-4 text-center border border-dashed rounded-xl">All parties within safe limits</div>
                                )}
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <BarIcon className="w-4 h-4 text-emerald-500" />
                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Return Top 5 Parties</span>
                            </div>
                            <SimpleBarChart data={data.partyWise.sort((a,b) => b.ratio - a.ratio)} />
                        </div>
                    </div>
                </div>

                {/* Charts Area */}
                <div className="xl:col-span-4 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-center items-center">
                        <div className="flex items-center gap-2 mb-6 self-start w-full border-b border-slate-50 pb-4">
                            <PieIcon className="w-4 h-4 text-indigo-500" />
                            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Return Composition</h3>
                        </div>
                        <SimplePieChart summary={data.summary} />
                        <div className="mt-8 grid grid-cols-2 gap-4 w-full">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Net Sale</span>
                                </div>
                                <span className="text-sm font-black text-slate-700">₹{data.summary.netSale?.toLocaleString()}</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Return</span>
                                </div>
                                <span className="text-sm font-black text-slate-700">₹{data.summary.totalReturn?.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 overflow-hidden">
                        <div className="flex items-center gap-2 mb-6 border-b border-slate-50 pb-4">
                            <TrendingUp className="w-4 h-4 text-blue-500" />
                            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Return Ratio Trend</h3>
                        </div>
                        <TrendChart trend={data.trend} />
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden print:border-none print:shadow-none">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between print:hidden">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <User className="w-4 h-4 text-indigo-600" />
                        </div>
                        <h3 className="font-black text-slate-800 text-sm tracking-tight">Party-wise Breakdown</h3>
                    </div>
                    <div className="text-xs font-bold text-slate-400 uppercase">
                        Sorted by <span className="text-blue-600">{sortConfig.key} ({sortConfig.direction})</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 print:bg-white text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-100">
                                <th className="px-6 py-4">#</th>
                                <th className="px-6 py-4 cursor-pointer hover:text-blue-600" onClick={() => handleSort('partyName')}>
                                    <div className="flex items-center gap-1">Party Name <ChevronDown className="w-3 h-3" /></div>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:text-blue-600 text-right" onClick={() => handleSort('totalSale')}>
                                    <div className="flex items-center justify-end gap-1">Total Sale <ChevronDown className="w-3 h-3" /></div>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:text-blue-600 text-right" onClick={() => handleSort('totalReturn')}>
                                    <div className="flex items-center justify-end gap-1">Return <ChevronDown className="w-3 h-3" /></div>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:text-blue-600 text-right" onClick={() => handleSort('netSale')}>
                                    <div className="flex items-center justify-end gap-1">Net Sale <ChevronDown className="w-3 h-3" /></div>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:text-blue-600 text-right" onClick={() => handleSort('ratio')}>
                                    <div className="flex items-center justify-end gap-1">Return % <ChevronDown className="w-3 h-3" /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-slate-400 font-bold text-sm tracking-widest uppercase">Fetching Data...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : sortedData.map((p, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4 text-xs font-bold text-slate-400">{idx + 1}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-slate-700 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{p.partyName}</span>
                                            <span className="text-[9px] font-bold text-slate-400 tracking-wider">REGULAR CUSTOMER</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-700 text-right">₹{p.totalSale.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-red-500 text-right">₹{p.totalReturn.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-right">₹{p.netSale.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden md:block">
                                                <div 
                                                    className={`h-full ${p.ratio > 15 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                                    style={{ width: `${Math.min(p.ratio * 2, 100)}%` }}
                                                />
                                            </div>
                                            <span className={`text-sm font-black w-14 ${p.ratio > 15 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                {p.ratio}%
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {sortedData.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center text-slate-400 font-bold italic">
                                        No sales or returns found for the selected period
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                             <tr className="bg-slate-900 text-white print:text-black print:bg-slate-100 font-black text-sm uppercase italic">
                                <td colSpan={2} className="px-6 py-6 border-r border-slate-800">TOTAL SUMMARY OVER SELECTED PERIOD</td>
                                <td className="px-6 py-6 text-right">₹{data.summary.totalSale?.toLocaleString()}</td>
                                <td className="px-6 py-6 text-right text-red-400">₹{data.summary.totalReturn?.toLocaleString()}</td>
                                <td className="px-6 py-6 text-right text-emerald-400">₹{data.summary.netSale?.toLocaleString()}</td>
                                <td className="px-6 py-6 text-right text-amber-400">{data.summary.ratio}%</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Print Footer */}
            <div className="hidden print:block mt-12 pt-8 border-t border-slate-200 text-center text-slate-400 text-[10px]">
                <p>System Generated Report • Printed on: {new Date().toLocaleString()}</p>
                <p>Confidential Business Intelligence</p>
            </div>
            
            {/* Styles for print */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    body { background: white !important; }
                    .print\\:hidden { display: none !important; }
                    .print\\:block { display: block !important; }
                    .shadow-sm, .shadow-md, .shadow-lg { box-shadow: none !important; }
                    .border { border: 1px solid #eee !important; }
                    table { border-collapse: collapse !important; }
                    th, td { border: 1px solid #f1f1f1 !important; }
                    tr { border-bottom: 1px solid #f1f1f1 !important; }
                }
            ` }} />
        </div>
    );
};

export default SaleReturnRatioReport;
