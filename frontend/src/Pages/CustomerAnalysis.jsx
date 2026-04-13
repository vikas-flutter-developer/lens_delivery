import React, { useState, useEffect } from 'react';
import {
    Search,
    RotateCcw,
    FileSpreadsheet,
    Printer,
    Filter,
    TrendingUp,
    Users,
    ArrowUpRight,
    ArrowDownRight,
    Calendar,
    ChevronUp,
    ChevronDown,
} from 'lucide-react';
import { getCustomerAnalysisReport } from '../controllers/Reports.controller';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

export default function CustomerAnalysis() {
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: 'totalSales', direction: 'desc' });

    const [filters, setFilters] = useState({
        dateFrom: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        handleSearch();
    }, []);

    const handleSearch = async () => {
        try {
            setLoading(true);
            const res = await getCustomerAnalysisReport(filters);
            if (res.success) {
                setReportData(res.data);
            } else {
                toast.error(res.error || 'Failed to fetch analysis data');
            }
        } catch (error) {
            console.error('Failed to fetch customer analysis:', error);
            toast.error('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setFilters({
            dateFrom: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
            dateTo: new Date().toISOString().split('T')[0],
        });
        setTimeout(handleSearch, 100);
    };

    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const sortedData = [...reportData].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    const handleExportExcel = () => {
        if (reportData.length === 0) {
            toast.error('No data to export');
            return;
        }
        const csv = Papa.unparse(reportData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Customer_Analysis_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    // Calculate Summary Stats
    const totalRevenue = reportData.reduce((sum, item) => sum + (item.totalSales || 0), 0);
    const totalQty = reportData.reduce((sum, item) => sum + (item.totalQty || 0), 0);
    const avgOrderValue = reportData.length > 0 ? totalRevenue / reportData.reduce((sum, item) => sum + (item.orderCount || 0), 0) : 0;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg text-white">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        CUSTOMER PERFORMANCE ANALYSIS
                    </h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">
                        Analyzing sales performance, volume, and customer value metrics
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-sm hover:bg-emerald-100 transition-all active:scale-95"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Export Data
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-bold text-sm hover:bg-slate-200 transition-all active:scale-95"
                    >
                        <Printer className="w-4 h-4" />
                        Print Report
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Revenue</p>
                    <h2 className="text-2xl font-black text-slate-800">₹{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                    <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold mt-2">
                        <ArrowUpRight className="w-3 h-3" />
                        <span>Analysis Period Total</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Customers</p>
                    <h2 className="text-2xl font-black text-slate-800">{reportData.length}</h2>
                    <div className="flex items-center gap-1 text-blue-500 text-xs font-bold mt-2">
                        <Users className="w-3 h-3" />
                        <span>Unique Accounts</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Quantity</p>
                    <h2 className="text-2xl font-black text-slate-800">{totalQty.toLocaleString()}</h2>
                    <div className="flex items-center gap-1 text-purple-500 text-xs font-bold mt-2">
                        <TrendingUp className="w-3 h-3" />
                        <span>Items Sold</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Avg Bill Value</p>
                    <h2 className="text-2xl font-black text-slate-800">₹{avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                    <div className="flex items-center gap-1 text-orange-500 text-xs font-bold mt-2">
                        <TrendingUp className="w-3 h-3" />
                        <span>Per Transaction</span>
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="mx-8 mb-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-end gap-6 no-print">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Period From</label>
                        <div className="relative">
                            <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="date"
                                value={filters.dateFrom}
                                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Period To</label>
                        <div className="relative">
                            <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="date"
                                value={filters.dateTo}
                                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex items-end gap-3">
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-50"
                        >
                            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
                            Execute Analysis
                        </button>
                        <button
                            onClick={handleReset}
                            className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all border border-slate-200"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Analysis Table */}
            <div className="mx-8 mb-8 flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto flex-1 custom-scrollbar">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">Rank</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Name</th>
                                <th
                                    onClick={() => handleSort('totalSales')}
                                    className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 group"
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Total Revenue
                                        {sortConfig.key === 'totalSales' ? (sortConfig.direction === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />) : <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-100" />}
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleSort('orderCount')}
                                    className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 group w-32"
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Orders
                                        {sortConfig.key === 'orderCount' ? (sortConfig.direction === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />) : <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-100" />}
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleSort('totalQty')}
                                    className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 group w-32"
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        QTY Sold
                                        {sortConfig.key === 'totalQty' ? (sortConfig.direction === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />) : <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-100" />}
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Performance</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Last Trans.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                Array(10).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-6 py-4 bg-slate-50/50" />
                                    </tr>
                                ))
                            ) : sortedData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-32 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 bg-slate-100 rounded-full text-slate-300">
                                                <Filter className="w-12 h-12" />
                                            </div>
                                            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No analysis data found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                sortedData.map((item, idx) => {
                                    // Calculate relative performance bar
                                    const maxSales = Math.max(...reportData.map(r => r.totalSales));
                                    const perfRatio = (item.totalSales / maxSales) * 100;

                                    return (
                                        <tr key={idx} className="hover:bg-blue-50/40 transition-colors group">
                                            <td className="px-6 py-4 text-xs font-black text-slate-400 tracking-tighter">
                                                #{idx + 1}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                                                        {item.customerName?.substring(0, 2)}
                                                    </div>
                                                    <p className="text-sm font-bold text-slate-800 uppercase truncate max-w-[200px] group-hover:text-blue-600 transition-colors">
                                                        {item.customerName}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <p className="text-sm font-black text-slate-900">₹{item.totalSales?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                            </td>
                                            <td className="px-6 py-4 text-right text-xs font-bold text-slate-500 italic">
                                                {item.orderCount} Orders
                                            </td>
                                            <td className="px-6 py-4 text-right text-xs font-bold text-slate-500 italic">
                                                {item.totalQty} Units
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col items-end gap-1.5 px-4 w-40 ml-auto">
                                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all duration-1000 ${perfRatio > 75 ? 'bg-blue-500' : perfRatio > 40 ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                                            style={{ width: `${perfRatio}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-400">{perfRatio.toFixed(1)}%</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right text-xs font-bold text-slate-500 whitespace-nowrap">
                                                {item.lastOrderDate ? new Date(item.lastOrderDate).toLocaleDateString('en-GB') : '-'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Legend footer */}
                <div className="bg-slate-50 border-t border-slate-200 px-8 py-4 flex items-center justify-between no-print">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Analysis calculated based on sales orders and invoices within selected dates
                    </p>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-[10px] font-bold text-slate-500">Tier 1 Performance (\u003E75%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-bold text-slate-500">Tier 2 Performance (\u003E40%)</span>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @media print {
                    @page { size: landscape; margin: 10mm; }
                    .no-print, .Navbar, .Sidebar { display: none !important; }
                    body { background: white !important; }
                    .mx-8 { margin-left: 0 !important; margin-right: 0 !important; }
                    .rounded-2xl { border-radius: 0 !important; }
                    .shadow-sm, .shadow-md { shadow: none !important; }
                    table { font-size: 8pt !important; }
                    th, td { border: 0.5pt solid #e2e8f0 !important; }
                }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
            `}</style>
        </div>
    );
}
