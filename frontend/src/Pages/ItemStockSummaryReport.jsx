import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
    Search, RotateCcw, FileSpreadsheet, Printer,
    Package, TrendingUp, TrendingDown, IndianRupee,
    Layers, BarChart3, AlertTriangle, Boxes,
    ChevronDown, ChevronUp, ArrowUpDown, ChevronRight,
    CheckCircle2, XCircle, Eye,
} from 'lucide-react';
import { getItemStockSummaryReport } from '../controllers/Reports.controller';
import { getAllGroups } from '../controllers/groupcontroller';
import { getAllLensPower } from '../controllers/LensGroupCreationController';
import toast from 'react-hot-toast';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Number(n || 0).toLocaleString('en-IN');

/* ─── Tiny Bar Chart Component ─── */
function MiniBar({ value, max, color }) {
    const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
    return (
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
        </div>
    );
}

/* ─── Stock Status Badge ─── */
function StockBadge({ qty }) {
    if (qty < 0)  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">⬇ Negative</span>;
    if (qty === 0) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">◯ Zero</span>;
    if (qty <= 10) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">⚠ Low</span>;
    if (qty <= 50) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">≈ Medium</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">✓ High</span>;
}

/* ─── Summary Card ─── */
function SummaryCard({ label, value, sub, icon: Icon, gradient, textColor }) {
    return (
        <div className={`rounded-2xl p-5 text-white shadow-lg ${gradient} relative overflow-hidden`}>
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
            <div className="absolute -right-2 -bottom-6 w-28 h-28 rounded-full bg-white/5" />
            <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-widest opacity-80">{label}</span>
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                    </div>
                </div>
                <div className="text-2xl font-black leading-tight">{value}</div>
                {sub && <div className="text-[11px] opacity-70 mt-1">{sub}</div>}
            </div>
        </div>
    );
}

