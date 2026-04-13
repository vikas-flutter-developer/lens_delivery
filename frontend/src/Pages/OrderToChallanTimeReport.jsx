import React, { useState, useEffect, useMemo } from "react";
import { 
  Clock, 
  Search, 
  Calendar, 
  Download, 
  Printer, 
  Filter, 
  Activity,
  User,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Timer,
  Settings2,
  X as CloseIcon
} from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import ApiClient from "../ApiClient";

const OrderToChallanTimeReport = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState({ 
        summary: { totalOrders: 0, completedOrders: 0, pendingOrders: 0, avgTime: 0 }, 
        details: [], 
        trend: [] 
    });
    const [filters, setFilters] = useState({
        dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
        partyName: "",
        status: "All"
    });
    const [threshold, setThreshold] = useState(() => {
        return parseInt(localStorage.getItem('orderThreshold') || '30');
    });
    const [searchTerm, setSearchTerm] = useState("");
    const [partySearch, setPartySearch] = useState("");
    const [showPartyList, setShowPartyList] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Time Formatting Helpers
    const formatTimeLong = (totalMins) => {
        if (!totalMins && totalMins !== 0) return "0 m";
        const mins = Math.round(totalMins);
        if (mins < 60) return `${mins} m`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `${h}hr ${m} mins` : `${h} hrs`;
    };

    const formatTimeShort = (totalMins) => {
        if (!totalMins && totalMins !== 0) return "0m";
        const mins = Math.round(totalMins);
        if (mins < 59) return `${mins}m`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `${h} hr ${m} min` : `${h} hrs`;
    };

    // Update current time every minute for live threshold highlighting
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const response = await ApiClient.post(`/reports/order-to-challan-time`, filters);
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
    }, [filters.dateFrom, filters.dateTo, filters.status, filters.partyName]);

    useEffect(() => {
        localStorage.setItem('orderThreshold', threshold.toString());
    }, [threshold]);

    const processedDetails = useMemo(() => {
        return data.details.map(d => {
            let status = d.status;
            let displayDiff = d.timeDifference;
            
            if (d.status === 'Pending') {
                const orderTime = new Date(d.orderCreatedAt);
                const diffMin = Math.floor((currentTime - orderTime) / (1000 * 60));
                if (diffMin > threshold) {
                    status = 'Delayed';
                }
                displayDiff = diffMin;
            } else if (d.timeDifference > threshold) {
                status = 'Delayed';
            } else {
                status = 'On Time';
            }

            return { ...d, calculatedStatus: status, displayDiff };
        });
    }, [data.details, threshold, currentTime]);

    const filteredDetails = useMemo(() => {
        let items = [...processedDetails];
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            items = items.filter(d => 
                d.partyName.toLowerCase().includes(term) || 
                d.orderNo.toLowerCase().includes(term) ||
                d.challanNo.toLowerCase().includes(term)
            );
        }
        return items;
    }, [processedDetails, searchTerm]);

    const uniqueParties = useMemo(() => {
        const parties = new Set(data.details.map(d => d.partyName));
        return Array.from(parties).sort();
    }, [data.details]);

    const filteredParties = useMemo(() => {
        if (!partySearch) return uniqueParties;
        return uniqueParties.filter(p => p.toLowerCase().includes(partySearch.toLowerCase()));
    }, [uniqueParties, partySearch]);

    const stats = useMemo(() => {
        const total = filteredDetails.length;
        const delayed = filteredDetails.filter(d => d.calculatedStatus === 'Delayed').length;
        const onTime = filteredDetails.filter(d => d.calculatedStatus === 'On Time').length;
        const pending = filteredDetails.filter(d => d.status === 'Pending').length;
        const completed = total - pending;

        return { total, delayed, onTime, pending, completed };
    }, [filteredDetails]);

    const handleExport = () => {
        const exportData = filteredDetails.map((d, idx) => ({
            "Sr. No.": idx + 1,
            "Order Date": new Date(d.orderDate).toLocaleDateString(),
            "Order No": d.orderNo,
            "Challan Date": d.challanDate ? new Date(d.challanDate).toLocaleDateString() : 'N/A',
            "Challan No": d.challanNo,
            "Party Name": d.partyName,
            "Diff": formatTimeShort(d.displayDiff),
            "Status": d.calculatedStatus
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Order Timing");
        XLSX.writeFile(wb, `Order_Timings_${filters.dateFrom}.xlsx`);
    };

    const handlePrint = () => window.print();

    // Chart Components
    const SimplePieChart = ({ stats }) => {
        const total = stats.total || 0;
        const delayed = stats.delayed || 0;
        const onTime = stats.onTime || 0;
        const pending = stats.pending || 0;

        const delayedP = total > 0 ? (delayed / total) * 100 : 0;
        const onTimeP = total > 0 ? (onTime / total) * 100 : 0;
        const pendingP = total > 0 ? (pending / total) * 100 : 0;

        return (
            <div className="relative w-40 h-40 mx-auto">
                <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-emerald-500" strokeWidth="4" 
                        strokeDasharray={`${onTimeP} 100`} />
                    <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-red-500" strokeWidth="4"
                        strokeDasharray={`${delayedP} 100`} strokeDashoffset={-onTimeP} />
                    <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-amber-400" strokeWidth="4"
                        strokeDasharray={`${pendingP} 100`} strokeDashoffset={-(onTimeP + delayedP)} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">Process</span>
                    <span className="text-sm font-black text-slate-800">{onTimeP.toFixed(0)}%</span>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6 min-h-screen pb-10 bg-slate-50/30">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:p-0 print:hidden">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
                        <Timer className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                            Order to Challan Time Report
                        </h1>
                        <p className="text-slate-500 text-sm font-medium mt-0.5">
                            Monitor processing efficiency and operational bottlenecks
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm gap-3">
                        <Settings2 className="w-4 h-4 text-slate-400" />
                        <span className="text-[10px] font-black uppercase text-slate-500 whitespace-nowrap">Threshold (Mins):</span>
                        <input 
                            type="number"
                            value={threshold}
                            onChange={(e) => setThreshold(parseInt(e.target.value) || 0)}
                            className="w-16 bg-slate-50 border-none text-sm font-black text-indigo-600 focus:ring-0 text-center"
                        />
                    </div>
                    <button 
                        onClick={handleExport}
                        className="p-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-bold text-sm"
                    >
                        <Download className="w-4 h-4" /> Export
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-4 md:px-0">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-5">
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                        <Receipt className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Total Orders</p>
                        <h2 className="text-3xl font-black text-slate-800">{data.summary.totalOrders}</h2>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-5">
                    <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                        <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Completed</p>
                        <h2 className="text-3xl font-black text-emerald-600">{data.summary.completedOrders}</h2>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-5">
                    <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                        <AlertCircle className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Pending</p>
                        <h2 className="text-3xl font-black text-amber-600">{data.summary.pendingOrders}</h2>
                    </div>
                </div>
                <div className={`p-6 rounded-3xl shadow-sm border flex items-center gap-5 transition-all ${data.summary.avgTime > threshold ? 'bg-red-50 border-red-100' : 'bg-indigo-50 border-indigo-100'}`}>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${data.summary.avgTime > threshold ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                        <Clock className="w-7 h-7" />
                    </div>
                    <div>
                        <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-2 ${data.summary.avgTime > threshold ? 'text-red-400' : 'text-indigo-400'}`}>Avg. Processing</p>
                        <h2 className={`text-3xl font-black ${data.summary.avgTime > threshold ? 'text-red-700' : 'text-indigo-700'}`}>{formatTimeLong(data.summary.avgTime)}</h2>
                    </div>
                </div>
            </div>

            {/* Filters & Visuals */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 px-4 md:px-0 print:hidden text-slate-800">
                <div className="xl:col-span-8 bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                    <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-6">
                        <Filter className="w-5 h-5 text-indigo-600" />
                        <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Global Filters</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">From</label>
                            <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({...f, dateFrom: e.target.value}))} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-4 focus:ring-indigo-100" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">To</label>
                            <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({...f, dateTo: e.target.value}))} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-4 focus:ring-indigo-100" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                            <select value={filters.status} onChange={e => setFilters(f => ({...f, status: e.target.value}))} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold">
                                <option value="All">All Transactions</option>
                                <option value="Completed">Completed Only</option>
                                <option value="Pending">Pending Only</option>
                            </select>
                        </div>
                        <div className="space-y-2 relative">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Party Name</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Search party..." 
                                    value={partySearch || filters.partyName} 
                                    onFocus={() => setShowPartyList(true)}
                                    onChange={e => {
                                        setPartySearch(e.target.value);
                                        setShowPartyList(true);
                                    }} 
                                    className="w-full bg-slate-50 border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm font-bold focus:ring-4 focus:ring-indigo-100" 
                                />
                                {(partySearch || filters.partyName) && (
                                    <button 
                                        onClick={() => {
                                            setFilters(f => ({ ...f, partyName: "" }));
                                            setPartySearch("");
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2"
                                    >
                                        <CloseIcon className="w-4 h-4 text-slate-400 hover:text-red-500" />
                                    </button>
                                )}
                            </div>
                            
                            {showPartyList && (
                                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-2xl shadow-xl z-[100] mt-2 py-2 max-h-[250px] overflow-y-auto shadow-indigo-100">
                                    <div className="px-3 pb-2 border-b border-slate-50 mb-1">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Party ({filteredParties.length})</p>
                                    </div>
                                    <div 
                                        onClick={() => {
                                            setFilters(f => ({ ...f, partyName: "" }));
                                            setPartySearch("");
                                            setShowPartyList(false);
                                        }}
                                        className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-bold text-blue-600 border-b border-slate-50"
                                    >
                                        Clear Filter / All Parties
                                    </div>
                                    {filteredParties.map((p, i) => (
                                        <div 
                                            key={i}
                                            onClick={() => {
                                                setFilters(f => ({ ...f, partyName: p }));
                                                setPartySearch(p);
                                                setShowPartyList(false);
                                            }}
                                            className={`px-4 py-2.5 hover:bg-indigo-50 cursor-pointer text-sm font-bold transition-all ${filters.partyName === p ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}
                                        >
                                            {p}
                                        </div>
                                    ))}
                                    {filteredParties.length === 0 && (
                                        <p className="p-4 text-xs italic text-slate-400 text-center">No matching parties found</p>
                                    )}
                                </div>
                            )}
                            {showPartyList && <div className="fixed inset-0 z-[90]" onClick={() => setShowPartyList(false)}></div>}
                        </div>
                    </div>
                </div>
                <div className="xl:col-span-4 bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                    <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-6">
                        <Activity className="w-5 h-5 text-indigo-600" />
                        <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">SLA Compliance</h3>
                    </div>
                    <SimplePieChart stats={stats} />
                    <div className="mt-4 flex flex-wrap justify-center gap-4">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">On Time</span></div>
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div><span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Delayed</span></div>
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-400"></div><span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Pending</span></div>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="px-4 md:px-0">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-slate-900 rounded-2xl">
                                <Activity className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 text-lg tracking-tight">Operation Audit Breakdown</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Real-time order processing performance</p>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-100">
                                    <th className="px-8 py-5">Order Detail</th>
                                    <th className="px-8 py-5">Challan Detail</th>
                                    <th className="px-8 py-5">Party Name</th>
                                    <th className="px-8 py-5 text-center">Difference</th>
                                    <th className="px-8 py-5 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold animate-pulse uppercase tracking-widest text-xs">Computing Performance Matrix...</td></tr>
                                ) : filteredDetails.map((d, idx) => (
                                    <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${d.calculatedStatus === 'Delayed' ? 'bg-red-50/30' : ''}`}>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-800">{d.orderNo}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                    {new Date(d.orderCreatedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            {d.challanCreatedAt ? (
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-800">{d.challanNo}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                        {new Date(d.challanCreatedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest">NOT CREATED</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3 text-slate-800">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><User className="w-4 h-4" /></div>
                                                <span className="text-sm font-black uppercase tracking-tight">{d.partyName}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-sm font-black ${d.calculatedStatus === 'Delayed' ? 'text-red-600' : 'text-slate-800'}`}>
                                                    {formatTimeShort(d.displayDiff)}
                                                </span>
                                                {d.status === 'Pending' && <span className="text-[8px] font-bold text-amber-500 uppercase">STILL RUNNING</span>}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex justify-center">
                                                <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm ${
                                                    d.calculatedStatus === 'On Time' ? 'bg-emerald-500 text-white' : 
                                                    d.calculatedStatus === 'Delayed' ? 'bg-red-600 text-white animate-pulse' : 
                                                    'bg-amber-400 text-white'
                                                }`}>
                                                    {d.calculatedStatus}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

             <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    .print\\:hidden { display: none !important; }
                    body { background: white !important; font-size: 10px !important; }
                    .bg-white { background: white !important; }
                    table { border: 1px solid #eee !important; width: 100% !important; border-collapse: collapse !important; }
                    th, td { border: 1px solid #eee !important; padding: 10px !important; }
                }
            ` }} />
        </div>
    );
};

export default OrderToChallanTimeReport;