export default function ItemStockSummaryReport() {
    const [reportData, setReportData]   = useState([]);
    const [loading, setLoading]         = useState(false);
    const [groups, setGroups]           = useState([]);
    const [allItems, setAllItems]       = useState([]); // Store all unique item names
    const [searched, setSearched]       = useState(false);
    const [expandedRow, setExpandedRow] = useState(null);
    const [sortConfig, setSortConfig]   = useState({ key: 'productName', dir: 'asc' });
    const [activeView, setActiveView]   = useState('table'); // 'table' | 'chart'
    const [profitView, setProfitView]   = useState('total'); // 'total' | 'live'

    // Dropdown state
    const [showItemDropdown, setShowItemDropdown] = useState(false);
    const itemSearchRef = useRef(null);

    const [filters, setFilters] = useState({
        groupName:   '',
        productName: '',
        stockStatus: 'All',
    });

    /* fetch initial data on mount */
    useEffect(() => {
        // Fetch Groups
        getAllGroups()
            .then(res => setGroups(res.groups || res.data?.groups || []))
            .catch(() => {});

        // Fetch All Items for dropdown
        getAllLensPower()
            .then(res => {
                if (res.success) {
                    const uniqueNames = Array.from(new Set((res.data || []).map(i => i.productName))).sort();
                    setAllItems(uniqueNames);
                }
            })
            .catch(() => {});
    }, []);

    // Handle outside clicks for dropdown
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (itemSearchRef.current && !itemSearchRef.current.contains(e.target)) {
                setShowItemDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    /* ─── Filterable Items ─── */
    const filteredItemOptions = useMemo(() => {
        if (!filters.productName) return allItems.slice(0, 100);
        const q = filters.productName.toLowerCase();
        return allItems.filter(item => item.toLowerCase().includes(q)).slice(0, 50);
    }, [allItems, filters.productName]);

    /* ─── Search ─── */
    const handleSearch = async () => {
        try {
            setLoading(true);
            setShowItemDropdown(false);
            const res = await getItemStockSummaryReport(filters);
            if (res.success) {
                setReportData(res.data || []);
                setSearched(true);
                if ((res.data || []).length === 0) toast('No items found for selected filters.', { icon: '🔍' });
            } else {
                toast.error('Failed to fetch report.');
            }
        } catch (e) {
            toast.error('Error fetching report.');
        } finally {
            setLoading(false);
        }
    };

    /* auto-search on mount */
    useEffect(() => { handleSearch(); }, []);

    const handleReset = () => {
        setFilters({ groupName: '', productName: '', stockStatus: 'All' });
        setTimeout(handleSearch, 100);
    };

    /* ─── Sorting ─── */
    const handleSort = (key) => {
        setSortConfig(prev =>
            prev.key === key
                ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { key, dir: 'desc' }
        );
    };

    const sortedData = useMemo(() => {
        const d = [...reportData];
        d.sort((a, b) => {
            let av = a[sortConfig.key] ?? '';
            let bv = b[sortConfig.key] ?? '';
            if (typeof av === 'string') av = av.toLowerCase();
            if (typeof bv === 'string') bv = bv.toLowerCase();
            if (av < bv) return sortConfig.dir === 'asc' ? -1 : 1;
            if (av > bv) return sortConfig.dir === 'asc' ? 1 : -1;
            return 0;
        });
        return d;
    }, [reportData, sortConfig]);

    /* ─── Summaries ─── */
    const totals = useMemo(() => ({
        items:        reportData.length,
        qty:          reportData.reduce((s, r) => s + (r.totalStockQty || 0), 0),
        purValue:     reportData.reduce((s, r) => s + (r.totalPurchaseValue || 0), 0),
        saleValue:    reportData.reduce((s, r) => s + (r.totalSellingValue || 0), 0),
        profit:       reportData.reduce((s, r) => s + (r.expectedProfit || 0), 0),
        deadStock:    reportData.filter(r => r.totalStockQty === 0).length,
        lowStock:     reportData.filter(r => r.totalStockQty > 0 && r.totalStockQty <= 10).length,
    }), [reportData]);

    /* ─── Top 5 by qty ─── */
    const top5 = useMemo(() =>
        [...reportData].sort((a, b) => (b.totalStockQty || 0) - (a.totalStockQty || 0)).slice(0, 5),
    [reportData]);

    const maxQty = useMemo(() => Math.max(...reportData.map(r => r.totalStockQty || 0), 1), [reportData]);

    /* ─── Export ─── */
    const handleExport = () => {
        if (sortedData.length === 0) { toast.error('No data to export.'); return; }
        const rows = sortedData.map((r, i) => ({
            'SR No':             i + 1,
            'Item Name':         r.productName,
            'Group Name':        r.groupName,
            'Total Stock Qty':   r.totalStockQty,
            'Avg Purchase Price':r.avgPurchasePrice,
            'Avg Sale Price':    r.avgSellingPrice,
            'Total Purchase Value': r.totalPurchaseValue,
            'Total Selling Value':  r.totalSellingValue,
            'Expected Profit':   r.expectedProfit,
            'Combinations':      r.combinationCount,
            'Stock Status':      r.totalStockQty < 0 ? 'Negative' : r.totalStockQty === 0 ? 'Zero' : r.totalStockQty <= 10 ? 'Low' : r.totalStockQty <= 50 ? 'Medium' : 'High',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Item Stock Summary');
        XLSX.writeFile(wb, `ItemStockSummary_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.xlsx`);
        toast.success('Excel exported!');
    };

    /* ─── Print ─── */
    const handlePrint = () => {
        if (sortedData.length === 0) { toast.error('No data to print.'); return; }
        const win = window.open('', '_blank', 'width=1200,height=800');
        const rows = sortedData.map((r, i) => `
            <tr style="border-bottom:1px solid #e2e8f0;${r.totalStockQty <= 0 ? 'background:#fff1f2;' : r.totalStockQty <= 10 ? 'background:#fffbeb;' : ''}">
                <td style="padding:7px 10px;text-align:center;">${i + 1}</td>
                <td style="padding:7px 10px;font-weight:600;">${r.productName || ''}</td>
                <td style="padding:7px 10px;">${r.groupName || ''}</td>
                <td style="padding:7px 10px;text-align:center;font-weight:700;">${r.totalStockQty ?? 0}</td>
                <td style="padding:7px 10px;text-align:right;">${fmt(r.avgPurchasePrice)}</td>
                <td style="padding:7px 10px;text-align:right;">${fmt(r.avgSellingPrice)}</td>
                <td style="padding:7px 10px;text-align:right;">${fmt(r.totalPurchaseValue)}</td>
                <td style="padding:7px 10px;text-align:right;">${fmt(r.totalSellingValue)}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:700;color:${(r.expectedProfit||0)>=0?'#059669':'#dc2626'};">
                    ${fmt(r.expectedProfit)}
                </td>
            </tr>
        `).join('');
        win.document.write(`
            <html><head><title>Item Stock Summary Report</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; margin: 20px; }
                h2 { text-align: center; margin-bottom: 4px; font-size: 18px; }
                p.sub { text-align: center; color:#64748b; margin-bottom: 16px; font-size: 11px; }
                table { width: 100%; border-collapse: collapse; }
                thead th { background: #1e40af; color: #fff; padding: 9px 10px; font-size: 11px; text-transform: uppercase; }
                tfoot td { background: #1e3a8a; color: #fff; padding: 8px 10px; font-weight: 700; }
                @media print { @page { margin: 1cm; } }
            </style></head><body>
            <h2>Item Stock Summary Report</h2>
            <p class="sub">Generated on ${new Date().toLocaleString('en-IN')}</p>
            <table>
                <thead>
                    <tr>
                        <th>SR</th><th>Item Name</th><th>Group</th><th>Stock Qty</th>
                        <th>Avg P.Price</th><th>Avg S.Price</th>
                        <th>Total Pur. Value</th><th>Total Sale Value</th><th>Expected Profit</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" style="text-align:right;">GRAND TOTAL</td>
                        <td style="text-align:center;">${fmtInt(totals.qty)}</td>
                        <td colspan="2"></td>
                        <td style="text-align:right;">₹${fmt(totals.purValue)}</td>
                        <td style="text-align:right;">₹${fmt(totals.saleValue)}</td>
                        <td style="text-align:right;">₹${fmt(totals.profit)}</td>
                    </tr>
                </tfoot>
            </table>
            </body></html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 500);
    };

    /* ─── Column Sort Button ─── */
    const SortBtn = ({ col, label }) => (
        <button onClick={() => handleSort(col)} className="flex items-center gap-1 hover:text-indigo-200 transition-colors">
            {label}
            {sortConfig.key === col
                ? (sortConfig.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
                : <ArrowUpDown className="w-3 h-3 opacity-50" />}
        </button>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100 p-4 md:p-6">
            <div className="max-w-[1600px] mx-auto space-y-6">

                {/* ── Header ── */}
                <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-600 rounded-2xl px-6 py-5 shadow-xl shadow-indigo-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-white flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                <Boxes className="w-6 h-6 text-white" />
                            </div>
                            Item Stock Summary Report
                        </h1>
                        <p className="text-indigo-200 text-sm mt-1 ml-1">Aggregated item-level stock, value &amp; profitability</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* View toggle */}
                        <div className="flex bg-white/10 p-1 rounded-xl border border-white/20">
                            {[['table','Table','📋'], ['chart','Top Items','📊']].map(([v, label, emoji]) => (
                                <button key={v} onClick={() => setActiveView(v)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeView === v ? 'bg-white text-indigo-700 shadow' : 'text-white/80 hover:text-white'}`}>
                                    {emoji} {label}
                                </button>
                            ))}
                        </div>
                        <button onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-md transition-all">
                            <FileSpreadsheet className="w-4 h-4" /> Excel
                        </button>
                        <button onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl font-bold text-sm shadow-md transition-all">
                            <Printer className="w-4 h-4" /> Print
                        </button>
                    </div>
                </div>

                {/* ── Summary Cards ── */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                    <SummaryCard label="Total Items"        value={fmtInt(totals.items)}     sub="Configured lens products"     icon={Package}      gradient="bg-gradient-to-br from-indigo-600 to-indigo-800" />
                    <SummaryCard label="Total Stock Qty"    value={fmtInt(totals.qty)}        sub="Sum of all combinations"      icon={Layers}       gradient="bg-gradient-to-br from-blue-500 to-blue-700" />
                    <SummaryCard label="Purchase Value"     value={`₹${fmt(totals.purValue)}`}  sub="Cost of current stock"      icon={IndianRupee}  gradient="bg-gradient-to-br from-violet-500 to-violet-700" />
                    <SummaryCard label="Selling Value"      value={`₹${fmt(totals.saleValue)}`} sub="Revenue potential"          icon={TrendingUp}   gradient="bg-gradient-to-br from-teal-500 to-teal-700" />
                    <SummaryCard label="Expected Profit"    value={`₹${fmt(totals.profit)}`}    sub={`${totals.deadStock} dead · ${totals.lowStock} low`} icon={TrendingDown} gradient="bg-gradient-to-br from-rose-500 to-rose-700" />
                </div>

                {/* ── Filters ── */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-end">
                        {/* Group */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Group Name</label>
                            <div className="relative">
                                <select value={filters.groupName} onChange={e => setFilters(p => ({ ...p, groupName: e.target.value }))}
                                    className="w-full appearance-none pl-3 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all">
                                    <option value="">All Groups</option>
                                    {groups.map(g => <option key={g._id} value={g.groupName}>{g.groupName}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Product Name with Searchable Dropdown */}
                        <div className="relative" ref={itemSearchRef}>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Item Name</label>
                            <input 
                                type="text" 
                                value={filters.productName}
                                onFocus={() => setShowItemDropdown(true)}
                                onChange={e => {
                                    setFilters(p => ({ ...p, productName: e.target.value }));
                                    setShowItemDropdown(true);
                                }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSearch();
                                }}
                                placeholder="Search or select item..."
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" 
                            />
                            
                            {showItemDropdown && filteredItemOptions.length > 0 && (
                                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-2xl max-h-64 overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-1 uppercase text-[10px] font-bold text-slate-400 tracking-widest bg-slate-50 border-b border-slate-100 px-3 py-1.5">
                                        Select existing item
                                    </div>
                                    {filteredItemOptions.map((item, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                setFilters(p => ({ ...p, productName: item }));
                                                setShowItemDropdown(false);
                                            }}
                                            className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-sm font-semibold text-slate-700 transition-colors flex items-center justify-between group"
                                        >
                                            <span className="truncate">{item}</span>
                                            <div className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ChevronRight className="w-3 h-3" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Stock Status */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Stock Status</label>
                            <div className="relative">
                                <select value={filters.stockStatus} onChange={e => setFilters(p => ({ ...p, stockStatus: e.target.value }))}
                                    className="w-full appearance-none pl-3 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all">
                                    {['All','High','Medium','Low','Zero','Negative'].map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button onClick={handleSearch} disabled={loading}
                                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 font-bold text-sm transition-all shadow-md shadow-indigo-100 disabled:opacity-50">
                                {loading
                                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : <Search className="w-4 h-4" />}
                                Search
                            </button>
                            <button onClick={handleReset}
                                className="px-3 py-2.5 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl border border-slate-200 transition-all">
                                <RotateCcw className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── TABLE VIEW ── */}
                {activeView === 'table' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        {/* Table header info */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                                <Package className="w-4 h-4 text-indigo-500" />
                                {searched ? `${sortedData.length} Items` : 'All Items'}
                                <span className="text-slate-400 font-normal">— sorted by {sortConfig.key} ({sortConfig.dir})</span>
                            </h3>
                            <div className="flex gap-2 text-xs text-slate-400 font-medium">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span> Negative</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> Low (≤10)</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span> Medium (≤50)</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span> High (&gt;50)</span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead>
                                    <tr className="bg-indigo-600 text-white text-[10px] uppercase tracking-widest font-bold">
                                        <th className="px-4 py-3 text-center w-12">SR</th>
                                        <th className="px-4 py-3"><SortBtn col="productName" label="Item Name" /></th>
                                        <th className="px-4 py-3"><SortBtn col="groupName" label="Group" /></th>
                                        <th className="px-4 py-3 text-center"><SortBtn col="totalStockQty" label="Stock Qty" /></th>
                                        <th className="px-4 py-3 text-center">Combos</th>
                                        <th className="px-4 py-3 text-right"><SortBtn col="avgPurchasePrice" label="Avg P.Price" /></th>
                                        <th className="px-4 py-3 text-right"><SortBtn col="avgSellingPrice" label="Avg S.Price" /></th>
                                        <th className="px-4 py-3 text-right"><SortBtn col="totalPurchaseValue" label="Pur. Value" /></th>
                                        <th className="px-4 py-3 text-right"><SortBtn col="totalSellingValue" label="Sale Value" /></th>
                                        <th className="px-4 py-3 text-right"><SortBtn col="expectedProfit" label="Profit" /></th>
                                        <th className="px-4 py-3 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedData.length === 0 ? (
                                        <tr>
                                            <td colSpan={11} className="py-20 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center">
                                                        <Package className="w-8 h-8 text-slate-200" />
                                                    </div>
                                                    <p className="text-slate-400 font-medium">
                                                        {searched ? 'No items match your filters' : 'Click Search to load report'}
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : sortedData.map((row, i) => {
                                        const isNeg  = row.totalStockQty < 0;
                                        const isZero = row.totalStockQty === 0;
                                        const isLow  = row.totalStockQty > 0 && row.totalStockQty <= 10;
                                        const rowBg  = isNeg ? 'bg-rose-50/60 hover:bg-rose-50' : isZero ? 'bg-slate-50/80 hover:bg-slate-100' : isLow ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-indigo-50/40';
                                        const isExpanded = expandedRow === i;
                                        const profitColor = (row.expectedProfit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600';
                                        return (
                                            <React.Fragment key={i}>
                                                <tr
                                                    className={`transition-colors cursor-pointer border-b border-slate-50 ${rowBg}`}
                                                    onClick={() => setExpandedRow(isExpanded ? null : i)}
                                                >
                                                    <td className="px-4 py-3 text-center text-slate-400 text-xs tabular-nums">{i + 1}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-slate-800 text-sm">{row.productName}</div>
                                                        <MiniBar value={row.totalStockQty} max={maxQty} color="bg-indigo-400" />
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-slate-500 font-medium">{row.groupName || '—'}</td>
                                                    <td className={`px-4 py-3 text-center font-black text-lg tabular-nums ${isNeg ? 'text-rose-600' : isZero ? 'text-slate-400' : isLow ? 'text-amber-600' : 'text-emerald-700'}`}>
                                                        {fmtInt(row.totalStockQty)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-slate-500 text-xs">
                                                        <span className="bg-slate-100 rounded-full px-2 py-0.5 font-bold">{row.combinationCount}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-slate-600 font-medium tabular-nums">₹{fmt(row.avgPurchasePrice)}</td>
                                                    <td className="px-4 py-3 text-right text-slate-700 font-medium tabular-nums">₹{fmt(row.avgSellingPrice)}</td>
                                                    <td className="px-4 py-3 text-right text-slate-700 font-semibold tabular-nums">₹{fmt(row.totalPurchaseValue)}</td>
                                                    <td className="px-4 py-3 text-right text-indigo-700 font-semibold tabular-nums">₹{fmt(row.totalSellingValue)}</td>
                                                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${profitColor}`}>₹{fmt(row.expectedProfit)}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <StockBadge qty={row.totalStockQty} />
                                                    </td>
                                                </tr>
                                                {/* Expanded row */}
                                                {isExpanded && (
                                                    <tr className="bg-indigo-50/70">
                                                        <td colSpan={11} className="px-8 py-4">
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                                {[
                                                                    { label: 'Total Combos', value: row.combinationCount, icon: Layers, color: 'bg-violet-100 text-violet-700' },
                                                                    { label: 'Avg Pur. Price', value: `₹${fmt(row.avgPurchasePrice)}`, icon: IndianRupee, color: 'bg-slate-100 text-slate-700' },
                                                                    { label: 'Avg Sale Price', value: `₹${fmt(row.avgSellingPrice)}`, icon: IndianRupee, color: 'bg-blue-100 text-blue-700' },
                                                                    { label: 'Profit Margin', value: row.totalSellingValue > 0 ? `${((row.expectedProfit / row.totalSellingValue) * 100).toFixed(1)}%` : '0%', icon: TrendingUp, color: 'bg-emerald-100 text-emerald-700' },
                                                                ].map(({ label, value, icon: Icon, color }) => (
                                                                    <div key={label} className={`rounded-xl px-4 py-3 flex items-center gap-3 ${color}`}>
                                                                        <Icon className="w-4 h-4 flex-shrink-0" />
                                                                        <div>
                                                                            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</div>
                                                                            <div className="font-black text-sm">{value}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                                {sortedData.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-indigo-900 text-white font-bold text-sm">
                                            <td colSpan={3} className="px-4 py-3 text-right text-xs uppercase tracking-widest opacity-80">Grand Total</td>
                                            <td className="px-4 py-3 text-center text-lg">{fmtInt(totals.qty)}</td>
                                            <td className="px-4 py-3"></td>
                                            <td colSpan={2} className="px-4 py-3"></td>
                                            <td className="px-4 py-3 text-right">₹{fmt(totals.purValue)}</td>
                                            <td className="px-4 py-3 text-right">₹{fmt(totals.saleValue)}</td>
                                            <td className="px-4 py-3 text-right text-emerald-300">₹{fmt(totals.profit)}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                )}

                {/* ── CHART VIEW (Top Items) ── */}
                {activeView === 'chart' && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {/* Top 5 by stock */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                            <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-indigo-500" />
                                Top 5 Items By Stock Quantity
                            </h3>
                            {top5.length === 0
                                ? <p className="text-slate-400 text-center py-10">No data — click Search first</p>
                                : top5.map((r, i) => (
                                    <div key={i} className="mb-4 last:mb-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-semibold text-slate-700 truncate max-w-[240px]">{r.productName}</span>
                                            <span className="text-sm font-black text-indigo-600 ml-2">{fmtInt(r.totalStockQty)}</span>
                                        </div>
                                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
                                                style={{ width: `${maxQty > 0 ? (r.totalStockQty / maxQty) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                ))
                            }
                        </div>

                        {/* Top 5 by profit */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                                    Top 5 Most Profitable Items
                                </h3>
                                {/* Toggle Control */}
                                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 self-start sm:self-auto" title={profitView === 'live' ? 'Live profit based on actual sold quantity' : 'Overall stock-based profit'}>
                                    <button 
                                        onClick={() => setProfitView('total')}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${profitView === 'total' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Total Profit
                                    </button>
                                    <button 
                                        onClick={() => setProfitView('live')}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${profitView === 'live' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Live Profit
                                    </button>
                                </div>
                            </div>
                            {(() => {
                                const profitKey = profitView === 'live' ? 'liveProfit' : 'expectedProfit';
                                const colorClass = profitView === 'live' ? 'text-emerald-600' : 'text-emerald-500';
                                const gradientClass = profitView === 'live' ? 'from-emerald-500 to-teal-400' : 'from-emerald-400 to-teal-500';
                                
                                const topP = [...reportData].sort((a, b) => (b[profitKey] || 0) - (a[profitKey] || 0)).slice(0, 5);
                                const maxP = Math.max(...topP.map(r => r[profitKey] || 0), 1);
                                
                                return topP.length === 0 || topP.every(r => (r[profitKey] || 0) === 0)
                                    ? <p className="text-slate-400 text-center py-10">No data — {searched ? 'No recorded profit' : 'click Search first'}</p>
                                    : topP.map((r, i) => {
                                        const val = r[profitKey] || 0;
                                        if (val === 0) return null; // hide zeros if some other items have profit
                                        return (
                                        <div key={i} className="mb-4 last:mb-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-semibold text-slate-700 truncate max-w-[240px]">{r.productName}</span>
                                                <span className={`text-sm font-black ml-2 ${colorClass}`}>₹{fmt(val)}</span>
                                            </div>
                                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full bg-gradient-to-r ${gradientClass} transition-all duration-700`}
                                                    style={{ width: `${maxP > 0 ? (val / maxP) * 100 : 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    )});
                            })()}
                        </div>

                        {/* Dead Stock Detection */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-500" />
                                Dead Stock Detection
                                <span className="ml-auto text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">{totals.deadStock} Items</span>
                            </h3>
                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                {reportData.filter(r => r.totalStockQty === 0).length === 0
                                    ? <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold py-4 justify-center">
                                        <CheckCircle2 className="w-5 h-5" /> No dead stock — all items have stock!
                                      </div>
                                    : reportData.filter(r => r.totalStockQty === 0).map((r, i) => (
                                        <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                                            <div>
                                                <div className="text-sm font-bold text-slate-700">{r.productName}</div>
                                                <div className="text-[10px] text-slate-400">{r.groupName} · {r.combinationCount} combos</div>
                                            </div>
                                            <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                                        </div>
                                    ))
                                }
                            </div>
                        </div>

                        {/* Low Stock Alert */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-rose-500" />
                                Low Stock Alert
                                <span className="ml-auto text-xs bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">{totals.lowStock} Items</span>
                            </h3>
                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                {reportData.filter(r => r.totalStockQty > 0 && r.totalStockQty <= 10).length === 0
                                    ? <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold py-4 justify-center">
                                        <CheckCircle2 className="w-5 h-5" /> No low-stock items!
                                      </div>
                                    : reportData.filter(r => r.totalStockQty > 0 && r.totalStockQty <= 10).sort((a,b) => a.totalStockQty - b.totalStockQty).map((r, i) => (
                                        <div key={i} className="flex items-center justify-between bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
                                            <div>
                                                <div className="text-sm font-bold text-slate-700">{r.productName}</div>
                                                <div className="text-[10px] text-amber-600">{r.groupName}</div>
                                            </div>
                                            <span className="font-black text-amber-600 text-lg">{r.totalStockQty}</span>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
